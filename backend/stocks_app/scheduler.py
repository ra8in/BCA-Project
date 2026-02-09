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


def check_missed_eod_update():
    """
    Check if we missed the last EOD update (e.g., server was offline).
    If missed, run it now to backfill data.
    
    Logic:
    - If now > 4:30 PM: Check if Today's EOD exists. If not, run for Today.
    - If now < 11:00 AM: Check if Yesterday's (or last trading day's) EOD exists. If not, run for That Day.
    """
    from datetime import datetime, time, timedelta
    import pytz
    from stocks_app.services import update_all_market_data, create_end_of_day_stock_prices
    from stocks_app.models import StockPrice
    
    nepal_tz = pytz.timezone('Asia/Kathmandu')
    now = datetime.now(nepal_tz)
    
    # Define "Last Trading Session"
    target_date = None
    
    # 1. If it's evening (after 4:30 PM), we should have TODAY's data
    if now.time() > time(16, 30):
        if is_trading_day(): # Only if today was a trading day
            target_date = now
            
    # 2. If it's morning (before 9:00 AM), we should have YESTERDAY's data
    elif now.time() < time(9, 0):
        # Look back for the last trading day
        # Simple Logic: Check Yesterday. 
        # (Enhancement: Loop back to find last Friday if Monday morning)
        yesterday = now - timedelta(days=1)
        
        # Check if yesterday was a weekend (Fri=4, Sat=5)
        # If today is Sunday (6), Yesterday is Saturday (5) -> Skip?
        # NEPSE: Sunday is trading day. So Saturday is off.
        # If Today is Monday (0) -> Yesterday Sunday (6) -> Trading Day.
        # If Today is Sunday (6) -> Yesterday Saturday (5) -> Skip.
        
        # Let's verify if 'yesterday' was a trading day
        if yesterday.weekday() not in [4, 5]: # Not Fri/Sat
             target_date = yesterday
        elif yesterday.weekday() == 5: # Saturday -> Go back to Thursday?
             # If Yesterday was Saturday, stock market closed. Go back to Thursday?
             # Usually we only care about "Did we miss the LAST session?"
             # If today is Sunday, last session was Thursday.
             # This logic gets complex. Let's stick to "Check Yesterday" for now as requested ("tomorrow 8 am").
             pass

    if target_date:
        # Check if records exist for target_date AND were saved after 4:30 PM (complete EOD data)
        # If data was saved during trading hours, it's incomplete and needs refresh
        existing_records = StockPrice.objects.filter(timestamp__date=target_date.date())
        
        needs_update = False
        if not existing_records.exists():
            # No data at all
            needs_update = True
            print(f"⚠️  No EOD data found for {target_date.date()}.")
        else:
            # Check if the data was saved after 4:30 PM (complete EOD)
            # Get the timestamp of any record from that day
            sample_record = existing_records.first()
            saved_time = sample_record.timestamp.time()
            
            if saved_time < time(16, 30):
                # Data was saved during trading hours - incomplete, need refresh
                needs_update = True
                print(f"⚠️  EOD data for {target_date.date()} was saved at {saved_time.strftime('%H:%M')} (during trading). Refreshing...")
                # Delete incomplete records
                deleted_count = existing_records.delete()[0]
                print(f"🗑️  Deleted {deleted_count} incomplete records.")
            else:
                print(f"ℹ️  EOD data for {target_date.date()} already exists (saved at {saved_time.strftime('%H:%M')}). No catch-up needed.")
        
        if needs_update:
            logger.warning(f"Missed EOD update for {target_date.date()}. Running catch-up update now...")
            print(f"🔄 Fetching EOD data for {target_date.date()}...")
            try:
                # Fetch latest data (which should be the close of that day)
                update_all_market_data()
                
                # Create history record backdated to target_date
                created = create_end_of_day_stock_prices(target_date=target_date)
                print(f"✅ Catch-up update completed. Created {created} records for {target_date.date()}.")
                logger.info(f"Catch-up update completed. Created {created} records for {target_date.date()}.")
            except Exception as e:
                print(f"❌ Catch-up update failed: {e}")
                logger.error(f"Catch-up update failed: {e}")
    else:
        print(f"ℹ️  No catch-up needed (current time: {now.strftime('%H:%M')}, outside catch-up window 16:30-09:00)")


def delayed_catchup_check():
    """
    Wrapper to delay catch-up check until Django is fully ready.
    """
    import time
    time.sleep(3)  # Wait 3 seconds for Django to fully initialize
    print("🔄 Running catch-up check...")
    try:
        check_missed_eod_update()
    except Exception as e:
        print(f"❌ Catch-up check error: {e}")


def start_scheduler():
    """
    Initialize and start the APScheduler background scheduler.
    
    Should be called once when Django starts (in apps.py).
    Registers the end-of-day job to run at 4:30 PM Nepal time.
    Also checks for missed updates on startup.
    """
    # 1. Start the scheduled job
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
        
        # 2. Run catch-up logic (delayed to avoid database access during app init)
        import threading
        catchup_thread = threading.Thread(target=delayed_catchup_check, daemon=True)
        catchup_thread.start()
        
    except KeyboardInterrupt:
        logger.info("Stopping scheduler...")
        scheduler.shutdown()
        logger.info("Scheduler shut down successfully")
