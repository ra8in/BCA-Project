from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Count
from .models import Stock, Sector, SubIndex, MarketIndex
from .serializers import StockSerializer, SectorSerializer, SubIndexSerializer, MarketIndexSerializer


class StockSearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
            
        terms = query.split()
        q_obj = Q()
        for term in terms:
            q_obj &= (Q(symbol__icontains=term) | Q(name__icontains=term))
            
        stocks = Stock.objects.filter(q_obj).filter(is_active=True)[:10]
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)


class StockDetailView(APIView):
    def get(self, request, symbol):
        try:
            stock = Stock.objects.get(symbol__iexact=symbol)
            serializer = StockSerializer(stock)
            return Response(serializer.data)
        except Stock.DoesNotExist:
            return Response({"error": "Stock not found"}, status=status.HTTP_404_NOT_FOUND)


class StockListView(APIView):
    def get(self, request):
        sector_id = request.query_params.get('sector')
        stocks = Stock.objects.filter(is_active=True)
        
        if sector_id:
            stocks = stocks.filter(sector_id=sector_id)
        
        stocks = stocks.order_by('symbol')
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)


class SectorListView(APIView):
    """List all sectors with stock count and nested subindex data"""
    def get(self, request):
        sectors = Sector.objects.prefetch_related('subindex').annotate(
            stock_count=Count('stocks')
        ).order_by('name')
        
        serializer = SectorSerializer(sectors, many=True)
        return Response(serializer.data)


class SubIndexListView(APIView):
    """List all sectoral sub-indices"""
    def get(self, request):
        subindices = SubIndex.objects.select_related('sector').order_by('name')
        serializer = SubIndexSerializer(subindices, many=True)
        return Response(serializer.data)


class MarketIndexListView(APIView):
    """List main market indices (NEPSE, Sensitive, Float, etc.)"""
    def get(self, request):
        indices = MarketIndex.objects.all().order_by('name')
        serializer = MarketIndexSerializer(indices, many=True)
        return Response(serializer.data)


from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100

class TopGainersView(APIView):
    """Top stocks by positive change percent"""
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        stocks = Stock.objects.filter(is_active=True, change_percent__gt=0).order_by('-change_percent')
        
        # Check if pagination is requested (if 'page' or 'limit' is present)
        # However, for Dashboard (legacy), we might want just list if no params.
        # But 'limit' logic is handled by pagination class if we use generics or manually paginate.
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(stocks, request)
            if page is not None:
                serializer = StockSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)
        
        # Default fallback for Dashboard: just return top 10 list
        stocks = stocks[:10]
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)


class TopLosersView(APIView):
    """Top stocks by negative change percent"""
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        stocks = Stock.objects.filter(is_active=True, change_percent__lt=0).order_by('change_percent')
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(stocks, request)
            if page is not None:
                serializer = StockSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)
                
        stocks = stocks[:10]
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)


class TopTurnoverView(APIView):
    """Top stocks by total traded value (Turnover)"""
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        stocks = Stock.objects.filter(is_active=True, total_traded_value__gt=0).order_by('-total_traded_value')
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(stocks, request)
            if page is not None:
                serializer = StockSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

        stocks = stocks[:10]
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)

