"""
Management command to manually trigger end-of-day stock price update.

Usage:
    python manage.py run_eod_update
"""

from django.core.management.base import BaseCommand
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Manually trigger end-of-day stock price update (creates permanent StockPrice records)'

    def handle(self, *args, **options):
        """Execute the end-of-day update process."""
        
        self.stdout.write(self.style.WARNING('Starting end-of-day update...'))
        
        try:
            from stocks_app.tasks import run_end_of_day_update
            
            # Run the update
            created_count = run_end_of_day_update()
            
            self.stdout.write(self.style.SUCCESS(
                f'✓ End-of-day update completed successfully!'
            ))
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created {created_count} StockPrice records'
            ))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'✗ End-of-day update failed: {e}'
            ))
            logger.error(f"EOD update error: {e}", exc_info=True)
            raise
