import os
import sys
import django
from decimal import Decimal

# Setup Django Environment
sys.path.append('/home/rabin/Desktop/BCA_Project/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')
django.setup()

from stocks_app.models import Stock, Sector

def seed_data():
    print("Seeding Stock Data...")

    # Sectors
    sectors = {
        'Commercial Banks': ['NABIL', 'NICA', 'GBIME', 'EBL', 'SCB'],
        'Hydropower': ['HIDCL', 'API', 'AHPC', 'CHCL', 'SHPC'],
        'Life Insurance': ['NLIC', 'LICN', 'ALICL'],
        'Non-Life Insurance': ['NIL', 'SICL', 'PRIN'],
        'Others': ['NTC', 'NRIC']
    }

    # Common dummy prices
    prices = {
        'NABIL': 500, 'NICA': 420, 'GBIME': 210, 'EBL': 450, 'SCB': 510,
        'HIDCL': 180, 'API': 150, 'AHPC': 200, 'CHCL': 450, 'SHPC': 300,
        'NLIC': 600, 'LICN': 1200, 'ALICL': 550,
        'NIL': 800, 'SICL': 750, 'PRIN': 900,
        'NTC': 850, 'NRIC': 900
    }

    names = {
        'NABIL': 'Nabil Bank Limited', 'NICA': 'NIC Asia Bank Ltd.', 'GBIME': 'Global IME Bank', 
        'EBL': 'Everest Bank Limited', 'SCB': 'Standard Chartered Bank',
        'HIDCL': 'Hydroelectricity Investment & Dev. Co.', 'API': 'Api Power Company', 
        'AHPC': 'Arun Valley Hydropower', 'CHCL': 'Chilime Hydropower', 'SHPC': 'Sanima Mai Hydropower',
        'NLIC': 'Nepal Life Insurance Co.', 'LICN': 'Life Insurance Corp. Nepal', 'ALICL': 'Asian Life Insurance',
        'NIL': 'Neco Insurance', 'SICL': 'Shikhar Insurance', 'PRIN': 'Prabhu Insurance',
        'NTC': 'Nepal Doorsanchar Company', 'NRIC': 'Nepal Reinsurance Company'
    }

    for sector_name, symbols in sectors.items():
        sector, _ = Sector.objects.get_or_create(name=sector_name)
        print(f"Processing Sector: {sector_name}")
        
        for symbol in symbols:
            if not Stock.objects.filter(symbol=symbol).exists():
                name = names.get(symbol, f"{symbol} Limited")
                price = prices.get(symbol, 200)
                
                Stock.objects.create(
                    symbol=symbol,
                    name=name,
                    sector=sector,
                    market_cap=Decimal('10000000000'), # Dummy
                    listed_shares=10000000,
                    last_price=Decimal(price)
                )
                print(f"  + Created {symbol}")
            else:
                print(f"  . {symbol} exists")

    print("\nSeeding Complete!")

if __name__ == "__main__":
    seed_data()
