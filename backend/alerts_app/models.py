from django.conf import settings
from django.db import models
from stocks_app.models import Stock

class PriceAlert(models.Model):
    ALERT_TYPES = (
        ('ABOVE', 'Above'),
        ('BELOW', 'Below'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='price_alerts')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='price_alerts')
    target_price = models.DecimalField(max_digits=10, decimal_places=2)
    alert_type = models.CharField(max_length=5, choices=ALERT_TYPES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    triggered_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.stock.symbol} {self.alert_type} {self.target_price}"

class Notification(models.Model):
    TYPE_CHOICES = (
        ('ALERT', 'Price Alert'),
        ('ORDER', 'Order Update'),
        ('SYSTEM', 'System Message'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    notification_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.notification_type} - {self.message[:20]}"
