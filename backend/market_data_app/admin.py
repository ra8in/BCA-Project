from django.contrib import admin
from .models import MarketStatus, DataFetchLog

@admin.register(MarketStatus)
class MarketStatusAdmin(admin.ModelAdmin):
    list_display = ('is_open', 'message', 'updated_at')
    readonly_fields = ('updated_at',)

    def has_add_permission(self, request):
        # Only allow one status record effectively (singleton pattern mostly)
        if MarketStatus.objects.exists():
            return False
        return True

@admin.register(DataFetchLog)
class DataFetchLogAdmin(admin.ModelAdmin):
    list_display = ('task_name', 'status', 'records_fetched', 'timestamp')
    list_filter = ('task_name', 'status', 'timestamp')
    search_fields = ('task_name', 'error_message')
    readonly_fields = ('timestamp',)
