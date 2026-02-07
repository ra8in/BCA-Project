from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .serializers import UserRegistrationSerializer
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

# We can just use TokenObtainPairView in urls.py directly, 
# or subclass if we want to add extra data to the response.
# For now, standard is fine.
