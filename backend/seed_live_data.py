#!/usr/bin/env python
"""
Seed database with LIVE data from NEPSE API (via nepse-data-api library).
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
from stocks_app.services import fetch_market_data, fetch_all_companies


def should_seed():
    """Check database status (informational only - seeding always proceeds)"""
    stock_count = Stock.objects.count()
    
    if stock_count > 0:
        print(f"ℹ️  Database currently has {stock_count} stocks.")
        print(f"   Will update existing and add any new active companies...")
    else:
        print("Database is empty. Proceeding with initial seed...")
    
    return True  # Always proceed


def seed_all_companies():
    """
    Seed ALL active companies from NEPSE API.
    
    This ensures all tradable securities exist in the database,
    regardless of whether they traded today.
    
    Returns:
        int: Number of companies created/updated
    """
    print("\n" + "=" * 60)
    print("STEP 1: ENSURING ALL ACTIVE COMPANIES EXIST")
    print("=" * 60)
    
    # Fetch all active companies
    companies = fetch_all_companies()
    
    if not companies:
        print("❌ ERROR: Failed to fetch company list from NEPSE API.")
        return 0
    
    print(f"✓ Fetched {len(companies)} active companies from NEPSE API")
    
    created_count = 0
    updated_count = 0
    
    for comp in companies:
        symbol = comp.get('symbol')
        if not symbol:
            continue
        
        # Get or create sector
        sector_name = comp.get('sector')
        sector = None
        if sector_name:
            sector, _ = Sector.objects.get_or_create(name=sector_name)
        
        # Create or update stock
        stock, created = Stock.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': comp.get('name', symbol),
                'nepse_security_id': comp.get('id'),
                'sector': sector,
                'is_active': True,  # All fetched companies are active
            }
        )
        
        if created:
            created_count += 1
        else:
            updated_count += 1
    
    print(f"\n✓ Company Sync Complete:")
    print(f"   - Created: {created_count} new stocks")
    print(f"   - Updated: {updated_count} existing stocks")
    print(f"   - Total: {len(companies)} active companies in database")
    
    return len(companies)


def seed_from_live_api():
    """
    Fetch live market data from NEPSE API and populate the database.
    
    Two-step process:
    1. Ensure ALL active companies exist (via get_company_list)
    2. Update prices for stocks that traded today (via get_today_price/get_stocks)
    
    Returns:
        bool: True if seeding was successful, False otherwise
    """
    print("\n" + "=" * 60)
    print("LIVE DATA SEEDING FROM NEPSE API")
    print("=" * 60)
    
    # STEP 1: Ensure all active companies exist
    total_companies = seed_all_companies()
    
    if total_companies == 0:
        print("\n❌ ERROR: Failed to fetch company list. Cannot proceed.")
        return False
    
    # STEP 2: Fetch today's trading data
    print("\n" + "=" * 60)
    print("STEP 2: UPDATING PRICES FOR TRADED STOCKS")
    print("=" * 60)
    
    market_data = fetch_market_data()
    
    stocks_data = market_data.get('stocks', {})
    indices_data = market_data.get('indices', {})
    subindices_data = market_data.get('subIndices', {})
    
    # If market is closed or no stocks traded, stocks_data will be empty
    # This is OK - we already ensured all companies exist in Step 1
    if not stocks_data:
        print("ℹ️  No trading data available (market may be closed)")
        print("   All active companies are in database with previous prices.")
    else:
        print(f"✓ Received trading data:")
        print(f"   - {len(stocks_data)} stocks with price updates")
    
    if indices_data:
        print(f"   - {len(indices_data)} main indices")
    if subindices_data:
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
    
    # ===== 2. SEED SUB-INDICES (Update existing only) =====
    print("\n2️⃣  Updating Sub-Indices...")
    subindices_updated = 0
    for symbol, sub_idx_data in subindices_data.items():
        try:
            # Only update existing SubIndices, don't create new ones
            # (to avoid OneToOne constraint issues with sector)
            updated_count = SubIndex.objects.filter(symbol=symbol).update(
                name=sub_idx_data.get('name', symbol),
                current_value=sub_idx_data.get('current_value', 0),
                change=sub_idx_data.get('change', 0),
                change_percent=sub_idx_data.get('change_percent', 0),
                timestamp=now
            )
            if updated_count:
                subindices_updated += 1
        except Exception as e:
            print(f"   ⚠️  Warning: Failed to update sub-index {symbol}: {e}")
            
    print(f"   ✓ Updated {subindices_updated} sub-indices")
    
    # ===== 3. UPDATE STOCK PRICES (for stocks that traded today) =====
    print("\n3️⃣  Updating Stock Prices...")
    stocks_updated = 0
    prices_created = 0
    
    for symbol, stock_data in stocks_data.items():
        try:
            # Stock should already exist from seed_all_companies()
            # Just update the price fields
            updated = Stock.objects.filter(symbol=symbol).update(
                last_price=stock_data.get('ltp', 0),
                change=stock_data.get('change', 0),
                change_percent=stock_data.get('change_percent', 0),
                open_price=stock_data.get('open', 0),
                high_price=stock_data.get('high', 0),
                low_price=stock_data.get('low', 0),
                previous_close=stock_data.get('previous_close', 0),
                total_trade_quantity=stock_data.get('volume', 0),
                total_traded_value=stock_data.get('turnover', 0),
                total_trades=stock_data.get('transactions', 0),
            )
            
            if updated:
                stocks_updated += 1
        except Exception as e:
            print(f"   ⚠️  Warning: Failed to update {symbol}: {e}")
            continue
        
        # Create historical price record
        try:
            # Fetch the stock instance to link the price record
            stock = Stock.objects.get(symbol=symbol)
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
    
    if stocks_data:
        print(f"   ✓ Updated prices for {stocks_updated} stocks")
        print(f"   ✓ Created {prices_created} price history records")
    else:
        print(f"   ℹ️  No price updates (market closed or no trading data)")
    
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
