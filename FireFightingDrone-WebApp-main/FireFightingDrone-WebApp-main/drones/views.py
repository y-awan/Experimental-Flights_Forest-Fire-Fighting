# drones/views.py
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from .forms import UserRegistrationForm, UserForm, UserProfileForm, DroneForm
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
from django.http import JsonResponse
import requests
from .models import UserProfile, Drone, FavoriteDrone
import json
from geopy.distance import geodesic
from django.contrib.auth.decorators import login_required

def drones_page(request):
    drones = [
        {"id": 1, "battery": 10, "model": "JOUAV CW-30E", "coordinates": (-567.30, 450.46)},
        {"id": 2, "battery": 67, "model": "Parrot Anafi USA", "coordinates": (-123.89, 90)},
        {"id": 3, "battery": 100, "model": "Holybro X500 V2", "coordinates": (-50.570, -45)},
    ]
    return render(request, "drones/drones.html", {"drones": drones})

def view_camera_feed(request, drone_id):
    # Dummy camera feed URL for demonstration
    camera_feed_url = f"http://example.com/camera_feed/{drone_id}"
    return render(request, "drones/camera_feed.html", {"camera_feed_url": camera_feed_url})

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('drone_list')  # Redirect to drone list
    else:
        form = AuthenticationForm()

    return render(request, 'drones/login.html', {'form': form})

def signup_view(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            # Automatically log the user in after signup
            email = form.cleaned_data.get('email')
            password = form.cleaned_data.get('password')
            user = authenticate(username=email, password=password)
            login(request, user)
            return redirect('drone_list')  # Redirect to drone list
    else:
        form = UserRegistrationForm()

    return render(request, 'drones/register.html', {'form': form})

def drone_list(request):
    drones = Drone.objects.all()
    return render(request, "drones/home.html", {"drones": drones})

@login_required
def like_drone(request, drone_id):
    drone = get_object_or_404(Drone, id=drone_id)
    favorite = FavoriteDrone.objects.filter(user=request.user, drone=drone).first()
    if favorite:
        favorite.delete()
    else:
        FavoriteDrone.objects.create(user=request.user, drone=drone)
    return redirect('drone_list')

@login_required
def favorite_drones_list(request):
    favorites = FavoriteDrone.objects.filter(user=request.user)
    return render(request, 'drones/favorites.html', {'favorites': favorites})

def home(request):
    # Sample hardcoded data for demonstration
    # drones = [
    #     {"id": 1, "battery": 10, "model": "JOUAV CW-30E", "coordinates": (-567.30, 450.46)},
    #     {"id": 2, "battery": 67, "model": "Parrot Anafi USA", "coordinates": (-123.89, 90)},
    #     {"id": 3, "battery": 100, "model": "Holybro X500 V2", "coordinates": (-50.570, -45)},
    # ]

    if request.user.is_authenticated:
        drones = Drone.objects.filter(user=request.user)
    else:
        drones = []
    
    context = {"drones": drones}
    
    if request.user.is_authenticated:
        try:
            user_profile = UserProfile.objects.get(user=request.user)
            context["user_profile"] = user_profile
        except UserProfile.DoesNotExist:
            # Create profile if it doesn't exist
            user_profile = UserProfile.objects.create(user=request.user)
            context["user_profile"] = user_profile
    
    return render(request, "drones/home.html", context)



def get_drone_details(drone_id):
    try:
        drone = Drone.objects.get(id=drone_id)
        return drone, None, None
    except Drone.DoesNotExist:
        return None, None, "Drone not found."

def drone_details_view(request, drone_id):
    drone, photos, error = get_drone_details(drone_id)
    if error:
        return render(request, 'drones/error.html', {'error_message': error})

    context = {
        'drone': drone,
        'photos': photos if photos else []
    }
    return render(request, 'drones/drone_details.html', context)

def search_drones(request):
    if request.method == "POST":
        # Get search parameters
        drone_model = request.POST.get('drone_model', '')
        drone_type = request.POST.get('drone_type', '')
        
        # Filter drones based on search criteria
        drones = Drone.objects.all()
        
        if drone_model:
            drones = drones.filter(model__icontains=drone_model)
            
        if drone_type:
            drones = drones.filter(drone_type__icontains=drone_type)
            
        context = {
            'drones': drones,
            'drone_model': drone_model,
            'drone_type': drone_type
        }
        return render(request, 'drones/search_results.html', context)

    return render(request, 'drones/search.html')

def map(request):
    # Default location (e.g., Atlanta)
    default_location = {
        'lat': 33.7490,
        'lng': -84.3880,
    }
    # Pass Google Maps API key and default location to the template
    context = {
        'google_maps_api_key': settings.GOOGLE_MAPS_API_KEY,
        'default_location': default_location,
    }
    return render(request, 'drones/map.html', context)

def profile_view(request):
    user = request.user
    try:
        user_profile = UserProfile.objects.get(user=user)
    except UserProfile.DoesNotExist:
        user_profile = None

    if request.method == 'POST':
        user_form = UserForm(request.POST, instance=user)
        profile_form = UserProfileForm(request.POST, instance=user_profile)

        if user_form.is_valid() and profile_form.is_valid():
            user_form.save()
            profile_form.save()
            return redirect('profile')  # Redirect to the profile page after saving

    else:
        user_form = UserForm(instance=user)
        profile_form = UserProfileForm(instance=user_profile)

    return render(request, 'drones/profile.html', {
        'user_form': user_form,
        'profile_form': profile_form
    })

def map_view(request):
    default_location = {
        'lat': 33.7490,
        'lng': -84.3880,
    }

    context = {
        'google_maps_api_key': settings.GOOGLE_MAPS_API_KEY,
        'default_location': default_location,
    }

    return render(request, 'drones/map.html', context)

def track_drones(request):
    if request.method == 'POST':
        # Parse the request body to get search parameters
        data = json.loads(request.body)
        search_area = data.get('search_area', {})
        
        # TODO: Implement the logic to track drones in the specified area
        # For now, we'll use sample data
        drones = [
            {
                'id': 1,
                'name': 'Drone Alpha',
                'model': 'JOUAV CW-30E',
                'lat': 33.7490,
                'lng': -84.3880,
                'battery': 75,
                'status': 'Active'
            },
            {
                'id': 2,
                'name': 'Drone Beta',
                'model': 'Parrot Anafi USA',
                'lat': 33.7590,
                'lng': -84.3950,
                'battery': 60,
                'status': 'Active'
            },
            {
                'id': 3,
                'name': 'Drone Gamma',
                'model': 'Holybro X500 V2',
                'lat': 33.7390,
                'lng': -84.3780,
                'battery': 90,
                'status': 'Active'
            }
        ]

        return JsonResponse({'drones': drones})

    return JsonResponse({'error': 'Invalid request method'}, status=400)

def about(request):
    return render(request, "drones/about.html")

@login_required
def add_drone(request):
    if request.method == 'POST':
        form = DroneForm(request.POST)
        if form.is_valid():
            drone = form.save(commit=False)
            drone.user = request.user
            drone.save()
            return redirect('home')
    else:
        form = DroneForm()
    return render(request, 'drones/add_drone.html', {'form': form})

def favorite_drones_list(request):
    favorites = FavoriteDrone.objects.filter(user=request.user)
    return render(request, 'drones/favorites_drones_list.html', {'favorites': favorites})