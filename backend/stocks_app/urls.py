from django.urls import path
from .views import (
    StockSearchView, StockDetailView, StockListView, 
    SectorListView, SubIndexListView, MarketIndexListView,
    TopGainersView, TopLosersView, TopTurnoverView, MarketStatusView
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
    path('<str:symbol>/', StockDetailView.as_view(), name='stock-detail'),
]

