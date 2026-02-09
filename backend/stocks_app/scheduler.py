"""
APScheduler configuration for automatic end-of-day stock price updates.

This module configures a background scheduler to run daily at 4:30 PM Nepal time.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler import util

logger = logging.getLogger(__name__)


def is_trading_day():
    """
    Check if today is a NEPSE trading day.
    
    NEPSE is closed on:
    - Friday (day 4)
    - Saturday (day 5)
    - Public holidays (TODO: implement holiday calendar)
    
    Returns:
        bool: True if trading day, False otherwise
    """
    from datetime import datetime
    import pytz
    
    nepal_tz = pytz.timezone('Asia/Kathmandu')
    now = datetime.now(nepal_tz)
    
    # Check if it's Friday (4) or Saturday (5)
    # In Python: Monday=0, Sunday=6
    if now.weekday() in [4, 5]:  # Friday or Saturday
        logger.info(f"Skipping EOD update: Today is {'Friday' if now.weekday() == 4 else 'Saturday'} (NEPSE closed)")
        return False
    
    # TODO: Add public holiday checking
    # You could:
    # 1. Check a database table of holidays
    # 2. Call a holiday API
    # 3. Maintain a hardcoded list
    
    return True


@util.close_old_connections
def run_eod_job():
    """
    Scheduled job to create end-of-day stock price snapshots.
    
    This function is called automatically at 4:30 PM Nepal time daily.
    Creates permanent StockPrice records for historical data.
    """
    
    # Skip if not a trading day
    if not is_trading_day():
        return
    
    try:
        from stocks_app.services import update_all_market_data, create_end_of_day_stock_prices
        
        logger.info("=" * 60)
        logger.info("SCHEDULED EOD UPDATE STARTED")
        logger.info("=" * 60)
        
        # 1. Fetch latest prices from ShareHub API
        result = update_all_market_data()
        logger.info(f"Updated market data: {result['stocks']} stocks, {result['indices']} indices, {result['subIndices']} sub-indices")
        
        # 2. Create permanent historical records
        created = create_end_of_day_stock_prices()
        logger.info(f"Created {created} end-of-day StockPrice records")
        
        logger.info("=" * 60)
        logger.info("SCHEDULED EOD UPDATE COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Scheduled EOD update failed: {e}", exc_info=True)


def start_scheduler():
    """
    Initialize and start the APScheduler background scheduler.
    
    Should be called once when Django starts (in apps.py).
    Registers the end-of-day job to run at 4:30 PM Nepal time.
    """
    scheduler = BackgroundScheduler(timezone='Asia/Kathmandu')
    scheduler.add_jobstore(DjangoJobStore(), "default")
    
    # Schedule EOD job for 4:30 PM Nepal time on trading days only
    # NEPSE trading days: Sunday-Thursday (day_of_week: sun,mon,tue,wed,thu)
    scheduler.add_job(
        run_eod_job,
        trigger=CronTrigger(
            day_of_week='sun,mon,tue,wed,thu',  # Sunday to Thursday only
            hour=16, 
            minute=30, 
            timezone='Asia/Kathmandu'
        ),
        id='eod_stock_price_update',
        max_instances=1,
        replace_existing=True,
        name='End-of-Day Stock Price Update'
    )
    
    logger.info("APScheduler started - EOD job scheduled for 4:30 PM Nepal time (Sun-Thu)")
    
    try:
        scheduler.start()
        logger.info("APScheduler is running")
    except KeyboardInterrupt:
        logger.info("Stopping scheduler...")
        scheduler.shutdown()
        logger.info("Scheduler shut down successfully")
