from rest_framework import serializers
from .models import PriceAlert, Notification
from stocks_app.models import Stock


class PriceAlertSerializer(serializers.ModelSerializer):
    stock_symbol = serializers.CharField(write_only=True)
    symbol = serializers.CharField(source='stock.symbol', read_only=True)
    stock_name = serializers.CharField(source='stock.name', read_only=True)
    current_price = serializers.DecimalField(source='stock.last_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PriceAlert
        fields = [
            'id', 'stock_symbol', 'symbol', 'stock_name', 'current_price',
            'target_price', 'alert_type', 'is_active', 'triggered_at', 'created_at'
        ]
        read_only_fields = ['id', 'symbol', 'stock_name', 'current_price', 'is_active', 'triggered_at', 'created_at']

    def validate_stock_symbol(self, value):
        try:
            Stock.objects.get(symbol__iexact=value)
        except Stock.DoesNotExist:
            raise serializers.ValidationError(f"Stock with symbol '{value}' not found.")
        return value.upper()

    def create(self, validated_data):
        stock_symbol = validated_data.pop('stock_symbol')
        stock = Stock.objects.get(symbol__iexact=stock_symbol)
        validated_data['stock'] = stock
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'notification_type', 'is_read', 'created_at']
        read_only_fields = ['id', 'message', 'notification_type', 'created_at']
