# drones/forms.py
from django import forms
from django.contrib.auth.models import User
from .models import UserProfile, Drone

class UserRegistrationForm(forms.ModelForm):
    first_name = forms.CharField(max_length=30)
    last_name = forms.CharField(max_length=30)
    email = forms.EmailField(max_length=100)
    password = forms.CharField(widget=forms.PasswordInput())

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password'])
        user.username = self.cleaned_data['email']  # Use email as username
        if commit:
            user.save()
            # Create a related UserProfile instance
            UserProfile.objects.create(
                user=user
            )
        return user

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = []  # Add any fields you want to include in the profile form

class UserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']

# This class defines a Django form for a Drone model with fields for name, battery, model, longitude,
# and latitude, and includes methods to handle coordinate data manipulation.
class DroneForm(forms.ModelForm):
    coordinates_x = forms.FloatField(label="Longitude")
    coordinates_y = forms.FloatField(label="Latitude")
    
    class Meta:
        model = Drone
        fields = ['name', 'battery', 'model']
    
    def __init__(self, *args, **kwargs):
        instance = kwargs.get('instance', None)
        if instance and instance.coordinates:
            # Split coordinates string into x and y
            try:
                x, y = instance.coordinates.strip('<>').split(', ')
                initial = kwargs.get('initial', {})
                initial['coordinates_x'] = float(x)
                initial['coordinates_y'] = float(y)
                kwargs['initial'] = initial
            except (ValueError, AttributeError):
                pass
        super().__init__(*args, **kwargs)
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Combine coordinates_x and coordinates_y into one field
        x = self.cleaned_data.get('coordinates_x')
        y = self.cleaned_data.get('coordinates_y')
        instance.coordinates = f"<{x}, {y}>"
        if commit:
            instance.save()
        return instance