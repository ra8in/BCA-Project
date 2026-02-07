from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import PriceAlert, Notification
from .serializers import PriceAlertSerializer, NotificationSerializer


class PriceAlertListCreateView(APIView):
    """List all alerts for current user or create a new one."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        alerts = PriceAlert.objects.filter(user=request.user).select_related('stock').order_by('-created_at')
        serializer = PriceAlertSerializer(alerts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PriceAlertSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PriceAlertDeleteView(APIView):
    """Delete or update a specific alert."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            alert = PriceAlert.objects.get(pk=pk, user=request.user)
            alert.delete()
            return Response({"message": "Alert deleted"}, status=status.HTTP_204_NO_CONTENT)
        except PriceAlert.DoesNotExist:
            return Response({"error": "Alert not found"}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        try:
            alert = PriceAlert.objects.get(pk=pk, user=request.user)
            target_price = request.data.get('target_price')
            alert_type = request.data.get('alert_type')
            
            if target_price:
                alert.target_price = target_price
            if alert_type and alert_type in ['ABOVE', 'BELOW']:
                alert.alert_type = alert_type
            
            alert.save()
            from .serializers import PriceAlertSerializer
            serializer = PriceAlertSerializer(alert)
            return Response(serializer.data)
        except PriceAlert.DoesNotExist:
            return Response({"error": "Alert not found"}, status=status.HTTP_404_NOT_FOUND)


class NotificationListView(APIView):
    """List notifications for current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:50]
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)


class NotificationMarkReadView(APIView):
    """Mark notifications as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids', [])
        if ids:
            Notification.objects.filter(user=request.user, id__in=ids).update(is_read=True)
        else:
            # Mark all as read if no IDs specified
            Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": "Notifications marked as read"})
