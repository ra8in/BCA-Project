from django.contrib import admin
from .models import PriceAlert, Notification

@admin.register(PriceAlert)
class PriceAlertAdmin(admin.ModelAdmin):
    list_display = ('user', 'stock', 'target_price', 'alert_type', 'is_active')
    list_filter = ('alert_type', 'is_active')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'message', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
