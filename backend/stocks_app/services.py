"""
Stock price services - NEPSE API client and price update utilities.

This module handles:
1. Fetching stock prices from NEPSE official API (via nepse-data-api)
2. Updating all stock prices in the database (market data refresh)
3. Smart cached on-demand market depth and stock prices (adaptive TTL)
"""

import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
import time

logger = logging.getLogger(__name__)


# ===== CACHE TTL CONFIGURATION =====
# During market hours: refresh every ~1 minute (matches NEPSE API update frequency)
# During market close: cache permanently (data is static until next trading day)
MARKET_OPEN_TTL = 60          # 60 seconds when market is live (NEPSE updates ~1 min)
MARKET_CLOSED_TTL = 86400     # 24 hours when market is closed (data is static)
THROTTLE_DELAY = 2            # 2 seconds minimum between on-demand requests per user/IP


def _get_cache_ttl():
    """Get the appropriate cache TTL based on market status."""
    from stocks_app.market_hours import is_market_open
    from datetime import datetime
    
    is_open = is_market_open()
    
    if is_open:
        # Align cache expiry to the start of the next minute (HH:MM:00)
        # This ensures we don't fetch API multiple times within the same minute bucket
        now = datetime.now()
        seconds_remaining = 60 - now.second
        # Minimum safe TTL is 1 second
        return max(1, seconds_remaining)
        
    return MARKET_CLOSED_TTL


# ===== NEPSE API Client (nepse-data-api) =====
# Lazy initialization to avoid import-time network calls
_nepse_client = None

def _get_nepse_client():
    """Get or create the Nepse API client (lazy singleton)."""
    global _nepse_client
    if _nepse_client is None:
        from nepse_data_api import Nepse
        _nepse_client = Nepse(cache_ttl=15, enable_cache=True)
    return _nepse_client


def safe_decimal(value, default=Decimal('0')) -> Decimal:
    """Safely convert a value to Decimal, returning default if it fails."""
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


# ===== INDEX CONFIGURATION =====
# Main indices (from get_nepse_index) - these have live values
MAIN_INDEX_SYMBOLS = {
    'NEPSE Index': 'NEPSE',
    'Float Index': 'Float',
    'Sensitive Index': 'Sensitive',
    'Sensitive Float Index': 'SensitiveFloat',
}

# Sub-index to sector mapping (from get_all_indices sectorMaster)
SUB_INDEX_SECTOR_MAP = {
    'Banking SubIndex': 'Commercial Banks',
    'Development Bank Index': 'Development Banks',
    'Finance Index': 'Finance',
    'Hotels And Tourism Index': 'Hotels And Tourism',
    'HydroPower Index': 'Hydro Power',
    'Investment Index': 'Investment',
    'Life Insurance': 'Life Insurance',
    'Manufacturing And Processing': 'Manufacturing And Processing',
    'Microfinance Index': 'Microfinance',
    'Mutual Fund': 'Mutual Fund',
    'Non Life Insurance': 'Non Life Insurance',
    'Others Index': 'Others',
    'Trading Index': 'Tradings',
}

# Sub-index name to symbol mapping
SUB_INDEX_SYMBOL_MAP = {
    'Banking SubIndex': 'BANKING',
    'Development Bank Index': 'DEVBANK',
    'Finance Index': 'FINANCE',
    'Hotels And Tourism Index': 'HOTEL',
    'HydroPower Index': 'HYDRO',
    'Investment Index': 'INVESTMENT',
    'Life Insurance': 'LIFE_INS',
    'Manufacturing And Processing': 'MANUFACTURING',
    'Microfinance Index': 'MICROFINANCE',
    'Mutual Fund': 'MUTUAL_FUND',
    'Non Life Insurance': 'NONLIFE_INS',
    'Others Index': 'OTHERS',
    'Trading Index': 'TRADING',
}


