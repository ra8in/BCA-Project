from rest_framework import serializers
from .models import Holding, PortfolioSnapshot, WatchlistGroup, WatchlistItem
from trading_app.models import Order, Transaction
from stocks_app.serializers import StockSerializer


class WatchlistItemSerializer(serializers.ModelSerializer):
    stock_details = StockSerializer(source='stock', read_only=True)
    stock_symbol = serializers.CharField(source='stock.symbol', read_only=True)

    class Meta:
        model = WatchlistItem
        fields = ['id', 'group', 'stock', 'stock_symbol', 'stock_details', 'notes', 'added_at']
        read_only_fields = ['added_at']

class WatchlistGroupSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    
    class Meta:
        model = WatchlistGroup
        fields = ['id', 'user', 'name', 'items_count', 'created_at']
        read_only_fields = ['user', 'created_at']

class OrderSerializer(serializers.ModelSerializer):
    stock_symbol = serializers.CharField(source='stock.symbol', read_only=True)
    realized_pl = serializers.DecimalField(source='transaction.realized_pl', max_digits=15, decimal_places=2, read_only=True, allow_null=True)
    net_amount = serializers.DecimalField(source='transaction.net_amount', max_digits=15, decimal_places=2, read_only=True, allow_null=True)
    fees = serializers.DecimalField(source='transaction.fees', max_digits=10, decimal_places=2, read_only=True, allow_null=True)


    class Meta:
        model = Order
        fields = ['id', 'stock_symbol', 'order_type', 'order_mode', 'quantity', 'price', 'status', 'created_at', 'realized_pl', 'net_amount', 'fees']

class HoldingSerializer(serializers.ModelSerializer):
    stock_symbol = serializers.CharField(source='stock.symbol', read_only=True)
    stock_name = serializers.CharField(source='stock.name', read_only=True)
    current_price = serializers.DecimalField(source='stock.last_price', max_digits=10, decimal_places=2, read_only=True)
    market_value = serializers.SerializerMethodField()
    profit_loss = serializers.SerializerMethodField()
    profit_loss_percent = serializers.SerializerMethodField()

    class Meta:
        model = Holding
        fields = [
            'id', 
            'stock_symbol', 
            'stock_name', 
            'quantity', 
            'average_buy_price',
            'current_price',
            'market_value',
            'profit_loss',
            'profit_loss_percent'
        ]
    
    def get_market_value(self, obj):
        current_price = obj.stock.last_price or obj.average_buy_price
        return float(current_price) * obj.quantity
    
    def get_profit_loss(self, obj):
        current_price = obj.stock.last_price or obj.average_buy_price
        market_value = float(current_price) * obj.quantity
        cost = float(obj.average_buy_price) * obj.quantity
        return market_value - cost
    
    def get_profit_loss_percent(self, obj):
        cost = float(obj.average_buy_price) * obj.quantity
        if cost == 0:
            return 0
        profit_loss = self.get_profit_loss(obj)
        return (profit_loss / cost) * 100


class PortfolioSummarySerializer(serializers.Serializer):
    cash_balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    invested_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    current_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_profit_loss = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_realized_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_profit_loss_percent = serializers.DecimalField(max_digits=10, decimal_places=2)
    holdings = HoldingSerializer(many=True)


class PortfolioSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioSnapshot
        fields = ['id', 'timestamp', 'total_value', 'cash_balance', 'investment_value']
