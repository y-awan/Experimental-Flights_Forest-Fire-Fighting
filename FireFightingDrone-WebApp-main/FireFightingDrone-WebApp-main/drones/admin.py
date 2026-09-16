from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile

# Define an inline admin descriptor for UserProfile model
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fk_name = 'user'

# Extend the existing UserAdmin to include UserProfile inline
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)

    # Customize list display to show extra fields in the user list in the admin panel
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff')
    list_select_related = ('userprofile',)

# Unregister the default User admin and register the customized one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)