def fetch_all_companies() -> list:
    """
    Fetch ALL active companies from NEPSE API (via nepse-data-api library).
    
    This is the master source for ensuring all tradable securities exist in the database.
    Unlike get_stocks() which only returns actively traded stocks, this returns ALL
    active companies regardless of whether they traded today.
    
    Returns:
        list of dicts with company info:
            - id: NEPSE security ID
            - symbol: Stock symbol
            - name: Company full name
            - sector: Sector name
            - status: Active status ('A', 'S', 'D')
            - instrumentType: Type of instrument (e.g., 'Equity')
    """
    try:
        nepse = _get_nepse_client()
        
        # Fetch all companies
        all_companies = nepse.get_company_list()
        
        if not all_companies:
            logger.warning("get_company_list() returned empty list")
            return []
        
        # Filter for active companies only (status='A')
        active_companies = [
            {
                'id': comp.get('id'),
                'symbol': comp.get('symbol'),
                'name': comp.get('companyName', comp.get('securityName', comp.get('symbol'))),
                'sector': comp.get('sectorName'),
                'status': comp.get('status'),
                'instrumentType': comp.get('instrumentType', 'Equity'),
            }
            for comp in all_companies
            if comp.get('status') == 'A'  # Active only
        ]
        
        logger.info(f"Fetched {len(active_companies)} active companies (from {len(all_companies)} total)")
        return active_companies
        
    except Exception as e:
        logger.error(f"Failed to fetch company list from NEPSE API: {e}")
        return []


def fetch_market_data() -> dict:
    """
    Fetch ALL market data from NEPSE official API (via nepse-data-api library).
    Returns stocks, indices, and sub-indices data.

    Returns:
        dict with 'stocks', 'indices', and 'subIndices' keys
    """
    try:
        nepse = _get_nepse_client()
        from datetime import datetime

        # ------- 1. STOCKS (Hybrid: today-price + security details) -------
        # Strategy:
        # A. Fetch 'today-price' via manual POST (works when market OPEN and CLOSED)
        # B. Compare with 'company_list' to find non-traded stocks
        # C. Fetch 'security_details' for non-traded stocks
        
        stock_prices = {}
        
        # A. Fetch Traded Stocks (Today Price)
        try:
            url = f"{nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500"
            # 0 is the generic market ID
            payload_id = nepse._get_floorsheet_payload_id(0, datetime.now())
            payload = {"id": payload_id}
            
            response = nepse.session.post(url, headers=nepse._get_auth_headers(), json=payload)
            # Don't raise immediately, handle gracefully
            if response.status_code == 200:
                data = response.json()
                stocks_raw = data.get('content', data) if isinstance(data, dict) else data
            else:
                logger.warning(f"today-price endpoint returned {response.status_code}")
                # Fallback to standard get_stocks if manual post fails (though get_stocks might be empty)
                stocks_raw = nepse.get_stocks()
        except Exception as e:
            logger.warning(f"Failed to fetch today-price (manual): {e}")
            stocks_raw = nepse.get_stocks()
            
        # Process Traded Stocks
        for stock in (stocks_raw or []):
            symbol = stock.get('symbol')
            if not symbol: continue
            
            stock_prices[symbol] = {
                'ltp': safe_decimal(stock.get('lastTradedPrice') or stock.get('closePrice')),
                'change': safe_decimal(stock.get('diff', 0)) if 'diff' in stock else \
                         (safe_decimal(stock.get('lastTradedPrice', 0)) - safe_decimal(stock.get('previousDayClosePrice', 0) or stock.get('previousClose', 0))),
                'change_percent': safe_decimal(stock.get('percentageChange')),
                'open': safe_decimal(stock.get('openPrice')),
                'high': safe_decimal(stock.get('highPrice')),
                'low': safe_decimal(stock.get('lowPrice')),
                'volume': stock.get('totalTradedQuantity') or stock.get('totalTradeQuantity') or 0,
                'previous_close': safe_decimal(stock.get('previousDayClosePrice') or stock.get('previousClose')),
                'transactions': stock.get('totalTrades') or 0,
                'turnover': safe_decimal(stock.get('totalTradedValue') or stock.get('totalTradeValue')),
                'last_updated': stock.get('lastUpdatedTime') or stock.get('lastUpdatedDateTime'),
                'source': 'live_hybrid'
            }



        # ------- 2. MAIN INDICES (get_nepse_index → live values) -------
        indices_raw = nepse.get_nepse_index()
        indices = {}

        for idx in (indices_raw or []):
            index_name = idx.get('index')
            if not index_name:
                continue

            symbol = MAIN_INDEX_SYMBOLS.get(index_name, index_name)

            indices[symbol] = {
                'name': index_name,
                'current_value': safe_decimal(idx.get('currentValue')),
                'change': safe_decimal(idx.get('change')),
                'change_percent': safe_decimal(idx.get('perChange')),
            }

        # ------- 3. SUB-INDICES (get_sub_indices → sector indices) -------
        sub_indices_raw = nepse.get_sub_indices()
        sub_indices = {}

        for idx in (sub_indices_raw or []):
            index_name = idx.get('index')
            if not index_name:
                continue

            symbol = SUB_INDEX_SYMBOL_MAP.get(index_name,
                        index_name.upper().replace(' ', '_'))
            sector = SUB_INDEX_SECTOR_MAP.get(index_name, index_name)

            sub_indices[symbol] = {
                'name': index_name,
                'current_value': safe_decimal(idx.get('currentValue')),
                'change': safe_decimal(idx.get('change')),
                'change_percent': safe_decimal(idx.get('perChange')),
                'sector': sector,
            }

        logger.info(
            f"Fetched {len(stock_prices)} stocks (Hybrid), "
            f"{len(indices)} indices, "
            f"{len(sub_indices)} sub-indices from NEPSE API"
        )

        return {
            'stocks': stock_prices,
            'indices': indices,
            'subIndices': sub_indices,
        }

    except Exception as e:
        logger.error(f"Failed to fetch from NEPSE API: {e}")
        return {'stocks': {}, 'indices': {}, 'subIndices': {}}


