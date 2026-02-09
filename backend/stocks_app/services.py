"""
Stock price services - ShareHub API client and price update utilities.

This module handles:
1. Fetching stock prices from ShareHub Nepal API
2. Updating all stock prices in the database (market data refresh)
"""

import logging
import requests
from decimal import Decimal
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)

# ShareHub API endpoint
SHAREHUB_API_URL = "https://sharehubnepal.com/live/api/v2/nepselive/home-page-data"


def safe_decimal(value, default=Decimal('0')) -> Decimal:
    """Safely convert a value to Decimal, returning default if it fails."""
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def fetch_market_data_from_sharehub() -> dict:
    """
    Fetch ALL market data from ShareHub Nepal API in one request.
    Returns stocks, indices, and sub-indices data.
    
    Returns:
        dict with 'stocks', 'indices', and 'subIndices' keys
    """
    try:
        response = requests.get(SHAREHUB_API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Extract stock data from liveCompanyData
        stock_prices = {}
        for stock in data.get('liveCompanyData', []):
            symbol = stock.get('symbol')
            if symbol:
                stock_prices[symbol] = {
                    'ltp': safe_decimal(stock.get('lastTradedPrice')),
                    'change': safe_decimal(stock.get('change')),
                    'change_percent': safe_decimal(stock.get('percentageChange')),
                    'open': safe_decimal(stock.get('openPrice')),
                    'high': safe_decimal(stock.get('highPrice')),
                    'low': safe_decimal(stock.get('lowPrice')),
                    'volume': stock.get('totalTradeQuantity') or 0,
                    'previous_close': safe_decimal(stock.get('previousClose')),
                    'transactions': stock.get('totalTransactions') or 0,
                    'turnover': safe_decimal(stock.get('totalTradeValue')),
                }
        
        # Extract main indices (NEPSE, Float, Sensitive, etc.)
        indices = {}
        for idx in data.get('indices', []):
            symbol = idx.get('symbol')
            if symbol:
                indices[symbol] = {
                    'name': idx.get('name'),
                    'current_value': safe_decimal(idx.get('currentValue')),
                    'change': safe_decimal(idx.get('change')),
                    'change_percent': safe_decimal(idx.get('changePercent')),
                }
        
        # Extract sub-indices (Banking, Hydropower, etc.)
        sub_indices = {}
        for idx in data.get('subIndices', []):
            symbol = idx.get('symbol')
            if symbol:
                sub_indices[symbol] = {
                    'name': idx.get('name'),
                    'current_value': safe_decimal(idx.get('currentValue')),
                    'change': safe_decimal(idx.get('change')),
                    'change_percent': safe_decimal(idx.get('changePercent')),
                    'sector': idx.get('sector'),
                }
        
        logger.info(f"Fetched {len(stock_prices)} stocks, {len(indices)} indices, {len(sub_indices)} sub-indices")
        
        return {
            'stocks': stock_prices,
            'indices': indices,
            'subIndices': sub_indices
        }
        
    except requests.RequestException as e:
        logger.error(f"Failed to fetch from ShareHub API: {e}")
        return {'stocks': {}, 'indices': {}, 'subIndices': {}}
    except Exception as e:
        logger.error(f"Error parsing ShareHub API response: {e}")
        return {'stocks': {}, 'indices': {}, 'subIndices': {}}


def update_all_market_data() -> dict:
    """
    Update database cache for ALL stocks and indices.
    
    Fetches fresh data from ShareHub API and updates:
    - Stock.last_price and related fields
    - MarketIndex values (NEPSE, Float, Sensitive)
    - SubIndex values (Banking, Hydropower, etc.)
    
    Returns:
        dict with counts of updated items
    """
    from stocks_app.models import Stock, MarketIndex, SubIndex
    
    logger.info("Starting market data update from ShareHub API...")
    
    # Fetch all data in one API call
    market_data = fetch_market_data_from_sharehub()
    
    stock_prices = market_data.get('stocks', {})
    indices = market_data.get('indices', {})
    sub_indices = market_data.get('subIndices', {})
    
    if not stock_prices and not indices:
        logger.warning("No market data received from ShareHub API")
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
    
    logger.info(f"Updated: {stocks_updated} stocks, {indices_updated} indices, {subindices_updated} sub-indices")
    return {'stocks': stocks_updated, 'indices': indices_updated, 'subIndices': subindices_updated}


def create_end_of_day_stock_prices() -> int:
    """
    Create permanent StockPrice records for all stocks (end-of-day snapshot).
    
    This should be called at 4:30 PM (after NEPSE market close at 3 PM).
    Creates one StockPrice record per stock per day.
    
    Returns:
        Number of StockPrice records created
    """
    from stocks_app.models import Stock, StockPrice
    
    logger.info("Creating end-of-day stock price records...")
    today = timezone.now()
    created_count = 0
    
    for stock in Stock.objects.filter(is_active=True):
        try:
            # Check if we already have a record for today
            existing = StockPrice.objects.filter(
                stock=stock,
                timestamp__date=today.date()
            ).exists()
            
            if existing:
                logger.debug(f"StockPrice for {stock.symbol} already exists today")
                continue
            
            # Create permanent record
            StockPrice.objects.create(
                stock=stock,
                timestamp=today,
                open=stock.open_price or stock.last_price,
                high=stock.high_price or stock.last_price,
                low=stock.low_price or stock.last_price,
                close=stock.last_price,
                volume=stock.total_trade_quantity
            )
            
            # Update previous_close for tomorrow
            stock.previous_close = stock.last_price
            stock.save(update_fields=['previous_close'])
            
            created_count += 1
            
        except Exception as e:
            logger.error(f"Failed to create StockPrice for {stock.symbol}: {e}")
            continue
    
    logger.info(f"Created {created_count} end-of-day StockPrice records")
    return created_count
