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
    """
    Return all active stocks with LIVE prices from the shared server-side cache.
    The cache is populated once by _refresh_global_stock_cache() via NEPSE today-price API.
    All users get the same cached data — no per-user API calls to NEPSE.
    Falls back to DB if cache is cold.
    """
    def get(self, request):
        from stocks_app.services import get_all_cached_stock_prices
        sector_id = request.query_params.get('sector')

        # Get all stocks from shared live cache (one NEPSE fetch, all users benefit)
        all_stocks = get_all_cached_stock_prices()

        # Apply sector filter in Python (cache holds all stocks)
        if sector_id:
            try:
                sector_id_int = int(sector_id)
                all_stocks = [s for s in all_stocks if s.get('sector') == sector_id_int]
            except (ValueError, TypeError):
                pass

        # Sort by symbol (consistent with old behaviour)
        all_stocks.sort(key=lambda s: s.get('symbol', ''))

        return Response(all_stocks)


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
        from .services import get_all_cached_stock_prices
        all_stocks = get_all_cached_stock_prices()
        
        gainers = [s for s in all_stocks if s.get('change_percent', 0) > 0]
        gainers.sort(key=lambda x: x.get('change_percent', 0), reverse=True)
        
        # Fallback: market closed or no trades yet → show by highest last_price
        if not gainers:
            gainers = sorted(
                [s for s in all_stocks if s.get('last_price', 0) > 0],
                key=lambda x: float(x.get('last_price', 0)),
                reverse=True
            )
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(gainers, request)
            if page is not None:
                return paginator.get_paginated_response(page)
        
        return Response(gainers[:10])


class TopLosersView(APIView):
    """Top stocks by negative change percent"""
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        from .services import get_all_cached_stock_prices
        all_stocks = get_all_cached_stock_prices()
        
        losers = [s for s in all_stocks if s.get('change_percent', 0) < 0]
        losers.sort(key=lambda x: x.get('change_percent', 0))
        
        # Fallback: market closed or no trades yet → show by lowest last_price
        if not losers:
            losers = sorted(
                [s for s in all_stocks if s.get('last_price', 0) > 0],
                key=lambda x: float(x.get('last_price', 0))
            )
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(losers, request)
            if page is not None:
                return paginator.get_paginated_response(page)
                
        return Response(losers[:10])


class TopTurnoverView(APIView):
    """Top stocks by total traded value (Turnover)"""
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        from .services import get_all_cached_stock_prices
        all_stocks = get_all_cached_stock_prices()
        
        turnover = [s for s in all_stocks if s.get('total_traded_value', 0) > 0]
        turnover.sort(key=lambda x: x.get('total_traded_value', 0), reverse=True)
        
        # Fallback: market closed (no turnover today) → show by last_price
        if not turnover:
            turnover = sorted(
                [s for s in all_stocks if s.get('last_price', 0) > 0],
                key=lambda x: float(x.get('last_price', 0)),
                reverse=True
            )
        
        if 'page' in request.query_params or 'limit' in request.query_params:
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(turnover, request)
            if page is not None:
                return paginator.get_paginated_response(page)

        return Response(turnover[:10])


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
