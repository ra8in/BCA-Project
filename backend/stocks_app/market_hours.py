"""
Market trading hours and trading day utilities.

NEPSE trading schedule:
- Trading days: Sunday to Thursday
- Trading hours: 11:00 AM to 3:00 PM Nepal time
- Closed: Friday, Saturday, and public holidays
"""

import pytz
from datetime import datetime, time


def is_market_open():
    """
    Check if NEPSE market is currently open for trading.
    
    Market hours: 11:00 AM - 3:00 PM Nepal time, Sunday-Thursday
    
    Returns:
        tuple: (bool: is_open, str: reason if closed)
    """
    nepal_tz = pytz.timezone('Asia/Kathmandu')
    now = datetime.now(nepal_tz)
    
    # Check if it's a weekend (Friday=4, Saturday=5)
    if now.weekday() in [4, 5]:
        day_name = 'Friday' if now.weekday() == 4 else 'Saturday'
        return False, f"Market is closed on {day_name}"
    
    # Check if it's within trading hours (11:00 AM - 3:00 PM)
    market_open = time(11, 0)   # 11:00 AM
    market_close = time(15, 0)  # 3:00 PM
    current_time = now.time()
    
    if current_time < market_open:
        return False, f"Market opens at 11:00 AM (current time: {now.strftime('%I:%M %p')})"
    elif current_time >= market_close:
        return False, f"Market closed at 3:00 PM (current time: {now.strftime('%I:%M %p')})"
    
    # TODO: Add public holiday checking
    # if is_public_holiday(now.date()):
    #     return False, "Market is closed for public holiday"
    
    return True, "Market is open"


def get_market_status():
    """
    Get detailed market status information.
    
    Returns:
        dict: Market status with is_open, message, current_time, next_open
    """
    is_open, message = is_market_open()
    nepal_tz = pytz.timezone('Asia/Kathmandu')
    now = datetime.now(nepal_tz)
    
    return {
        'is_open': is_open,
        'message': message,
        'current_time': now.strftime('%Y-%m-%d %I:%M %p'),
        'trading_hours': '11:00 AM - 3:00 PM',
        'trading_days': 'Sunday - Thursday'
    }
