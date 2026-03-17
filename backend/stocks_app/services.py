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
from django.db.models import Q as models_Q
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
    """Get the appropriate cache TTL based on market session state machine."""
    from stocks_app.market_hours import get_market_state
    from datetime import datetime
    
    state = get_market_state()
    
    if state == "OPEN":
        # Align cache expiry to the start of the next minute (HH:MM:00)
        now = datetime.now()
        seconds_remaining = 60 - now.second
        return max(1, seconds_remaining)
        
    return MARKET_CLOSED_TTL


# ===== NEPSE API Client (nepse-data-api) =====
# Lazy singleton — one persistent session so NEPSE doesn't close the connection.
# Token refresh is handled by _nepse_request() on 401 (re-calls authenticate() in-place).
_nepse_client = None

def _get_nepse_client():
    """Get or create the Nepse API client (lazy singleton)."""
    global _nepse_client
    if _nepse_client is None:
        from nepse_data_api import Nepse
        _nepse_client = Nepse(cache_ttl=15, enable_cache=True)
    return _nepse_client


def _nepse_request(method: str, url: str, **kwargs):
    """
    Make a GET or POST to the NEPSE API via the singleton session.
    On 401 (expired WASM token), calls nepse.authenticate() to refresh
    the token IN-PLACE and retries ONCE — no new client, no new TCP connection.

    Args:
        method: 'get' or 'post'
        url:    full URL to call
        **kwargs: extra args forwarded to requests (json=, params=, etc.)

    Returns:
        requests.Response (already raise_for_status'd)
    """
    nepse = _get_nepse_client()
    for attempt in range(2):          # attempt 0 = normal, attempt 1 = after re-auth
        resp = getattr(nepse.session, method)(url, headers=nepse._get_auth_headers(), **kwargs)
        if resp.status_code == 401 and attempt == 0:
            logger.warning("NEPSE API returned 401 — refreshing WASM token and retrying...")
            nepse.authenticate()      # refreshes access_token on the singleton in-place
            continue
        resp.raise_for_status()
        return resp
    resp.raise_for_status()           # raise if still 401 after retry
    return resp


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

    Uses the singleton + _nepse_request() which auto-refreshes the token on 401.

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
        
        # A. Fetch Traded Stocks (Today Price) — with pagination
        # size=500 per page. If totalPages > 1, fetch remaining pages automatically.
        # NOTE: size>500 causes 401 from the NEPSE API — do NOT increase
        try:
            stocks_raw = []
            page = 0
            total_pages = 1  # will be updated from first response
            
            while page < total_pages:
                url = f"{nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500&page={page}"
                payload_id = nepse._get_floorsheet_payload_id(0, datetime.now())
                payload = {"id": payload_id}
                response = _nepse_request('post', url, json=payload)
                data = response.json()
                
                if isinstance(data, dict):
                    stocks_raw.extend(data.get('content', []))
                    total_pages = data.get('totalPages', 1)
                elif isinstance(data, list):
                    stocks_raw.extend(data)
                    break  # No pagination metadata in list response
                
                page += 1
            
            logger.info(f"Fetched {len(stocks_raw)} stocks from today-price ({total_pages} page(s))")
        except Exception as e:
            logger.warning(f"Failed to fetch today-price: {e}")
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

    Uses _nepse_request() which auto-refreshes the WASM token on 401 via the singleton.
    """
    from stocks_app.models import Stock

    # Find active stocks with no price (or 0)
    missing_stocks = list(Stock.objects.filter(is_active=True, last_price__isnull=True)) + \
                     list(Stock.objects.filter(is_active=True, last_price=0))

    count = len(missing_stocks)
    if count == 0:
        return

    logger.info(f"Refining data for {count} stocks with missing prices...")
    nepse = _get_nepse_client()
    updated = 0

    for stock in missing_stocks:
        try:
            if not stock.nepse_security_id:
                continue

            time.sleep(0.5)  # Be gentle with the API

            url = f"{nepse.BASE_URL}/api/nots/security/{stock.nepse_security_id}"
            response = _nepse_request('get', url)  # auto-refreshes on 401
            details = response.json()

            sec_data = details.get('securityMcsData', {})

            if sec_data:
                ltp = safe_decimal(sec_data.get('lastTradedPrice') or sec_data.get('closePrice'))
                prev_close = safe_decimal(sec_data.get('previousClose'))

                stock.last_price = ltp
                stock.open_price = safe_decimal(sec_data.get('openPrice'))
                stock.high_price = safe_decimal(sec_data.get('highPrice'))
                stock.low_price = safe_decimal(sec_data.get('lowPrice'))
                stock.previous_close = prev_close
                stock.total_trade_quantity = 0  # Assume 0 — not in today-price

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
            logger.warning(f"Error fetching security details for {stock.symbol} (id={stock.nepse_security_id}): {e}")

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
    Get market depth with 5-second cache and per-client throttling.
    Market depth is per-stock (cannot be batched), so we use a tighter
    5-second refresh window to keep the order book fresh.
    
    Args:
        symbol: Stock symbol (e.g., 'NABIL')
        client_id: Unique client identifier (user ID or IP address)
    
    Returns:
        Market depth data with buy/sell orders
    """
    DEPTH_CACHE_TTL = 5   # 5 seconds — order book changes fast
    DEPTH_THROTTLE = 5    # 5 seconds between requests per client per stock
    
    symbol = symbol.upper()
    cache_key = f"market_depth:{symbol}"
    throttle_key = f"throttle:market_depth:{client_id}:{symbol}"
    
    # Check throttle FIRST
    if _check_throttle(throttle_key):
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
        _set_throttle(throttle_key, DEPTH_THROTTLE)
        return cached
    
    # Cache MISS - fetch from NEPSE using sync_companies retry technique
    logger.debug(f"Market depth cache MISS for {symbol}")
    
    # Only fetch if market is OPEN
    from stocks_app.market_hours import get_market_state
    if get_market_state() != "OPEN":
        return {'error': 'Market is closed — no live order book', 'marketDepth': None}
    
    import time
    from datetime import datetime

    # Get company ID from DB (Stock.nepse_security_id) — no NEPSE API call needed,
    # sync_companies already stored the same ID that the NEPSE API would return.
    from stocks_app.models import Stock
    try:
        stock_obj = Stock.objects.get(symbol=symbol)
        company_id = stock_obj.nepse_security_id
    except Stock.DoesNotExist:
        return {'error': f'Symbol {symbol} not found in database'}
    
    if not company_id:
        return {'error': f'Symbol {symbol} has no NEPSE security ID — run sync_companies first'}

    # Use _nepse_request — auto-refreshes the singleton token on 401, no new client created
    nepse_client = _get_nepse_client()
    depth = None

    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(0.2 * attempt)

            payload_id = nepse_client._get_floorsheet_payload_id(company_id, datetime.now())
            url = f"{nepse_client.BASE_URL}/api/nots/nepse-data/marketdepth/{company_id}"
            payload = {"id": payload_id}

            try:
                response = _nepse_request('post', url, json=payload)  # auto-refreshes on 401
            except Exception:
                # POST not accepted — fall back to GET (also auto-refreshes on 401)
                response = _nepse_request('get', url)

            depth = response.json()

            buy = (depth or {}).get('marketDepth', {}).get('buyMarketDepthList')
            sell = (depth or {}).get('marketDepth', {}).get('sellMarketDepthList')
            if depth and (buy or sell):
                break

            logger.info(f"Market depth empty for {symbol} (attempt {attempt+1}/3). Retrying...")
            time.sleep(0.5)

        except Exception as conn_err:
            wait = 2 ** attempt
            logger.warning(f"Market depth attempt {attempt+1}/3 for {symbol}: {conn_err}. Waiting {wait}s...")
            time.sleep(wait)

    if depth and 'error' not in depth:
        cache.set(cache_key, depth, DEPTH_CACHE_TTL)
        _set_throttle(throttle_key, DEPTH_THROTTLE)
        return depth

    return depth or {'error': f'Could not fetch market depth for {symbol} after 3 attempts'}


