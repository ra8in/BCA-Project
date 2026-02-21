from rest_framework import serializers
from .models import Stock, Sector, SubIndex, MarketIndex


class SubIndexSerializer(serializers.ModelSerializer):
    """Serializer for SubIndex - sectoral indices"""
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    
    class Meta:
        model = SubIndex
        fields = ['id', 'name', 'symbol', 'sector_name', 'current_value', 'change', 'change_percent']


class SectorSerializer(serializers.ModelSerializer):
    """Serializer for Sector with nested subindex data"""
    stock_count = serializers.IntegerField(read_only=True)
    subindex = SubIndexSerializer(read_only=True)
    
    class Meta:
        model = Sector
        fields = ['id', 'name', 'stock_count', 'subindex']


class MarketIndexSerializer(serializers.ModelSerializer):
    """Serializer for main market indices (NEPSE, Sensitive, etc.)"""
    class Meta:
        model = MarketIndex
        fields = ['id', 'name', 'symbol', 'current_value', 'change', 'change_percent']


class StockSerializer(serializers.ModelSerializer):
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    sector_id = serializers.IntegerField(source='sector.id', read_only=True)
    circuit_high = serializers.SerializerMethodField()
    circuit_low = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'symbol', 'name', 'sector_id', 'sector_name', 'last_price', 'change', 'change_percent', 'open_price', 'high_price', 'low_price', 'market_cap', 'total_trade_quantity', 'total_trades', 'total_traded_value', 'previous_close', 'circuit_high', 'circuit_low']

    def get_circuit_high(self, obj):
        from decimal import Decimal
        # Base price: Previous Close (or Last Price if missing)
        base = obj.previous_close if obj.previous_close and obj.previous_close > 0 else obj.last_price
        if base:
            # +10%, format to 1 decimal place (x.y)
            limit = base * Decimal('1.10')
            return float(format(limit, '.1f'))
        return None

    def get_circuit_low(self, obj):
        from decimal import Decimal
        # Base price: Previous Close (or Last Price if missing)
        base = obj.previous_close if obj.previous_close and obj.previous_close > 0 else obj.last_price
        if base:
            # -10%, format to 1 decimal place (x.y)
            limit = base * Decimal('0.90')
            return float(format(limit, '.1f'))
        return None


class StockHistorySerializer(serializers.ModelSerializer):
    """Serializer for OHLCV history data"""
    timestamp = serializers.DateTimeField(format="%Y-%m-%d")
    
    class Meta:
        from .models import StockPrice
        model = StockPrice
        fields = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
