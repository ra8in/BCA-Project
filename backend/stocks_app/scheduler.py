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
def run_market_close_job():
    """
    Scheduled job at EXACTLY 3:00 PM Nepal time on trading days.

    Two things happen:
    1. Force State Machine → CLOSED immediately (no stale OPEN-state data served).
    2. Fetch and SAVE today's final closing prices from NEPSE into the Stock table.
       This ensures the frontend shows today's actual closing prices (not old data)
       when the market is closed and DB values are being served.
    """
    if not is_trading_day():
        return

    try:
        logger.info("=" * 60)
        logger.info("3:00 PM MARKET CLOSE JOB STARTED")
        logger.info("=" * 60)

        # Step 1: Force state machine to CLOSED immediately
        from stocks_app.market_hours import force_closed
        force_closed()
        logger.info("Market state machine forced to CLOSED.")

        # Step 2: Save today's final prices into the Stock table (DB)
        from stocks_app.services import update_all_market_data
        result = update_all_market_data()
        logger.info(
            f"3PM close prices saved: {result['stocks']} stocks, "
            f"{result['indices']} indices, {result['subIndices']} sub-indices"
        )

        # Step 3: Clear per-stock and global caches so next request serves fresh DB data
        from django.core.cache import cache
        from stocks_app.models import Stock
        symbols = list(Stock.objects.filter(is_active=True).values_list('symbol', flat=True))
        keys_to_delete = [f"stock_price:{s}" for s in symbols]
        keys_to_delete += ['all_stock_prices_mapped', 'market_indices_live', 'sub_indices_live']
        cache.delete_many(keys_to_delete)
        logger.info(f"Cleared {len(keys_to_delete)} cache keys after 3PM close.")

        logger.info("=" * 60)
        logger.info("3:00 PM MARKET CLOSE JOB COMPLETED")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"3PM market close job failed: {e}", exc_info=True)


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

        # 1. Fetch latest prices from NEPSE API
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
            
            if saved_time < time(15, 0):
                # Data was saved during trading hours (before 3 PM)
                needs_update = True
                print(f"⚠️  EOD data for {target_date.date()} was saved at {saved_time.strftime('%H:%M')} (during trading). Refreshing...")
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

    # NEW: Ensure previous_close is populated before any cache request
    print("🔄 Ensuring Stock.previous_close is populated...")
    try:
        from stocks_app.services import ensure_previous_close_snapshot
        ensure_previous_close_snapshot()
    except Exception as e:
        print(f"❌ Previous close snapshot error: {e}")

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
    
    scheduler.add_job(
        run_market_close_job,
        trigger=CronTrigger(
            day_of_week='sun,mon,tue,wed,thu',
            hour=14,
            minute=58,  # 2:58 PM — 2 min before API shuts down at 3:00 PM
            timezone='Asia/Kathmandu'
        ),
        id='market_close_3pm',
        max_instances=1,
        replace_existing=True,
        name='Pre-Close Final Price Save (2:58 PM)'
    )

    scheduler.add_job(
        run_eod_job,
        trigger=CronTrigger(
            day_of_week='sun,mon,tue,wed,thu',
            hour=16,
            minute=30,
            timezone='Asia/Kathmandu'
        ),
        id='eod_stock_price_update',
        max_instances=1,
        replace_existing=True,
        name='End-of-Day Stock Price Update'
    )

    logger.info("APScheduler started:")
    logger.info("  - 3PM close: Save final prices + force CLOSED state (Sun-Thu)")
    logger.info("  - EOD update: 4:30 PM create StockPrice records (Sun-Thu)")
    
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