def fill_missing_stock_prices():
    """
    Fetch and update details for active stocks that have NO price data (newly added).
    This runs after the main update to 'heal' missing data without
    re-fetching dormant stocks that already have valid history.
    """
    from stocks_app.models import Stock
    nepse = _get_nepse_client()

    # Find active stocks with no price (or 0)
    missing_stocks = Stock.objects.filter(is_active=True, last_price__isnull=True) | \
                     Stock.objects.filter(is_active=True, last_price=0)
    
    count = missing_stocks.count()
    if count == 0:
        return

    logger.info(f"Refining data for {count} stocks with missing prices...")
    updated = 0

    for stock in missing_stocks:
        try:
            # security_id is needed. If missing, we can't fetch.
            if not stock.nepse_security_id:
                # Try to find ID from symbol map if possible (rare case)
                continue

            time.sleep(0.5) # Be gentle
            details = nepse.get_security_details(stock.nepse_security_id)
            sec_data = details.get('securityMcsData', {})

            if sec_data:
                # Update Stock directly
                ltp = safe_decimal(sec_data.get('lastTradedPrice') or sec_data.get('closePrice'))
                prev_close = safe_decimal(sec_data.get('previousClose'))
                
                stock.last_price = ltp
                stock.open_price = safe_decimal(sec_data.get('openPrice'))
                stock.high_price = safe_decimal(sec_data.get('highPrice'))
                stock.low_price = safe_decimal(sec_data.get('lowPrice'))
                stock.previous_close = prev_close
                stock.total_trade_quantity = 0 # Assume 0 if we are here (not in today-price)
                
                # Fix change calculation for dormant stocks
                if ltp > 0 and prev_close > 0:
                    stock.change = round(ltp - prev_close, 2)
                    stock.change_percent = round((stock.change / prev_close) * 100, 2)
                else:
                    stock.change = Decimal('0')
                    stock.change_percent = Decimal('0')
                
                stock.save(update_fields=[
                    'last_price', 'open_price', 'high_price', 'low_price', 
                    'previous_close', 'total_trade_quantity', 'change', 'change_percent'
                ])
                updated += 1
                
        except Exception as e:
            logger.warning(f"Failed to fill missing price for {stock.symbol}: {e}")

    logger.info(f"Filled prices for {updated}/{count} missing stocks")


# ===== ON-DEMAND CACHED FUNCTIONS (60s TTL + Throttling) =====

