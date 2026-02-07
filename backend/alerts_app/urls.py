from django.urls import path
from .views import (
    PriceAlertListCreateView,
    PriceAlertDeleteView,
    NotificationListView,
    NotificationMarkReadView
)

urlpatterns = [
    path('', PriceAlertListCreateView.as_view(), name='alert-list-create'),
    path('<int:pk>/', PriceAlertDeleteView.as_view(), name='alert-delete'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
]
