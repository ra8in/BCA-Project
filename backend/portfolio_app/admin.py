from django.contrib import admin
from .models import Holding, PortfolioSnapshot, WatchlistGroup, WatchlistItem

@admin.register(WatchlistGroup)
class WatchlistGroupAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'created_at')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')

@admin.register(WatchlistItem)
class WatchlistItemAdmin(admin.ModelAdmin):
    list_display = ('group', 'stock', 'added_at')
    list_filter = ('group__user', 'group')
    search_fields = ('stock__symbol', 'group__name')

@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ('user', 'stock', 'quantity', 'average_buy_price', 'current_price', 'unrealized_gain_loss')
    list_filter = ('user',)

    def current_price(self, obj):
        return obj.stock.last_price
    
    def unrealized_gain_loss(self, obj):
        if obj.stock.last_price:
            gain_loss = (obj.stock.last_price - obj.average_buy_price) * obj.quantity
            return f"Rs. {gain_loss:,.2f}"
        return "N/A"
    
    unrealized_gain_loss.short_description = 'Unrealized G/L'

@admin.register(PortfolioSnapshot)
class PortfolioSnapshotAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_value', 'timestamp')
    list_filter = ('user', 'timestamp')
