from django.shortcuts import redirect
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from django.contrib.auth import logout

def custom_logout_view(request):
    logout(request)  # Logs out the user
    return redirect('home')  # Redirect to the home page

urlpatterns = [
    path('', views.home, name='home'),
    path('register/', views.signup_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', custom_logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('favorites/', views.favorite_drones_list, name='favorites_drones_list'),
    path('about/', views.about, name='about'),
    path('add_drone/', views.add_drone, name='add_drone'),
    path('like_drone/<int:drone_id>/', views.like_drone, name='like_drone'),

    path('accounts/login/', auth_views.LoginView.as_view(), name='accounts_login'),
    path('password_reset/', auth_views.PasswordResetView.as_view(), name='password_reset'),
    path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(success_url='/login'), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(), name='password_reset_complete'),
    path('map/', views.map, name='map'),
]
