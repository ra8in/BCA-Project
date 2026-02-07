
import os
import json
import django
from datetime import datetime
from django.utils.timezone import make_aware

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')
django.setup()

from stocks_app.models import Stock, Sector, SubIndex, StockPrice, MarketIndex

JSON_FILE_PATH = '../sharehub_home_data.json'

def parse_datetime(dt_str):
    if not dt_str:
        return make_aware(datetime.now())
    try:
        if 'T' in dt_str:
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        else:
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S.%f")
        return make_aware(dt)
    except Exception as e:
        print(f"Error parsing date {dt_str}: {e}")
        return make_aware(datetime.now())

def seed():
    print("Loading JSON data...")
    with open(JSON_FILE_PATH, 'r') as f:
        data = json.load(f)

    print("Seeding Market Indices, Sub-Indices, Sectors, and Stocks...")
    now = make_aware(datetime.now())

    # 1. Seed Main Market Indices (NEPSE, Sensitive, Float, etc.)
    indices = data.get('indices', [])
    for idx in indices:
        MarketIndex.objects.update_or_create(
            symbol=idx['symbol'],
            defaults={
                'name': idx['name'],
                'current_value': idx['currentValue'],
                'change': idx['change'],
                'change_percent': idx['changePercent'],
                'timestamp': now
            }
        )
    print(f"  - Seeded {len(indices)} Market Indices")

    # 2. Seed SubIndices (which also creates Sectors)
    subindices = data.get('subIndices', [])
    for sub_idx in subindices:
        sector_name = sub_idx.get('sector')
        if not sector_name:
            continue
            
        # Create or get the Sector
        sector, _ = Sector.objects.get_or_create(name=sector_name)
        
        # Create or update the SubIndex linked to this Sector
        SubIndex.objects.update_or_create(
            symbol=sub_idx['symbol'],
            defaults={
                'name': sub_idx['name'],
                'sector': sector,
                'current_value': sub_idx['currentValue'],
                'change': sub_idx['change'],
                'change_percent': sub_idx['changePercent'],
                'timestamp': now
            }
        )
    print(f"  - Seeded {len(subindices)} Sub-Indices & Sectors")

    # 3. Seed Stocks from liveCompanyData
    live_data = data.get('liveCompanyData', [])
    stock_count = 0
    for item in live_data:
        symbol = item['symbol']
        sector_name = item.get('sector')
        
        # Get or Create Sector
        sector = None
        if sector_name:
            sector, _ = Sector.objects.get_or_create(name=sector_name)

        # Get or Create Stock
        stock, created = Stock.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': item['securityName'],
                'sector': sector,
                'last_price': item['lastTradedPrice'],
                'change': item.get('change', 0),
                'change_percent': item.get('percentageChange', 0),
                # New fields mapping
                'total_trade_quantity': item.get('totalTradeQuantity', 0),
                'total_traded_value': item.get('totalTradeValue', 0),
                'previous_close': item.get('previousClose', 0),
                'open_price': item.get('openPrice', 0),
                'high_price': item.get('highPrice', 0),
                'low_price': item.get('lowPrice', 0),
                'total_trades': item.get('totalTransactions', 0)
            }
        )
        
        # Create StockPrice entry (History)
        ts = parse_datetime(item.get('lastUpdatedDateTime'))
        exists = StockPrice.objects.filter(stock=stock, timestamp=ts).exists()
        if not exists:
            StockPrice.objects.create(
                stock=stock,
                timestamp=ts,
                open=item['openPrice'],
                high=item['highPrice'],
                low=item['lowPrice'],
                close=item['lastTradedPrice'],
                volume=item.get('totalTradeQuantity', 0)
            )
        stock_count += 1

    print(f"  - Seeded {stock_count} Stocks and price points")
    print("Done!")

if __name__ == '__main__':
    seed()
