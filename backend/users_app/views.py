from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .serializers import UserRegistrationSerializer, UserSerializer, ChangePasswordSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            "user": {
                "username": user.username,
                "email": user.email,
                "name": user.first_name
            },
            "message": "User created successfully",
        }, status=status.HTTP_201_CREATED)

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user

    def delete(self, request, *args, **kwargs):
        """Delete the user account after password verification."""
        user = self.get_object()
        password = request.data.get('password', '')
        
        if not password:
            return Response(
                {'error': 'Password is required to delete your account.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user.check_password(password):
            return Response(
                {'error': 'Incorrect password.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Delete profile picture file if exists
        if user.profile_picture:
            user.profile_picture.delete(save=False)
        
        user.delete()
        return Response(
            {'message': 'Account deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )

class ProfilePictureUploadView(generics.UpdateAPIView):
    """Dedicated endpoint for uploading/removing profile picture."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user

    def put(self, request, *args, **kwargs):
        user = self.get_object()
        if 'profile_picture' not in request.FILES:
            # If no file sent, remove the existing picture
            user.profile_picture.delete(save=True)
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        
        user.profile_picture = request.FILES['profile_picture']
        user.save()
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    def delete(self, request, *args, **kwargs):
        user = self.get_object()
        user.profile_picture.delete(save=True)
        serializer = self.get_serializer(user)
        return Response(serializer.data)

class ChangePasswordView(generics.UpdateAPIView):
    """Endpoint for changing password."""
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            # Check old password
            if not self.object.check_password(serializer.data.get("old_password")):
                return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)
            
            # set_password also hashes the password that the user will get
            self.object.set_password(serializer.data.get("new_password"))
            self.object.save()
            return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MoneyRequestView(generics.ListCreateAPIView):
    """Endpoint for requesting virtual money and listing past requests."""
    from .serializers import MoneyRequestSerializer
    serializer_class = MoneyRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .models import MoneyRequest
        return MoneyRequest.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
