from django.urls import path
from .views import (
    BuySellCalculatorView, 
    AdjustmentCalculatorView, 
    DividendCalculatorView, 
    AveragingCalculatorView
)

urlpatterns = [
    path('buy-sell/', BuySellCalculatorView.as_view(), name='calc-buy-sell'),
    path('adjustment/', AdjustmentCalculatorView.as_view(), name='calc-adjustment'),
    path('dividend/', DividendCalculatorView.as_view(), name='calc-dividend'),
    path('averaging/', AveragingCalculatorView.as_view(), name='calc-averaging'),
]
