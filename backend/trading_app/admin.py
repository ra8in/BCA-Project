from django.contrib import admin
from .models import Order, Transaction

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'order_type', 'stock', 'quantity', 'price', 'status', 'created_at')
    list_filter = ('status', 'order_type', 'user')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'stock', 'transaction_type', 'quantity', 'price', 'net_amount', 'realized_pl', 'created_at')
    list_filter = ('user', 'transaction_type', 'created_at')
    search_fields = ('user__username', 'stock__symbol')
