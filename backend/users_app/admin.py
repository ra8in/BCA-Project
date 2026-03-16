from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db.models import Sum
from decimal import Decimal
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'virtual_balance', 'total_invested', 'total_current_value', 'total_unrealized_pl', 'total_realized_pl', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Paper Trading', {'fields': ('virtual_balance',)}),
    )

    def total_invested(self, obj):
        from portfolio_app.models import Holding
        holdings = Holding.objects.filter(user=obj)
        total = sum(h.average_buy_price * h.quantity for h in holdings)
        return f"Rs. {total:,.2f}"
    total_invested.short_description = 'Invested'

    def total_current_value(self, obj):
        from portfolio_app.models import Holding
        holdings = Holding.objects.filter(user=obj).select_related('stock')
        total = sum((h.stock.last_price or h.average_buy_price) * h.quantity for h in holdings)
        return f"Rs. {total:,.2f}"
    total_current_value.short_description = 'Current Value'

    def total_unrealized_pl(self, obj):
        from portfolio_app.models import Holding
        holdings = Holding.objects.filter(user=obj).select_related('stock')
        total = Decimal('0')
        for h in holdings:
            current = h.stock.last_price or h.average_buy_price
            total += (current - h.average_buy_price) * h.quantity
        color = 'green' if total >= 0 else 'red'
        return f"Rs. {total:,.2f}"
    total_unrealized_pl.short_description = 'Unrealized P/L'

    def total_realized_pl(self, obj):
        from trading_app.models import Transaction
        result = Transaction.objects.filter(user=obj, transaction_type='SELL').aggregate(total=Sum('realized_pl'))
        total = result['total'] or Decimal('0')
        return f"Rs. {total:,.2f}"
    total_realized_pl.short_description = 'Realized P/L'

from .models import MoneyRequest

@admin.register(MoneyRequest)
class MoneyRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'reason')
    readonly_fields = ('user', 'amount', 'reason', 'created_at')

    def get_readonly_fields(self, request, obj=None):
        """Lock all fields (including status) once a request is finalized."""
        readonly = list(self.readonly_fields)
        if obj and obj.status in ('Approved', 'Rejected'):
            readonly.append('status')
        return readonly

    def save_model(self, request, obj, form, change):
        if change and 'status' in form.changed_data:
            initial_status = form.initial.get('status')
            # Block changes from finalized states (should already be prevented by readonly)
            if initial_status in ('Approved', 'Rejected'):
                return  # Do nothing — status is locked
            # Only process Pending → Approved transition
            if obj.status == 'Approved':
                obj.user.virtual_balance += obj.amount
                obj.user.save()
            # Pending → Rejected: no balance change needed
        super().save_model(request, obj, form, change)

