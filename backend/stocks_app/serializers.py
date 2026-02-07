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

    class Meta:
        model = Stock
        fields = ['id', 'symbol', 'name', 'sector_id', 'sector_name', 'last_price', 'change', 'change_percent', 'open_price', 'high_price', 'low_price', 'market_cap', 'total_trade_quantity', 'total_trades', 'total_traded_value', 'previous_close']
