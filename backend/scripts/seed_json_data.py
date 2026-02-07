
import os
import sys
import json
import django
from datetime import datetime
from pathlib import Path
from django.utils.dateparse import parse_datetime

# Add backend directory to path so we can import django settings
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')
django.setup()

from stocks_app.models import Stock, Sector, StockPrice, MarketIndex

def run():
    print("Reading sharehub_home_data.json...")
    
    # Path to the JSON file - assuming it's in the project root or desktop
    json_path = Path('/home/rabin/Desktop/BCA_Project/sharehub_home_data.json')
    
    if not json_path.exists():
        print(f"Error: File not found at {json_path}")
        return

    with open(json_path, 'r') as f:
        data = json.load(f)

    # 1. Seed Indices
    print("Seeding Indices...")
    indices = data.get('indices', [])
    for idx in indices:
        MarketIndex.objects.update_or_create(
            symbol=idx['symbol'],
            defaults={
                'name': idx['name'],
                'current_value': idx['currentValue'],
                'change': idx['change'],
                'change_percent': idx['changePercent'],
                'sector': idx.get('sector')
            }
        )
    
    # 2. Seed SubIndices
    print("Seeding SubIndices...")
    sub_indices = data.get('subIndices', [])
    for idx in sub_indices:
        MarketIndex.objects.update_or_create(
            symbol=idx['symbol'],
            defaults={
                'name': idx['name'],
                'current_value': idx['currentValue'],
                'change': idx['change'],
                'change_percent': idx['changePercent'],
                'sector': idx.get('sector')
            }
        )

    # 3. Seed Stocks
    print("Seeding Stocks...")
    stocks_data = data.get('liveCompanyData', [])
    
    for item in stocks_data:
        # Get or Create Sector
        sector_name = item.get('sector')
        sector = None
        if sector_name:
            sector, _ = Sector.objects.get_or_create(name=sector_name)

        symbol = item['symbol']
        
        # Update or Create Stock
        # Note: Market Cap and Listed Shares are not in the JSON, so we leave them as is or default
        stock, created = Stock.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': item['securityName'],
                'sector': sector,
                'last_price': item['lastTradedPrice'],
                'is_active': True 
            }
        )
        
        # Create Stock Price History
        # Using lastUpdatedDateTime or current time
        
        # Format "2026-01-08 14:59:59.997288" needs to be parsed correctly
        # Django's parse_datetime handles ISO format well, but let's be careful with spaces
        date_str = item.get('lastUpdatedDateTime')
        if date_str:
            # Replace space with T if needed, parse_datetime expects ISO 8601
            # "2026-01-08 14:59:59.997288" -> "2026-01-08T14:59:59.997288"
            iso_date_str = date_str.replace(' ', 'T')
            timestamp = parse_datetime(iso_date_str)
        else:
            timestamp = datetime.now()

        # Update or create price entry for this exact timestamp/stock to avoid duplicates
        StockPrice.objects.update_or_create(
            stock=stock,
            timestamp=timestamp,
            defaults={
                'open': item.get('openPrice'),
                'high': item.get('highPrice'),
                'low': item.get('lowPrice'),
                'close': item.get('lastTradedPrice'), # close is LTP
                'volume': item.get('totalTradeQuantity')
            }
        )
        
    print(f"Successfully processed {len(stocks_data)} stocks.")

if __name__ == '__main__':
    run()
