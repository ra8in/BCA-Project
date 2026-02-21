
from django.core.management.base import BaseCommand
from stocks_app.models import Stock, StockPrice
from nepse_data_api.market import Nepse
from datetime import datetime, timedelta
import time
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Backfill stock price history for stocks with valid security IDs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days of history to fetch (default: 30)'
        )
        parser.add_argument(
            '--symbol',
            type=str,
            help='Specific stock symbol to backfill (optional)'
        )

    def handle(self, *args, **options):
        days = options['days']
        symbol = options.get('symbol')
        
        self.stdout.write(self.style.SUCCESS(f"Starting backfill for last {days} days..."))
        
        nepse = Nepse()
        
        # Filter stocks
        stocks = Stock.objects.exclude(nepse_security_id=None).filter(is_active=True)
        if symbol:
            stocks = stocks.filter(symbol=symbol.upper())
            
        count = stocks.count()
        if count == 0:
            self.stdout.write(self.style.WARNING("No matching active stocks with Security IDs found."))
            return

        self.stdout.write(f"Checking history for {count} stocks...")
        
        start_date = (datetime.now() - timedelta(days=days)).date()
        updated_stocks = 0
        total_records = 0
        
        for i, stock in enumerate(stocks):
            try:
                # Check recent history
                recent_count = StockPrice.objects.filter(
                    stock=stock,
                    timestamp__date__gte=start_date
                ).count()
                
                # If we have substantial data, skip unless force? 
                # Let's keep it simple: if > 5 records, skip to save time
                if recent_count >= min(days, 5): 
                    # self.stdout.write(f"Skipping {stock.symbol} - has data")
                    continue
                    
                self.stdout.write(f"[{i+1}/{count}] Fetching history for {stock.symbol}...")
                
                # Be gentle with API
                time.sleep(0.5)
                
                # Fetch history
                try:
                    history = nepse.get_historical_chart(
                        stock.nepse_security_id, 
                        start_date=start_date.strftime('%Y-%m-%d'),
                        end_date=datetime.now().strftime('%Y-%m-%d')
                    )
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"API Error for {stock.symbol}: {e}"))
                    continue
                
                if not history:
                    self.stdout.write(self.style.WARNING(f"No history found for {stock.symbol}"))
                    continue
                    
                # Save records
                records_created = 0
                for record in history:
                    date_str = record.get('businessDate')
                    if not date_str: continue
                        
                    record_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    # Avoid duplicates
                    if StockPrice.objects.filter(stock=stock, timestamp__date=record_date).exists():
                        continue
                        
                    StockPrice.objects.create(
                        stock=stock,
                        timestamp=datetime.combine(record_date, datetime.min.time()),
                        open=record.get('openPrice', 0),
                        high=record.get('highPrice', 0),
                        low=record.get('lowPrice', 0),
                        close=record.get('closePrice', 0),
                        volume=record.get('totalTradedQuantity') or record.get('volume') or 0
                    )
                    records_created += 1
                
                if records_created > 0:
                    self.stdout.write(self.style.SUCCESS(f"   ✓ Added {records_created} records for {stock.symbol}"))
                    updated_stocks += 1
                    total_records += records_created
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to process {stock.symbol}: {e}"))
                
        self.stdout.write(self.style.SUCCESS("="*50))
        self.stdout.write(self.style.SUCCESS(f"Backfill Complete!"))
        self.stdout.write(self.style.SUCCESS(f"Stocks updated: {updated_stocks}"))
        self.stdout.write(self.style.SUCCESS(f"Total records created: {total_records}"))
        self.stdout.write(self.style.SUCCESS("="*50))
