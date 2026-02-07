from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    BuySellSerializer, 
    AdjustmentSerializer, 
    DividendSerializer, 
    AveragingSerializer
)
from .services import NepseCalculator

class BuySellCalculatorView(APIView):
    def post(self, request):
        serializer = BuySellSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            result = NepseCalculator.calculate_buy_sell(
                mode=data['mode'],
                qty=data['qty'],
                price=data['price'],
                is_wacc_entry=data.get('is_wacc_entry', False),
                purchase_price=data.get('purchase_price', 0),
                investor_type=data.get('investor_type', 'individual'),
                holding_period=data.get('holding_period', 'short')
            )
            return Response(result)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdjustmentCalculatorView(APIView):
    def post(self, request):
        serializer = AdjustmentSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            result = NepseCalculator.calculate_adjustment(
                adjustment_type=data['type'],
                ltp=data['ltp'],
                percent=data['percent'],
                paid_up=data['paid_up']
            )
            return Response({'adjusted_price': result})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DividendCalculatorView(APIView):
    def post(self, request):
        serializer = DividendSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            result = NepseCalculator.calculate_dividend(
                qty=data['qty'],
                bonus_percent=data['bonus_percent'],
                cash_percent=data['cash_percent'],
                face_value=data['face_value']
            )
            return Response(result)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AveragingCalculatorView(APIView):
    def post(self, request):
        serializer = AveragingSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            result = NepseCalculator.calculate_average(data['rows'])
            return Response(result)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
