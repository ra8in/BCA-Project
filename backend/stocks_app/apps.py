from django.apps import AppConfig


class StocksConfig(AppConfig):
    name = 'stocks_app'
    default_auto_field = 'django.db.models.BigAutoField'
    
    def ready(self):
        """
        Called when app is ready. Start APScheduler here.
        
        Note: This may be called multiple times in development (auto-reload),
        so we use a flag to prevent duplicate scheduler starts.
        """
        import sys
        
        # Only start scheduler if running the server (not migrations, shell, etc.)
        # and not in a reloader subprocess
        if 'runserver' in sys.argv and not hasattr(self, '_scheduler_started'):
            try:
                from stocks_app.scheduler import start_scheduler
                start_scheduler()
                self.__class__._scheduler_started = True
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to start scheduler: {e}")