def _check_throttle(cache_key: str, delay_seconds: int = THROTTLE_DELAY) -> bool:
    """
    Check if request is throttled (too soon after last request).
    
    Returns:
        True if throttled (should deny request), False if allowed
    """
    last_request_time = cache.get(cache_key)
    if last_request_time:
        elapsed = time.time() - last_request_time
        if elapsed < delay_seconds:
            logger.debug(f"Throttled: {cache_key}, {delay_seconds - elapsed:.1f}s remaining")
            return True
    return False


def _set_throttle(cache_key: str, delay_seconds: int = THROTTLE_DELAY):
    """Mark this request time for throttling."""
    cache.set(cache_key, time.time(), delay_seconds)


def get_cached_market_depth(symbol: str, client_id: str = 'anonymous') -> dict:
    """
    Get market depth with 60-second cache and per-client throttling.
    
    Args:
        symbol: Stock symbol (e.g., 'NABIL')
        client_id: Unique client identifier (user ID or IP address)
    
    Returns:
        Market depth data with buy/sell orders
    """
    symbol = symbol.upper()
    cache_key = f"market_depth:{symbol}"
    throttle_key = f"throttle:market_depth:{client_id}:{symbol}"
    
    # Check throttle FIRST (before checking cache)
    # This prevents rapid successive requests even if cached
    if _check_throttle(throttle_key):
        # Return cached data if available, empty dict if not
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Market depth throttled but returning cached data for {symbol}")
            return cached
        else:
            logger.warning(f"Market depth throttled and no cache for {symbol}")
            return {'error': 'Please wait before requesting again', 'throttled': True}
    
    # Try cache
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug(f"Market depth cache HIT for {symbol}")
        _set_throttle(throttle_key)  # Set throttle even on cache hit
        return cached
    
    # Cache MISS - fetch from API
    logger.debug(f"Market depth cache MISS for {symbol}")
    nepse = _get_nepse_client()
    
    try:
        depth = nepse.get_market_depth(symbol)
        
        # Store in cache with smart TTL
        cache.set(cache_key, depth, _get_cache_ttl())
        
        # Set throttle
        _set_throttle(throttle_key)
        
        return depth
    except Exception as e:
        logger.error(f"Failed to fetch market depth for {symbol}: {e}")
        return {'error': str(e)}


def _format_today_price_data(s_symbol: str, stock_data: dict) -> dict:
    """Format a single stock record from the today-price API response."""
    ltp = safe_decimal(stock_data.get('closePrice') or stock_data.get('lastUpdatedPrice'))
    prev_close = safe_decimal(stock_data.get('previousDayClosePrice') or stock_data.get('previousClose'))
    
    change = round(ltp - prev_close, 2) if ltp and prev_close else safe_decimal(0)
    change_percent = round(float(change) / float(prev_close) * 100, 2) if prev_close else 0.0
    
    return {
        'symbol': s_symbol,
        'ltp': ltp,
        'change': change,
        'change_percent': change_percent,
        'open': safe_decimal(stock_data.get('openPrice')),
        'high': safe_decimal(stock_data.get('highPrice')),
        'low': safe_decimal(stock_data.get('lowPrice')),
        'volume': stock_data.get('totalTradedQuantity') or stock_data.get('totalTradeQuantity') or 0,
        'previous_close': prev_close,
        'turnover': safe_decimal(stock_data.get('totalTradedValue') or stock_data.get('totalTradeValue')),
        'last_updated': stock_data.get('lastUpdatedTime') or stock_data.get('lastUpdatedDateTime'),
        'source': 'live',
    }


