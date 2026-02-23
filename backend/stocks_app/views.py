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
            stock = Stock.objects.select_related('sector').get(symbol__iexact=symbol)
        except Stock.DoesNotExist:
            return Response({"error": "Stock not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Try to enrich with live cache data
        from stocks_app.services import get_cached_stock_price
        client_id = f"user_{request.user.id}" if request.user.is_authenticated else f"ip_{request.META.get('REMOTE_ADDR', 'unknown')}"
        live = get_cached_stock_price(symbol.upper(), client_id)
        
        # Build response with static metadata + live prices
        data = StockSerializer(stock).data
        if live and not live.get('error') and not live.get('throttled'):
            data['last_price'] = live.get('ltp', data['last_price'])
            data['change'] = live.get('change', data['change'])
            data['change_percent'] = live.get('change_percent', data['change_percent'])
            data['open_price'] = live.get('open', data.get('open_price'))
            data['high_price'] = live.get('high', data.get('high_price'))
            data['low_price'] = live.get('low', data.get('low_price'))
            data['total_trade_quantity'] = live.get('volume', data.get('total_trade_quantity'))
            data['total_traded_value'] = live.get('turnover', data.get('total_traded_value'))
            data['previous_close'] = live.get('previous_close', data.get('previous_close'))
        
        return Response(data)


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
    """List all sectors with stock count and nested subindex data (cached 1 hour)"""
    def get(self, request):
        from django.core.cache import cache as django_cache
        
        cached = django_cache.get('sector_list_full')
        if cached is not None:
            return Response(cached)
        
        sectors = Sector.objects.prefetch_related('subindex').annotate(
            stock_count=Count('stocks')
        ).order_by('name')
        
        serializer = SectorSerializer(sectors, many=True)
        data = serializer.data
        django_cache.set('sector_list_full', data, 3600)  # 1 hour TTL
        return Response(data)


class SubIndexListView(APIView):
    """List all sectoral sub-indices"""
    def get(self, request):
        from stocks_app.services import get_cached_sub_indices
        data = get_cached_sub_indices()
        return Response(data)


class MarketIndexListView(APIView):
    """List main market indices (NEPSE, Sensitive, Float, etc.)"""
    def get(self, request):
        from stocks_app.services import get_cached_market_indices
        data = get_cached_market_indices()
        return Response(data)


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


class MarketStatusView(APIView):
    """Return current market status (open/closed)"""
    def get(self, request):
        from .market_hours import get_market_status
        return Response(get_market_status())


class MarketDepthView(APIView):
    """
    GET /api/stocks/market-depth/<symbol>/
    
    Returns live market depth (top 5 buy/sell orders) with:
    - 60-second cache
    - 2-second per-client throttling
    """
    def get(self, request, symbol):
        from .services import get_cached_market_depth
        
        # Get client identifier (user ID if authenticated, else IP)
        if request.user.is_authenticated:
            client_id = f"user_{request.user.id}"
        else:
            # Get IP from X-Forwarded-For or REMOTE_ADDR
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                client_id = f"ip_{x_forwarded_for.split(',')[0].strip()}"
            else:
                client_id = f"ip_{request.META.get('REMOTE_ADDR', 'unknown')}"
        
        depth = get_cached_market_depth(symbol.upper(), client_id)
        
        # Check if throttled
        if depth.get('throttled'):
            return Response(
                depth,
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Check if error
        if 'error' in depth and not depth.get('marketDepth'):
            return Response(
                depth,
                status=status.HTTP_404_NOT_FOUND if 'not found' in depth.get('error', '').lower() else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(depth)


class LiveStockPriceView(APIView):
    """
    GET /api/stocks/live-price/<symbol>/
    
    Returns current stock price with:
    - 60-second cache
    - 2-second per-client throttling
    """
    def get(self, request, symbol):
        from .services import get_cached_stock_price
        
        # Get client identifier
        if request.user.is_authenticated:
            client_id = f"user_{request.user.id}"
        else:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                client_id = f"ip_{x_forwarded_for.split(',')[0].strip()}"
            else:
                client_id = f"ip_{request.META.get('REMOTE_ADDR', 'unknown')}"
        
        price_data = get_cached_stock_price(symbol.upper(), client_id)
        
        # Check if throttled
        if price_data.get('throttled'):
            return Response(
                price_data,
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Check if error
        if 'error' in price_data and 'symbol' not in price_data:
            return Response(
                price_data,
                status=status.HTTP_404_NOT_FOUND if 'not found' in price_data.get('error', '').lower() else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(price_data)


class StockHistoryView(APIView):
    """
    GET /api/stocks/history/<symbol>/
    
    Returns historical OHLCV data.
    Optional params:
    - from: YYYY-MM-DD (default: 30 days ago)
    - to: YYYY-MM-DD (default: today)
    """
    def get(self, request, symbol):
        from .models import StockPrice
        from .serializers import StockHistorySerializer
        from datetime import datetime, timedelta
        
        try:
            stock = Stock.objects.get(symbol__iexact=symbol)
        except Stock.DoesNotExist:
            return Response({"error": "Stock not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Date filtering
        to_date = request.query_params.get('to', datetime.now().date().isoformat())
        from_date = request.query_params.get('from', (datetime.now() - timedelta(days=30)).date().isoformat())
        
        prices = StockPrice.objects.filter(
            stock=stock,
            timestamp__date__range=[from_date, to_date]
        ).order_by('timestamp')
        
        serializer = StockHistorySerializer(prices, many=True)
        return Response(serializer.data)
