from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PortfolioView, HoldingsListView, BuyStockView, SellStockView, 
    PortfolioHistoryView, OrderHistoryView, CancelOrderView, UpdateOrderView,
    WatchlistGroupViewSet, WatchlistItemViewSet, PastHoldingsView, StockTransactionsView
)

router = DefaultRouter()
router.register(r'watchlist/groups', WatchlistGroupViewSet, basename='watchlist-groups')
router.register(r'watchlist/items', WatchlistItemViewSet, basename='watchlist-items')

urlpatterns = [
    path('', PortfolioView.as_view(), name='portfolio'),
    path('holdings/', HoldingsListView.as_view(), name='holdings'),
    path('buy/', BuyStockView.as_view(), name='buy-stock'),
    path('sell/', SellStockView.as_view(), name='sell-stock'),
    path('history/', PortfolioHistoryView.as_view(), name='portfolio-history'),
    path('past-holdings/', PastHoldingsView.as_view(), name='past-holdings'),
    path('transactions/<str:symbol>/', StockTransactionsView.as_view(), name='stock-transactions'),
    path('orders/', OrderHistoryView.as_view(), name='order-history'),
    path('orders/<int:pk>/cancel/', CancelOrderView.as_view(), name='cancel-order'),
    path('orders/<int:pk>/update/', UpdateOrderView.as_view(), name='update-order'),
    path('', include(router.urls)),
]
