from django.urls import path
from .views import RegisterView, UserProfileView, ProfilePictureUploadView, ChangePasswordView, MoneyRequestView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/picture/', ProfilePictureUploadView.as_view(), name='profile-picture'),
    path('profile/password/', ChangePasswordView.as_view(), name='change-password'),
    path('request-money/', MoneyRequestView.as_view(), name='request-money'),
]
