from django.urls import path
from .views import (
    StockSearchView, StockDetailView, StockListView, 
    SectorListView, SubIndexListView, MarketIndexListView,
    TopGainersView, TopLosersView, TopTurnoverView, MarketStatusView,
    MarketDepthView, LiveStockPriceView, StockHistoryView
)

urlpatterns = [
    path('', StockListView.as_view(), name='stock-list'),
    path('sectors/', SectorListView.as_view(), name='sector-list'),
    path('sub-indices/', SubIndexListView.as_view(), name='subindex-list'),
    path('indices/', MarketIndexListView.as_view(), name='market-index-list'),
    path('market-status/', MarketStatusView.as_view(), name='market-status'),
    path('top-gainers/', TopGainersView.as_view(), name='top-gainers'),
    path('top-losers/', TopLosersView.as_view(), name='top-losers'),
    path('top-turnover/', TopTurnoverView.as_view(), name='top-turnover'),
    path('search/', StockSearchView.as_view(), name='stock-search'),
    
    
    # On-demand cached endpoints (60s cache + 2s throttle)
    path('market-depth/<str:symbol>/', MarketDepthView.as_view(), name='market-depth'),
    path('live-price/<str:symbol>/', LiveStockPriceView.as_view(), name='live-stock-price'),
    path('history/<str:symbol>/', StockHistoryView.as_view(), name='stock-history'),
    
    # Stock detail (must be last to avoid conflicts)
    path('<str:symbol>/', StockDetailView.as_view(), name='stock-detail'),
]

