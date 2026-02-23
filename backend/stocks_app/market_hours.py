"""
Market session state machine — API-driven, not clock-guessed.

Three states:
  UNKNOWN → Server just started, or pre-open check time (10:59 AM).
            Calls NEPSE market-open API once to resolve.
  OPEN    → Market confirmed open. Fetch today-price every 60s.
            Transitions to CLOSED at 3:00 PM NST (clock alarm, no API call).
  CLOSED  → Zero NEPSE API calls. Serve cached/DB prices.
            Transitions to UNKNOWN at 10:59 AM NST next day.
"""

import logging
import pytz
from datetime import datetime, time
from django.core.cache import cache

logger = logging.getLogger(__name__)

MARKET_STATE_KEY = "market_session_state"

# NEPSE trading schedule (for clock-based transitions only)
MARKET_OPEN_TIME = time(11, 0)    # 11:00 AM NST
MARKET_CLOSE_TIME = time(15, 0)   # 3:00 PM NST
PRE_OPEN_CHECK = time(10, 59)     # 10:59 AM NST — when to re-check API
NEPAL_TZ = pytz.timezone('Asia/Kathmandu')


def _get_now():
    """Get current Nepal time."""
    return datetime.now(NEPAL_TZ)


def _seconds_until(target_time):
    """Seconds from now until a target time today (or tomorrow if past)."""
    now = _get_now()
    target = now.replace(hour=target_time.hour, minute=target_time.minute,
                         second=0, microsecond=0)
    if target <= now:
        # Target already passed today — next occurrence is tomorrow
        from datetime import timedelta
        target += timedelta(days=1)
    return int((target - now).total_seconds())


def _call_market_open_api():
    """
    Call NEPSE market-open API exactly ONCE to resolve UNKNOWN state.
    Returns True if market is open, False otherwise.
    Has a 10-second timeout to prevent hanging when API is unreachable.
    """
    import signal
    
    def _timeout_handler(signum, frame):
        raise TimeoutError("NEPSE market-open API call timed out")
    
    try:
        # Set 10-second alarm
        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(10)
        
        try:
            from nepse_data_api.market import Nepse
            nepse = Nepse(enable_cache=False)
            result = nepse.get_market_status(use_cache=False)
            logger.info(f"NEPSE market-open API response: {result}")

            if isinstance(result, dict):
                return result.get('isOpen', False)
            return bool(result)
        finally:
            signal.alarm(0)  # Cancel the alarm
            signal.signal(signal.SIGALRM, old_handler)
            
    except Exception as e:
        logger.warning(f"market-open API unavailable ({type(e).__name__}: {e}), using clock fallback")
        # Fallback: use clock-based guess
        now = _get_now()
        weekday = now.weekday()
        current_time = now.time()
        # Friday=4, Saturday=5 are off in Nepal
        if weekday in [4, 5]:
            return False
        return MARKET_OPEN_TIME <= current_time < MARKET_CLOSE_TIME


def get_market_state():
    """
    Get the current market session state from the state machine.
    This is the SINGLE SOURCE OF TRUTH for all market open/closed decisions.

    Returns:
        str: 'OPEN', 'CLOSED', or 'UNKNOWN'
    """
    state = cache.get(MARKET_STATE_KEY)
    if state is not None:
        return state

    # No cached state — we're in UNKNOWN, resolve it now
    return _resolve_unknown_state()


def _resolve_unknown_state():
    """
    Resolve the UNKNOWN state by calling the market-open API once.
    Sets the cache with appropriate TTL so we never check again
    until the next natural transition.
    """
    is_open = _call_market_open_api()

    if is_open:
        # Market IS open — lock into OPEN state until 3:00 PM
        ttl = _seconds_until(MARKET_CLOSE_TIME)
        ttl = max(ttl, 1)  # Safety: minimum 1 second
        cache.set(MARKET_STATE_KEY, "OPEN", ttl)
        logger.info(f"State machine → OPEN (TTL: {ttl}s until 3:00 PM)")
        return "OPEN"
    else:
        # Market is CLOSED — lock into CLOSED state until 10:59 AM next check
        ttl = _seconds_until(PRE_OPEN_CHECK)
        ttl = max(ttl, 60)  # Minimum 1 minute to avoid tight loops
        cache.set(MARKET_STATE_KEY, "CLOSED", ttl)
        logger.info(f"State machine → CLOSED (TTL: {ttl}s until next 10:59 AM)")
        return "CLOSED"


def is_market_open():
    """
    Backward-compatible function.
    Returns (bool, str) tuple matching the old interface.
    """
    state = get_market_state()
    if state == "OPEN":
        return True, "Market is open"
    now = _get_now()
    return False, f"Market is closed (state: {state}, time: {now.strftime('%I:%M %p')})"


def get_market_status():
    """
    Get detailed market status — used by MarketStatusView API endpoint.
    """
    state = get_market_state()
    now = _get_now()

    return {
        'is_open': state == "OPEN",
        'state': state,
        'message': 'Market is open' if state == "OPEN" else f'Market is closed',
        'current_time': now.strftime('%Y-%m-%d %I:%M %p'),
        'trading_hours': '11:00 AM - 3:00 PM',
        'trading_days': 'Sunday - Thursday'
    }


def force_closed():
    """
    Force the state machine to CLOSED. Called by the EOD scheduler
    after writing StockPrice rows at 3:15 PM.
    """
    ttl = _seconds_until(PRE_OPEN_CHECK)
    ttl = max(ttl, 60)
    cache.set(MARKET_STATE_KEY, "CLOSED", ttl)
    logger.info(f"State machine FORCE → CLOSED by EOD scheduler (TTL: {ttl}s)")
