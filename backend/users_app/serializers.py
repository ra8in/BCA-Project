from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(source='first_name') # Map 'name' to 'first_name' or keep it if model has it

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'name')

    def create(self, validated_data):
        # Handle renaming 'first_name' back to 'name' or vice versa if needed
        # But here we used source='first_name', so validated_data will have 'first_name' if we pass 'name'
        # Wait, serializer source is for output/input mapping.
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', '')
        )
        return user
