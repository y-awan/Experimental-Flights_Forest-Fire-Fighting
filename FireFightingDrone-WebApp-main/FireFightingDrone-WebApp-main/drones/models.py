# drones/models.py
from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    location = models.CharField(max_length=30, blank=True)
    favorite_drone_type = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.user.username

class Drone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    battery = models.IntegerField(default=100, help_text="Battery percentage")
    model = models.CharField(max_length=255)
    coordinates = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.name} ({self.model}) - Battery: {self.battery}%"
    
class FavoriteDrone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    drone = models.ForeignKey(Drone, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.user.username} likes {self.drone.name}"
