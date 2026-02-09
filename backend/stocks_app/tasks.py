"""
Async tasks for stock price updates.

Uses threading for async execution (simple, no Celery required).
For production, replace with Celery tasks.
"""

import logging
import threading
from functools import wraps

logger = logging.getLogger(__name__)


def run_async(func):
    """
    Decorator to run a function asynchronously in a background thread.
    The function will execute without blocking the main request.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
        thread.start()
        logger.info(f"Started async task: {func.__name__}")
        return thread
    return wrapper


@run_async
def trigger_market_data_update():
    """
    Trigger an async update of all stock prices and indices in the database.
    
    Called after order placement to simulate a market data refresh.
    Runs in background thread, doesn't block the response.
    
    Usage:
        from stocks_app.tasks import trigger_market_data_update
        trigger_market_data_update()  # Non-blocking, returns immediately
    """
    try:
        from stocks_app.services import update_all_market_data
        
        logger.info("Market data update triggered...")
        result = update_all_market_data()
        logger.info(f"Market data update completed: {result['stocks']} stocks, {result['indices']} indices, {result['subIndices']} sub-indices")
        
    except Exception as e:
        logger.error(f"Market data update failed: {e}")


def run_end_of_day_update():
    """
    Run the end-of-day update synchronously.
    
    This should be called by a scheduler or management command at 4:30 PM.
    Creates permanent StockPrice records for historical data.
    
    Usage:
        python manage.py run_eod_update
        # or call from scheduler
    """
    try:
        from stocks_app.services import (
            update_all_market_data,
            create_end_of_day_stock_prices
        )
        
        logger.info("Starting end-of-day update...")
        
        # 1. Fetch latest prices for all stocks and indices
        update_all_market_data()
        
        # 2. Create permanent records
        created_count = create_end_of_day_stock_prices()
        
        logger.info(f"End-of-day update completed: {created_count} records created")
        return created_count
        
    except Exception as e:
        logger.error(f"End-of-day update failed: {e}")
        raise