def _sync_new_companies(new_symbols: set):
    """
    Called ONLY when a brand-new symbol is detected in today-price but not in DB.
    Fetches the full company list from NEPSE, finds the new companies,
    and stores them in the DB with all required fields (id, name, sector, etc.)

    This is the ONLY place get_company_list() is called at runtime.
    For initial setup, use: python manage.py sync_companies
    """
    from nepse_data_api.market import Nepse as FreshNepse
    from stocks_app.models import Stock, Sector

    logger.info(f"Syncing {len(new_symbols)} new company(s) to DB: {new_symbols}")
    try:
        nepse = FreshNepse(enable_cache=False)
        companies = nepse.get_company_list()

        # Build a lookup keyed by symbol for fast access
        company_map = {c.get('symbol'): c for c in companies if c.get('symbol') in new_symbols}

        for symbol in new_symbols:
            company = company_map.get(symbol)
            if not company:
                logger.warning(f"New symbol {symbol} not found in company list response.")
                continue

            # Get or create sector
            sector_name = company.get('sectorName') or 'Unknown'
            sector, _ = Sector.objects.get_or_create(name=sector_name)

            # Create the new stock record
            Stock.objects.get_or_create(
                symbol=symbol,
                defaults={
                    'name': company.get('companyName') or symbol,
                    'nepse_security_id': company.get('id') or company.get('securityId'),
                    'sector': sector,
                    'is_active': True,
                }
            )
            logger.info(f"New company added to DB: {symbol} — {company.get('companyName')}")

    except Exception as e:
        logger.error(f"Failed to sync new companies {new_symbols}: {e}")


def _refresh_global_stock_cache() -> dict:
    """
    3-Phase global stock cache refresh:

    Phase 1: Read active company symbols from DB (no API call — already stored).
    Phase 2: Bulk-fetch all prices from 'today-price'. Cache every stock found.
             Auto-detect new symbols not in DB → triggers a one-time sync for those.
    Phase 3: For active DB symbols NOT in today-price → fall back to DB values.

    get_company_list() is NEVER called here — only from sync_companies management
    command (initial setup) or when a brand-new symbol is auto-detected.

    Returns:
        dict: {symbol -> formatted_data} for all active companies
    """
    from datetime import datetime
    from nepse_data_api.market import Nepse as FreshNepse
    from stocks_app.models import Stock

    logger.info("Refreshing global stock cache (3-phase)...")
    results = {}

    # === PHASE 1: Read active symbols from DB (zero API calls) ===
    active_symbols = set(Stock.objects.filter(is_active=True).values_list('symbol', flat=True))
    logger.info(f"Phase 1: {len(active_symbols)} active companies from DB.")

    # === PHASE 2: Bulk-fetch from today-price ===
    today_price_symbols = set()
    try:
        phase2_nepse = FreshNepse(enable_cache=False)
        url = f"{phase2_nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500"
        payload_id = phase2_nepse._get_floorsheet_payload_id(0, datetime.now())
        payload = {"id": payload_id}

        response = phase2_nepse.session.post(url, headers=phase2_nepse._get_auth_headers(), json=payload)
        response.raise_for_status()
        data = response.json()

        prices = []
        if isinstance(data, dict) and 'content' in data:
            prices = data['content']
        elif isinstance(data, list):
            prices = data

        logger.info(f"Phase 2: today-price returned {len(prices)} stocks.")

        ttl = _get_cache_ttl()
        for stock_data in prices:
            s_symbol = stock_data.get('symbol')
            if not s_symbol:
                continue
            formatted = _format_today_price_data(s_symbol, stock_data)
            cache.set(f"stock_price:{s_symbol}", formatted, ttl)
            results[s_symbol] = formatted
            today_price_symbols.add(s_symbol)

        # Auto-detect new companies: symbol in today-price but NOT in DB
        new_symbols = today_price_symbols - active_symbols
        if new_symbols:
            logger.warning(f"Detected {len(new_symbols)} new symbol(s) not in DB: {new_symbols}. Triggering company sync...")
            _sync_new_companies(new_symbols)

    except Exception as e:
        logger.error(f"Phase 2 failed (today-price): {e}")

    # === PHASE 3: DB fallback for active symbols not in today-price ===
    missing_symbols = active_symbols - today_price_symbols
    if missing_symbols:
        logger.info(f"Phase 3: {len(missing_symbols)} active symbols not in today-price. Falling back to DB.")
        ttl = _get_cache_ttl()
        db_stocks = Stock.objects.filter(symbol__in=missing_symbols)
        for stock in db_stocks:
            s_symbol = stock.symbol
            formatted = {
                'symbol': s_symbol,
                'ltp': stock.last_price,
                'change': stock.change,
                'change_percent': stock.change_percent,
                'open': stock.open_price or stock.last_price,
                'high': stock.high_price or stock.last_price,
                'low': stock.low_price or stock.last_price,
                'volume': stock.total_trade_quantity,
                'previous_close': stock.previous_close,
                'turnover': stock.total_traded_value,
                'last_updated': None,
                'source': 'database',
            }
            cache.set(f"stock_price:{s_symbol}", formatted, ttl)
            results[s_symbol] = formatted

    logger.info(f"Global cache refresh complete. {len(results)} stocks cached.")
    return results


