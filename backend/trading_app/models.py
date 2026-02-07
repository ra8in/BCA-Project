from django.conf import settings
from django.db import models
from stocks_app.models import Stock

class Order(models.Model):
    ORDER_TYPES = (
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
    )
    ORDER_MODES = (
        ('MARKET', 'Market'),
        ('LIMIT', 'Limit'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('EXECUTED', 'Executed'),
        ('CANCELLED', 'Cancelled'),
        ('REJECTED', 'Rejected'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='orders')
    order_type = models.CharField(max_length=4, choices=ORDER_TYPES)
    order_mode = models.CharField(max_length=6, choices=ORDER_MODES)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) # Limit Price
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.order_type} {self.quantity} {self.stock.symbol} ({self.status})"


class Transaction(models.Model):
    """Records executed trades with full financial details."""
    TRANSACTION_TYPES = (
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='transactions')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='transactions')
    order = models.OneToOneField(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='transaction')
    transaction_type = models.CharField(max_length=4, choices=TRANSACTION_TYPES)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)  # LTP at time of transaction
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)  # Price * Qty
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Total fees
    net_amount = models.DecimalField(max_digits=15, decimal_places=2)  # Amount after fees
    wacc_at_sell = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    realized_pl = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.transaction_type} {self.quantity} {self.stock.symbol}"
