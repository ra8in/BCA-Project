#!/usr/bin/env python
"""
Seed database with LIVE data from ShareHub API.
Run this on Docker startup to populate the database with real-time market data.
"""

import os
import sys
import django
from datetime import datetime
from django.utils.timezone import make_aware

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')
django.setup()

from stocks_app.models import Stock, Sector, SubIndex, StockPrice, MarketIndex
from stocks_app.services import fetch_market_data_from_sharehub


def should_seed():
    """Check if database is empty and needs seeding"""
    stock_count = Stock.objects.count()
    
    if stock_count > 0:
        print(f"✓ Database already has {stock_count} stocks. Skipping seed.")
        return False
    
    print("Database is empty. Proceeding with live data seed...")
    return True


def seed_from_live_api():
    """
    Fetch live market data from ShareHub API and populate the database.
    
    Returns:
        bool: True if seeding was successful, False otherwise
    """
    print("=" * 60)
    print("FETCHING LIVE MARKET DATA FROM SHAREHUB API")
    print("=" * 60)
    
    # Fetch live data using existing service
    market_data = fetch_market_data_from_sharehub()
    
    # Validate response
    if not market_data or not market_data.get('stocks'):
        print("❌ ERROR: Failed to fetch live data from ShareHub API.")
        print("   Database will be empty. Check network/API availability.")
        return False
    
    stocks_data = market_data.get('stocks', {})
    indices_data = market_data.get('indices', {})
    subindices_data = market_data.get('subIndices', {})
    
    print(f"\n📊 Received data:")
    print(f"   - {len(stocks_data)} stocks")
    print(f"   - {len(indices_data)} main indices")
    print(f"   - {len(subindices_data)} sub-indices")
    print()
    
    now = make_aware(datetime.now())
    
    # ===== 1. SEED MAIN MARKET INDICES =====
    print("1️⃣  Seeding Main Market Indices...")
    for symbol, idx_data in indices_data.items():
        MarketIndex.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': idx_data.get('name', symbol),
                'current_value': idx_data.get('current_value', 0),
                'change': idx_data.get('change', 0),
                'change_percent': idx_data.get('change_percent', 0),
                'timestamp': now
            }
        )
    print(f"   ✓ Seeded {len(indices_data)} main indices (NEPSE, Float, Sensitive, etc.)")
    
    # ===== 2. SEED SUB-INDICES AND SECTORS =====
    print("\n2️⃣  Seeding Sub-Indices and Sectors...")
    sectors_created = set()
    for symbol, sub_idx_data in subindices_data.items():
        sector_name = sub_idx_data.get('sector')
        sector = None
        
        if sector_name:
            sector, created = Sector.objects.get_or_create(name=sector_name)
            if created:
                sectors_created.add(sector_name)
        
        SubIndex.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': sub_idx_data.get('name', symbol),
                'sector': sector,
                'current_value': sub_idx_data.get('current_value', 0),
                'change': sub_idx_data.get('change', 0),
                'change_percent': sub_idx_data.get('change_percent', 0),
                'timestamp': now
            }
        )
    print(f"   ✓ Seeded {len(subindices_data)} sub-indices")
    print(f"   ✓ Created {len(sectors_created)} sectors")
    
    # ===== 3. SEED STOCKS =====
    print("\n3️⃣  Seeding Stocks and Price History...")
    stocks_created = 0
    prices_created = 0
    
    for symbol, stock_data in stocks_data.items():
        # Get or create stock
        stock, created = Stock.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': symbol,  # Will be updated if we have name data
                'last_price': stock_data.get('ltp', 0),
                'change': stock_data.get('change', 0),
                'change_percent': stock_data.get('change_percent', 0),
                'open_price': stock_data.get('open', 0),
                'high_price': stock_data.get('high', 0),
                'low_price': stock_data.get('low', 0),
                'previous_close': stock_data.get('previous_close', 0),
                'total_trade_quantity': stock_data.get('volume', 0),
                'total_traded_value': stock_data.get('turnover', 0),
                'total_trades': stock_data.get('transactions', 0),
                'is_active': True
            }
        )
        
        if created:
            stocks_created += 1
        
        # Create historical price record
        try:
            StockPrice.objects.create(
                stock=stock,
                timestamp=now,
                open=stock_data.get('open', stock_data.get('ltp', 0)),
                high=stock_data.get('high', stock_data.get('ltp', 0)),
                low=stock_data.get('low', stock_data.get('ltp', 0)),
                close=stock_data.get('ltp', 0),
                volume=stock_data.get('volume', 0)
            )
            prices_created += 1
        except Exception as e:
            print(f"   ⚠️  Warning: Could not create price history for {symbol}: {e}")
    
    print(f"   ✓ Seeded {len(stocks_data)} stocks ({stocks_created} new)")
    print(f"   ✓ Created {prices_created} price history records")
    
    # ===== SUMMARY =====
    print("\n" + "=" * 60)
    print("✅ LIVE DATA SEEDING COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print(f"Total Database Records:")
    print(f"  • Stocks: {Stock.objects.count()}")
    print(f"  • Sectors: {Sector.objects.count()}")
    print(f"  • Main Indices: {MarketIndex.objects.count()}")
    print(f"  • Sub-Indices: {SubIndex.objects.count()}")
    print(f"  • Price History: {StockPrice.objects.count()}")
    print("=" * 60)
    
    return True


def main():
    """Main entry point"""
    try:
        # Check if seeding is needed
        if not should_seed():
            return 0
        
        # Perform seeding
        success = seed_from_live_api()
        
        if success:
            print("\n🎉 Your Docker environment now has REAL market data!")
            return 0
        else:
            print("\n⚠️  Seeding failed. See errors above.")
            return 1
            
    except Exception as e:
        print(f"\n❌ FATAL ERROR during seeding: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
