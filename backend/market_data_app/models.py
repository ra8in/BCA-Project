from django.db import models

class MarketStatus(models.Model):
    """Tracks if the market is currently open or closed."""
    is_open = models.BooleanField(default=False)
    message = models.CharField(max_length=255, default="Market is Closed")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Market Status"

    def __str__(self):
        status = "Open" if self.is_open else "Closed"
        return f"Market {status} - {self.updated_at.strftime('%Y-%m-%d %H:%M:%S')}"


class DataFetchLog(models.Model):
    """Audit log for background data fetching tasks."""
    STATUS_CHOICES = (
        ('SUCCESS', 'Success'),
        ('FAILURE', 'Failure'),
        ('WARNING', 'Warning'),
    )

    task_name = models.CharField(max_length=100)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    records_fetched = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.task_name} - {self.status} at {self.timestamp}"
