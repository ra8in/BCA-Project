from django.contrib import admin
from .models import Stock, Sector, StockPrice

@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ('get_nepse_id', 'name', 'get_subindex_value', 'get_subindex_change')

    def get_nepse_id(self, obj):
        return obj.nepse_id
    get_nepse_id.short_description = 'ID'

    def get_subindex_value(self, obj):
        return obj.subindex.current_value if hasattr(obj, 'subindex') else '-'
    get_subindex_value.short_description = 'Current Value'

    def get_subindex_change(self, obj):
        if not hasattr(obj, 'subindex'):
            return '-'
        return f"{obj.subindex.change} ({obj.subindex.change_percent}%)"
    get_subindex_change.short_description = 'Change'

@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'name', 'sector', 'last_price', 'previous_close', 'change', 'is_active')
    search_fields = ('symbol', 'name')
    list_filter = ('sector', 'is_active')



from .models import MarketIndex

@admin.register(MarketIndex)
class MarketIndexAdmin(admin.ModelAdmin):
    list_display = ('name', 'symbol', 'current_value', 'change_percent')