def get_cached_stock_price(symbol: str, client_id: str = 'anonymous') -> dict:
    """
    Get single stock price with clock-aligned cache and per-client throttling.
    On cache miss, triggers a full global refresh (all active companies populated at once).
    Falls back to database if API is unavailable.
    
    Args:
        symbol: Stock symbol (e.g., 'NABIL')
        client_id: Unique client identifier (user ID or IP address)
    
    Returns:
        Stock price data (ltp, change, volume, etc.)
    """
    from stocks_app.models import Stock
    
    symbol = symbol.upper()
    cache_key = f"stock_price:{symbol}"
    throttle_key = f"throttle:stock_price:{client_id}:{symbol}"
    
    # Check throttle (allow requests after default delay to prevent abuse)
    if _check_throttle(throttle_key):
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Stock price throttled but returning cached data for {symbol}")
            return cached
        else:
            logger.warning(f"Stock price throttled and no cache for {symbol}")
            return {'error': 'Please wait before requesting again', 'throttled': True}
    
    # Try cache first
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug(f"Stock price cache HIT for {symbol}")
        _set_throttle(throttle_key)
        return cached
    
    # Cache MISS — trigger global refresh (populates ALL active companies at once)
    logger.info(f"Cache MISS for {symbol}. Triggering global refresh...")
    all_results = _refresh_global_stock_cache()
    
    result = all_results.get(symbol)
    
    # Final fallback if symbol wasn't in either today-price or active list
    if result is None:
        try:
            stock = Stock.objects.get(symbol=symbol)
            result = {
                'symbol': symbol,
                'ltp': stock.last_price,
                'change': stock.change,
                'change_percent': stock.change_percent,
                'open': stock.open_price or stock.last_price,
                'high': stock.high_price or stock.last_price,
                'low': stock.low_price or stock.last_price,
                'volume': stock.total_trade_quantity,
                'previous_close': stock.previous_close,
                'turnover': stock.total_traded_value,
                'last_updated': None,
                'source': 'database',
            }
            logger.info(f"Final DB fallback for {symbol}")
            cache.set(cache_key, result, _get_cache_ttl())
        except Stock.DoesNotExist:
            return {'error': f'Stock {symbol} not found'}
    
    _set_throttle(throttle_key)
    return result

def get_cached_market_indices() -> list:
    """
    Get live market indices with smart caching.
    Fetches from NEPSE API if cache miss/stale, updates DB, and returns data.
    """
    from stocks_app.models import MarketIndex
    
    cache_key = "market_indices_live"
    cached = cache.get(cache_key)
    
    if cached:
        return cached
        
    # Cache MISS - fetch from API
    logger.info("Fetching live market indices from NEPSE...")
    nepse = _get_nepse_client()
    
    try:
        indices_data = nepse.get_market_index()
        
        # Live polling: only update values.
        # nepse_id, name, symbol are set once by sync_companies.
        updated_indices = []
        for item in indices_data:
            nepse_id = int(item['id']) if item.get('id') else None
            if not nepse_id:
                continue
            try:
                idx = MarketIndex.objects.get(nepse_id=nepse_id)
                idx.current_value = safe_decimal(item['currentValue'])
                idx.change = safe_decimal(item['change'])
                idx.change_percent = safe_decimal(item['perChange'])
                idx.save(update_fields=['current_value', 'change', 'change_percent', 'timestamp'])
            except MarketIndex.DoesNotExist:
                logger.warning(f"MarketIndex nepse_id={nepse_id} not in DB; run sync_companies.")
                continue

            updated_indices.append({
                'id': idx.id,
                'name': idx.name,
                'symbol': idx.symbol,
                'nepse_id': idx.nepse_id,
                'current_value': idx.current_value,
                'change': idx.change,
                'change_percent': idx.change_percent
            })
            
        # Sort by name to match view logic
        updated_indices.sort(key=lambda x: x['name'])
        
        # Cache result
        cache.set(cache_key, updated_indices, _get_cache_ttl())
        
        return updated_indices
        
    except Exception as e:
        logger.error(f"Failed to fetch live indices: {e}")
        # Fallback to DB
        indices = MarketIndex.objects.all().order_by('name')
        from stocks_app.serializers import MarketIndexSerializer
        return MarketIndexSerializer(indices, many=True).data


