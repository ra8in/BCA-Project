from django.db import models


class Sector(models.Model):
    """Category for stocks - e.g., 'Commercial Banks', 'Hydro Power'"""
    name = models.CharField(max_length=100, unique=True)
    nepse_id = models.IntegerField(null=True, blank=True, help_text="NEPSE Sub-Index ID for this sector")
    description = models.TextField(null=True, blank=True)
    
    def __str__(self):
        return self.name


class SubIndex(models.Model):
    """Sectoral Sub-Index - e.g., 'Banking' tracks 'Commercial Banks' sector"""
    name = models.CharField(max_length=100)  # e.g., "Banking"
    symbol = models.CharField(max_length=20, unique=True)  # e.g., "BANKING"
    nepse_id = models.IntegerField(null=True, blank=True, help_text="NEPSE API ID")
    sector = models.OneToOneField(Sector, on_delete=models.SET_NULL, related_name='subindex', null=True, blank=True)
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change_percent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    timestamp = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.symbol})"


class MarketIndex(models.Model):
    """Main Market Index - e.g., 'NEPSE', 'Sensitive', 'Float'"""
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20, unique=True)
    nepse_id = models.IntegerField(null=True, blank=True, help_text="NEPSE API ID")
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    timestamp = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Market Indices"

    def __str__(self):
        return f"{self.name} - {self.current_value}"


class Stock(models.Model):
    symbol = models.CharField(max_length=20, unique=True)
    nepse_security_id = models.IntegerField(null=True, blank=True, help_text="NEPSE API Security ID")
    name = models.CharField(max_length=255)
    sector = models.ForeignKey(Sector, on_delete=models.CASCADE, related_name='stocks', null=True, blank=True)
    market_cap = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    listed_shares = models.BigIntegerField(null=True, blank=True)
    last_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    change_percent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Detailed trading data
    open_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    high_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    low_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_trade_quantity = models.BigIntegerField(default=0, help_text="Total traded quantity (sharesTraded)")
    total_trades = models.BigIntegerField(default=0, help_text="Total number of transactions")
    total_traded_value = models.DecimalField(max_digits=20, decimal_places=2, default=0, help_text="Total turnover")
    previous_close = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.symbol} - {self.name}"


class StockPrice(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='price_history')
    timestamp = models.DateTimeField()
    open = models.DecimalField(max_digits=10, decimal_places=2)
    high = models.DecimalField(max_digits=10, decimal_places=2)
    low = models.DecimalField(max_digits=10, decimal_places=2)
    close = models.DecimalField(max_digits=10, decimal_places=2)
    volume = models.BigIntegerField(default=0)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['stock', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.close} at {self.timestamp}"
