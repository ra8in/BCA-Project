from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from stocks_app.models import Stock


class WatchlistGroup(models.Model):
    """User can have multiple named watchlist groups."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watchlist_groups')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'name')
        ordering = ['created_at']
        
    def __str__(self):
        return f"{self.user.username}'s Watchlist: {self.name}"

class WatchlistItem(models.Model):
    """A stock in a watchlist group."""
    group = models.ForeignKey(WatchlistGroup, on_delete=models.CASCADE, related_name='items')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='watchlisted_by')
    notes = models.CharField(max_length=255, blank=True, null=True)
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('group', 'stock')
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.stock.symbol} in {self.group.name}"

class Holding(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='holdings')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='holders')
    quantity = models.PositiveIntegerField(default=0)
    average_buy_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    class Meta:
        unique_together = ('user', 'stock')
    
    def __str__(self):
        return f"{self.user.username} - {self.stock.symbol} ({self.quantity} shares)"



class PortfolioSnapshot(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='portfolio_history')
    timestamp = models.DateTimeField(auto_now_add=True)
    total_value = models.DecimalField(max_digits=15, decimal_places=2)
    cash_balance = models.DecimalField(max_digits=15, decimal_places=2)
    investment_value = models.DecimalField(max_digits=15, decimal_places=2)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.user.username} - {self.total_value} at {self.timestamp}"