def _format_today_price_data(s_symbol: str, stock_data: dict, prev_close_override=None) -> dict:
    """Format a single stock record from the today-price API response.
    
    Args:
        prev_close_override: If provided, use this as previous_close instead of
                             the unreliable NEPSE previousDayClosePrice field.
                             This should come from our own StockPrice.close table.
    """
    ltp = safe_decimal(stock_data.get('closePrice') or stock_data.get('lastUpdatedPrice'))
    
    # Priority: our own DB close > NEPSE API field
    if prev_close_override is not None:
        prev_close = safe_decimal(prev_close_override)
    else:
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
    from stocks_app.models import Stock, Sector

    logger.info(f"Syncing {len(new_symbols)} new company(s) to DB: {new_symbols}")
    try:
        nepse = _get_nepse_client()  # singleton — _nepse_request handles 401 refresh
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


def ensure_previous_close_snapshot():
    """
    Called once at startup (or once per trading day).
    Ensures Stock.previous_close is populated from NEPSE API
    for all active stocks that are missing it.

    Idempotent: skips if already done today (flag in Redis).
    """
    from stocks_app.models import Stock
    from datetime import date, datetime

    today_str = date.today().isoformat()
    flag_key = f"previous_close_snapshot_done:{today_str}"

    if cache.get(flag_key):
        logger.info("Previous close snapshot: already done today. Skipping.")
        return

    # Count how many active stocks are missing previous_close
    total_active = Stock.objects.filter(is_active=True).count()
    missing_count = Stock.objects.filter(
        is_active=True, previous_close__isnull=True
    ).count()
    zero_count = Stock.objects.filter(
        is_active=True, previous_close=Decimal('0')
    ).count()
    needs_fill = missing_count + zero_count

    if needs_fill == 0:
        logger.info(
            f"Previous close snapshot: all {total_active} stocks already have "
            f"previous_close. Marking done."
        )
        cache.set(flag_key, True, 86400)  # 24 hours
        return

    logger.info(
        f"Previous close snapshot: {needs_fill}/{total_active} stocks missing "
        f"previous_close (NULL={missing_count}, zero={zero_count}). "
        f"Fetching from NEPSE..."
    )

    try:
        nepse = _get_nepse_client()
        all_prices = []
        page, total_pages = 0, 1

        while page < total_pages:
            url = (
                f"{nepse.BASE_URL}/api/nots/nepse-data/today-price"
                f"?size=500&page={page}"
            )
            payload_id = nepse._get_floorsheet_payload_id(0, datetime.now())
            response = _nepse_request('post', url, json={"id": payload_id})
            page_data = response.json()

            if isinstance(page_data, dict):
                all_prices.extend(page_data.get('content', []))
                total_pages = page_data.get('totalPages', 1)
            elif isinstance(page_data, list):
                all_prices.extend(page_data)
                break
            page += 1

        # Build update map: symbol → previousDayClosePrice
        prev_map = {}
        for item in all_prices:
            sym = item.get('symbol')
            prev = (
                item.get('previousDayClosePrice')
                or item.get('previousClose')
            )
            if sym and prev:
                prev_map[sym] = safe_decimal(prev)

        # Bulk update stocks where previous_close is NULL or 0
        updated = 0
        stocks_to_fix = Stock.objects.filter(is_active=True).filter(
            models_Q(previous_close__isnull=True) | models_Q(previous_close=Decimal('0'))
        )
        for stock in stocks_to_fix:
            if stock.symbol in prev_map:
                stock.previous_close = prev_map[stock.symbol]
                stock.save(update_fields=['previous_close'])
                updated += 1

        logger.info(
            f"Previous close snapshot: updated {updated} stocks from NEPSE API."
        )
        cache.set(flag_key, True, 86400)  # Mark done for today

    except Exception as e:
        logger.error(
            f"Previous close snapshot failed: {e}. Will retry on next startup."
        )


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
    from stocks_app.models import Stock

    logger.info("Refreshing global stock cache (3-phase)...")
    results = {}

    # === STATE GATE: If market is CLOSED, skip all NEPSE API calls ===
    from stocks_app.market_hours import get_market_state
    market_state = get_market_state()
    
    # === PHASE 1: Read active symbols from DB (zero API calls) ===
    active_symbols = set(Stock.objects.filter(is_active=True).values_list('symbol', flat=True))
    logger.info(f"Phase 1: {len(active_symbols)} active companies from DB.")
    
    if market_state == "CLOSED":
        logger.info("Market is CLOSED. Skipping NEPSE API calls — serving DB prices.")
        ttl = MARKET_CLOSED_TTL
        
        # Stock.previous_close is the source of truth — set by the 4:30 PM EOD job
        # or by ensure_previous_close_snapshot() at startup.
        db_stocks = Stock.objects.filter(is_active=True)
        for stock in db_stocks:
            ltp = stock.last_price or Decimal('0')
            prev_close = stock.previous_close or Decimal('0')
            
            # Recompute change from true values
            if ltp > 0 and prev_close > 0:
                change = round(ltp - prev_close, 2)
                change_percent = round(float(change) / float(prev_close) * 100, 2)
            else:
                change = Decimal('0')
                change_percent = 0.0
            
            formatted = {
                'symbol': stock.symbol,
                'ltp': ltp,
                'change': change,
                'change_percent': change_percent,
                'open': stock.open_price or ltp,
                'high': stock.high_price or ltp,
                'low': stock.low_price or ltp,
                'volume': stock.total_trade_quantity,
                'previous_close': prev_close,
                'turnover': stock.total_traded_value,
                'last_updated': None,
                'source': 'database',
            }
            cache.set(f"stock_price:{stock.symbol}", formatted, ttl)
            results[stock.symbol] = formatted
        logger.info(f"CLOSED mode: Cached {len(results)} stocks from DB with {ttl}s TTL.")
        return results

    # === PHASE 2: Bulk-fetch from today-price (PAGINATED) ===
    # One NEPSE API call populates the shared server-side cache for ALL users.
    # size=500 per page. If totalPages > 1, automatically fetches all pages.
    # NOTE: size>500 causes 401 from the API — do NOT increase.
    # 5 retries with exponential backoff per page since this is the CORE data source.
    # If all retries fail, fall back to nepse.get_stocks() as last resort.
    today_price_symbols = set()
    try:
        phase2_nepse = _get_nepse_client()
        
        all_prices = []
        page = 0
        total_pages = 1  # updated from first response
        
        while page < total_pages:
            url = f"{phase2_nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500&page={page}"
            payload_id = phase2_nepse._get_floorsheet_payload_id(0, datetime.now())
            payload = {"id": payload_id}

            page_data = None
            last_error = None
            for attempt in range(5):
                try:
                    response = _nepse_request('post', url, json=payload)
                    resp_json = response.json()
                    if resp_json:
                        page_data = resp_json
                        if attempt > 0:
                            logger.info(f"today-price page {page} succeeded on attempt {attempt+1}/5")
                        break
                    logger.warning(f"today-price page {page} returned empty (attempt {attempt+1}/5). Retrying...")
                except Exception as attempt_err:
                    last_error = attempt_err
                    wait = min(2 ** attempt, 10)
                    logger.warning(f"today-price page {page} attempt {attempt+1}/5 failed: {attempt_err}. Waiting {wait}s...")
                    time.sleep(wait)
            
            if page_data is None:
                logger.error(f"today-price page {page} failed after 5 attempts (last: {last_error})")
                break
            
            if isinstance(page_data, dict):
                all_prices.extend(page_data.get('content', []))
                total_pages = page_data.get('totalPages', 1)
            elif isinstance(page_data, list):
                all_prices.extend(page_data)
                break  # No pagination in list response
            
            page += 1
        
        # Final fallback if we got nothing
        if not all_prices:
            logger.error(f"today-price returned 0 stocks. Falling back to get_stocks()...")
            try:
                fallback_stocks = phase2_nepse.get_stocks()
                if fallback_stocks:
                    all_prices = fallback_stocks
                    logger.info(f"get_stocks() fallback returned {len(all_prices)} stocks")
            except Exception as fb_err:
                logger.error(f"get_stocks() fallback also failed: {fb_err}")
        
        prices = all_prices
        logger.info(f"Phase 2: today-price returned {len(prices)} stocks ({total_pages} page(s)).")

        # Build previous_close map from Stock table (source of truth)
        # Stock.previous_close is set by the EOD job or ensure_previous_close_snapshot()
        prev_close_map = {
            s['symbol']: s['previous_close']
            for s in Stock.objects.filter(is_active=True).values('symbol', 'previous_close')
            if s['previous_close']
        }
        
        if prev_close_map:
            logger.info(f"Phase 2: Built prev_close map from Stock.previous_close for {len(prev_close_map)} stocks.")

        ttl = _get_cache_ttl()
        for stock_data in prices:
            s_symbol = stock_data.get('symbol')
            if not s_symbol:
                continue
            formatted = _format_today_price_data(s_symbol, stock_data, prev_close_override=prev_close_map.get(s_symbol))
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
        
        # Use Stock.previous_close directly (source of truth)
        db_stocks = Stock.objects.filter(symbol__in=missing_symbols)
        for stock in db_stocks:
            s_symbol = stock.symbol
            ltp = stock.last_price or Decimal('0')
            true_prev = stock.previous_close or Decimal('0')
            
            if ltp > 0 and true_prev > 0:
                change = round(ltp - true_prev, 2)
                change_pct = round(float(change) / float(true_prev) * 100, 2)
            else:
                change = Decimal('0')
                change_pct = 0.0
            
            formatted = {
                'symbol': s_symbol,
                'ltp': ltp,
                'change': change,
                'change_percent': change_pct,
                'open': stock.open_price or ltp,
                'high': stock.high_price or ltp,
                'low': stock.low_price or ltp,
                'volume': stock.total_trade_quantity,
                'previous_close': true_prev,
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


def _build_raw_results_from_db() -> dict:
    """
    Read Stock table directly as last-resort fallback.
    Used when cache miss + API refresh both fail.
    Always has data as long as sync_companies ran once.
    """
    from stocks_app.models import Stock
    results = {}
    for stock in Stock.objects.filter(is_active=True).only(
        'symbol', 'last_price', 'change', 'change_percent',
        'previous_close', 'open_price', 'high_price', 'low_price',
        'total_trade_quantity', 'total_traded_value'
    ):
        results[stock.symbol] = {
            'ltp': stock.last_price or Decimal('0'),
            'change': stock.change or Decimal('0'),
            'change_percent': stock.change_percent or Decimal('0'),
            'previous_close': stock.previous_close or Decimal('0'),
            'open': stock.open_price or stock.last_price or Decimal('0'),
            'high': stock.high_price or stock.last_price or Decimal('0'),
            'low': stock.low_price or stock.last_price or Decimal('0'),
            'volume': stock.total_trade_quantity or 0,
            'turnover': stock.total_traded_value or Decimal('0'),
            'source': 'database_fallback',
        }
    logger.info(f"_build_raw_results_from_db: loaded {len(results)} stocks from DB.")
    return results


def get_all_cached_stock_prices(client_id: str = 'anonymous') -> list:
    """
    Get all active stock prices from the global cache with a 3-layer fallback.
    GUARANTEE: Never returns an empty list as long as the DB has any stock data.

    Layer 1: Redis per-stock cache (fastest)
    Layer 2: DB direct read when cache is stale/empty (safe fallback)
    Layer 3: 24h stale Redis key (last-resort if DB is also unreachable)

    Returns:
        List of dicts matching StockSerializer JSON contract.
    """
    from stocks_app.models import Stock

    throttle_key = f"throttle:stock_prices_all:{client_id}"

    # Check throttle to prevent abuse
    if _check_throttle(throttle_key):
        cached_result = cache.get('all_stock_prices_mapped')
        if cached_result:
            return cached_result
        # Still throttled but no cached result — let it through

    _set_throttle(throttle_key)

    # Fetch fast metadata mapping from DB
    meta_qs = Stock.objects.filter(is_active=True).values('id', 'symbol', 'name', 'sector_id', 'sector__name')
    stock_meta = {m['symbol']: m for m in meta_qs}
    active_symbols = list(stock_meta.keys())

    cache_keys = [f"stock_price:{sym}" for sym in active_symbols]
    cached_data = cache.get_many(cache_keys)

    # If cache is missing ANY active stock (or completely expired)
    if len(cached_data) < len(active_symbols):
        logger.info(f"Global cache missing symbols. Triggering global refresh from get_all_cached_stock_prices...")
        raw_results = _refresh_global_stock_cache()
    else:
        raw_results = {k.split(':')[1]: v for k, v in cached_data.items()}

    # === LAYER 2: DB direct fallback ===
    # If cache/API returned empty OR all prices are zero (API returned nothing useful),
    # read directly from Stock DB table which always has the last known prices.
    all_zero = raw_results and all(
        (r.get('ltp') or 0) == 0 for r in raw_results.values()
    )
    if not raw_results or all_zero:
        logger.warning(
            "Cache returned empty/all-zero prices. "
            "Falling back to Stock DB table for guaranteed data..."
        )
        try:
            raw_results = _build_raw_results_from_db()
        except Exception as db_err:
            logger.error(f"DB fallback also failed: {db_err}")
            raw_results = {}

    # Map raw cache keys into StockSerializer contract
    from decimal import Decimal
    mapped_results = []

    for sym, m in stock_meta.items():
        c = raw_results.get(sym, {})

        # Calculate circuit breakers (same logic as StockSerializer)
        prev = c.get('previous_close', 0)
        ltp = c.get('ltp', 0)
        base = prev if prev and prev > 0 else ltp
        circuit_high = float(format(Decimal(str(base)) * Decimal('1.10'), '.1f')) if base else None
        circuit_low = float(format(Decimal(str(base)) * Decimal('0.90'), '.1f')) if base else None

        mapped_results.append({
            'id': m['id'],
            'symbol': sym,
            'name': m['name'],
            'sector': m['sector_id'],
            'sector_name': m['sector__name'],
            'last_price': ltp,
            'change': c.get('change', 0),
            'change_percent': c.get('change_percent', 0),
            'previous_close': prev,
            'open_price': c.get('open', 0),
            'high_price': c.get('high', 0),
            'low_price': c.get('low', 0),
            'total_trade_quantity': c.get('volume', 0),
            'total_traded_value': c.get('turnover', 0),
            'circuit_high': circuit_high,
            'circuit_low': circuit_low,
            'is_active': True
        })

    if mapped_results:
        # Primary cache (short-lived)
        cache.set('all_stock_prices_mapped', mapped_results, _get_cache_ttl())
        # === LAYER 3: 24h stale backup — survives Redis flushes and API outages ===
        cache.set('all_stock_prices_mapped:stale', mapped_results, 86400)
    else:
        # Last resort: serve stale data rather than an empty list
        stale = cache.get('all_stock_prices_mapped:stale')
        if stale:
            logger.warning("Serving 24h stale stock price data as absolute last resort.")
            return stale

    return mapped_results


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
        
    # Cache MISS — use singleton, _nepse_request() auto-refreshes token on 401
    logger.info("Fetching live market indices from NEPSE...")
    nepse = _get_nepse_client()

    try:
        url = f"{nepse.BASE_URL}/api/nots/nepse-index"
        response = _nepse_request('get', url)
        indices_data = response.json()
        
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
        
    # Cache MISS — use singleton, _nepse_request() auto-refreshes token on 401
    logger.info("Fetching live sub-indices from NEPSE...")
    nepse = _get_nepse_client()

    try:
        url = f"{nepse.BASE_URL}/api/nots"
        response = _nepse_request('get', url)
        sub_indices_data = response.json()
        
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