def get_cached_sub_indices() -> list:
    """
    Get live sub-indices (sectors) with smart caching.
    Fetches from NEPSE API if cache miss/stale, updates DB values only.
    nepse_id, name, symbol, sector are set once by sync_companies.
    """
    from stocks_app.models import SubIndex, Sector
    
    cache_key = "sub_indices_live"
    cached = cache.get(cache_key)
    
    if cached:
        return cached
        
    # Cache MISS - fetch from API
    logger.info("Fetching live sub-indices from NEPSE...")
    nepse = _get_nepse_client()
    
    try:
        sub_indices_data = nepse.get_sub_indices()
        
        # Live polling: ONLY update value fields.
        updated_subindices = []
        for item in sub_indices_data:
            nepse_id = int(item['id']) if item.get('id') else None
            if not nepse_id:
                continue
            try:
                sub = SubIndex.objects.get(nepse_id=nepse_id)
                sub.current_value = safe_decimal(item['currentValue'])
                sub.change = safe_decimal(item['change'])
                sub.change_percent = safe_decimal(item['perChange'])
                sub.save(update_fields=['current_value', 'change', 'change_percent', 'timestamp'])
            except SubIndex.DoesNotExist:
                logger.warning(f"SubIndex nepse_id={nepse_id} not in DB; run sync_companies.")
                continue
            
            updated_subindices.append({
                'id': sub.id,
                'name': sub.name,
                'symbol': sub.symbol,
                'nepse_id': sub.nepse_id,
                'current_value': sub.current_value,
                'change': sub.change,
                'change_percent': sub.change_percent,
                'sector': sub.sector.id if sub.sector else None
            })
            
        # Sort by name
        updated_subindices.sort(key=lambda x: x['name'])
        
        # Cache result
        cache.set(cache_key, updated_subindices, _get_cache_ttl())
        
        return updated_subindices
        
    except Exception as e:
        logger.error(f"Failed to fetch live sub-indices: {e}")
        # Fallback to DB
        subs = SubIndex.objects.select_related('sector').order_by('name')
        from stocks_app.serializers import SubIndexSerializer
        return SubIndexSerializer(subs, many=True).data




