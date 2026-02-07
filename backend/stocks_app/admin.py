from django.contrib import admin
from .models import Stock, Sector, StockPrice

@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')

@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'name', 'sector', 'last_price', 'is_active')
    search_fields = ('symbol', 'name')
    list_filter = ('sector', 'is_active')

@admin.register(StockPrice)
class StockPriceAdmin(admin.ModelAdmin):
    list_display = ('stock', 'close', 'timestamp', 'volume')
    list_filter = ('timestamp', 'stock')

from .models import MarketIndex

@admin.register(MarketIndex)
class MarketIndexAdmin(admin.ModelAdmin):
    list_display = ('name', 'symbol', 'current_value', 'change_percent')