def update_all_market_data() -> dict:
    """
    Update database cache for ALL stocks and indices.

    Fetches fresh data from NEPSE API and updates:
    - Stock.last_price and related fields
    - MarketIndex values (NEPSE, Float, Sensitive)
    - SubIndex values (Banking, Hydropower, etc.)

    Returns:
        dict with counts of updated items
    """
    from stocks_app.models import Stock, MarketIndex, SubIndex

    logger.info("Starting market data update from NEPSE API...")

    # Fetch all data
    market_data = fetch_market_data()

    stock_prices = market_data.get('stocks', {})
    indices = market_data.get('indices', {})
    sub_indices = market_data.get('subIndices', {})

    if not stock_prices and not indices:
        logger.warning("No market data received from NEPSE API")
        return {'stocks': 0, 'indices': 0, 'subIndices': 0}

    stocks_updated = 0
    indices_updated = 0
    subindices_updated = 0

    # 1. Update stocks
    for stock in Stock.objects.filter(is_active=True):
        try:
            stock_data = stock_prices.get(stock.symbol)

            if stock_data:
                stock.last_price = stock_data['ltp']
                stock.change = stock_data['change']
                stock.change_percent = stock_data['change_percent']
                stock.open_price = stock_data['open']
                stock.high_price = stock_data['high']
                stock.low_price = stock_data['low']
                stock.previous_close = stock_data['previous_close']
                stock.total_trade_quantity = stock_data['volume'] or 0
                stock.total_traded_value = stock_data['turnover'] or Decimal('0')
                stock.total_trades = stock_data['transactions'] or 0
                stock.save(update_fields=[
                    'last_price', 'change', 'change_percent',
                    'open_price', 'high_price', 'low_price',
                    'previous_close', 'total_trade_quantity',
                    'total_traded_value', 'total_trades'
                ])
                stocks_updated += 1

        except Exception as e:
            logger.warning(f"Failed to update stock {stock.symbol}: {e}")
            continue

    # 2. Update main indices (NEPSE, Float, Sensitive)
    for market_idx in MarketIndex.objects.all():
        try:
            idx_data = indices.get(market_idx.symbol)

            if idx_data:
                market_idx.current_value = idx_data['current_value']
                market_idx.change = idx_data['change']
                market_idx.change_percent = idx_data['change_percent']
                market_idx.save(update_fields=['current_value', 'change', 'change_percent'])
                indices_updated += 1

        except Exception as e:
            logger.warning(f"Failed to update index {market_idx.symbol}: {e}")
            continue

    # 3. Update sub-indices (Banking, Hydropower, etc.)
    for sub_idx in SubIndex.objects.all():
        try:
            idx_data = sub_indices.get(sub_idx.symbol)

            if idx_data:
                sub_idx.current_value = idx_data['current_value']
                sub_idx.change = idx_data['change']
                sub_idx.change_percent = idx_data['change_percent']
                sub_idx.save(update_fields=['current_value', 'change', 'change_percent'])
                subindices_updated += 1

        except Exception as e:
            logger.warning(f"Failed to update sub-index {sub_idx.symbol}: {e}")
            continue

    # 4. Fill missing prices for new/empty stocks (Auto-heal)
    fill_missing_stock_prices()

    logger.info(f"Updated: {stocks_updated} stocks, {indices_updated} indices, {subindices_updated} sub-indices")
    return {'stocks': stocks_updated, 'indices': indices_updated, 'subIndices': subindices_updated}


def create_end_of_day_stock_prices(target_date=None) -> int:
    """
    Create permanent StockPrice records for all stocks (end-of-day snapshot).

    This should be called at 4:30 PM (after NEPSE market close at 3 PM).
    Creates one StockPrice record per stock per day.

    Args:
        target_date (datetime, optional): Date to tag the records with. Defaults to now.

    Returns:
        Number of StockPrice records created
    """
    from stocks_app.models import Stock, StockPrice

    # Use provided date or current time
    timestamp = target_date if target_date else timezone.now()
    logger.info(f"Creating end-of-day stock price records for {timestamp.date()}...")

    created_count = 0

    for stock in Stock.objects.filter(is_active=True):
        try:
            # Determine the best price to use
            closing_price = stock.last_price
            if not closing_price or closing_price == 0:
                closing_price = stock.previous_close or Decimal('0')
                
            if closing_price == 0:
                # Still 0? Skip or record 0?
                # If a stock has no price, we probably shouldn't record 0 history unless valid
                logger.debug(f"Skipping EOD for {stock.symbol} - no valid price")
                continue

            # Prepare data
            defaults = {
                'open': stock.open_price or closing_price,
                'high': stock.high_price or closing_price,
                'low': stock.low_price or closing_price,
                'close': closing_price,
                'volume': stock.total_trade_quantity,
                'timestamp': timestamp # Update timestamp to now if updating
            }
            
            # Check for existing record for this date
            record = StockPrice.objects.filter(
                stock=stock,
                timestamp__date=timestamp.date()
            ).first()

            if record:
                # Update existing
                for key, value in defaults.items():
                    setattr(record, key, value)
                record.save()
            else:
                # Create new
                StockPrice.objects.create(stock=stock, **defaults)

            # Update previous_close for tomorrow if we have a valid close
            if closing_price > 0:
                stock.previous_close = closing_price
                stock.save(update_fields=['previous_close'])

            created_count += 1

        except Exception as e:
            logger.error(f"Failed to create StockPrice for {stock.symbol}: {e}")
            continue

    logger.info(f"Processed EOD StockPrice records for {timestamp.date()} (Count: {created_count})")
    return created_count
