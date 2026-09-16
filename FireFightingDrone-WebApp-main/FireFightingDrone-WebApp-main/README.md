# Drone Management System

This project provides a web-based interface for managing and interacting with drones. It allows users to register, log in, view drone listings, monitor drone locations on a map, and manage their favorite drones.

## Table of Contents

1. [Overview](#overview)  
2. [Project Structure](#project-structure)  
3. [Features](#features)  
4. [Dependency Installation and Setup](#dependency-installation-and-setup)  
5. [Running the Application](#running-the-application)  
6. [Database and Migrations](#database-and-migrations)  
7. [Things That Need to Be Fixed](#things-that-need-to-be-fixed)  
8. [Helpful Tips](#helpful-tips)

---

## Overview

The Drone Management System includes functionalities for user registration, authentication, profile management, drone listing, and an interactive map to display drone locations. Users can also mark certain drones as “favorites” for quick reference.

The application is built using [Django](https://www.djangoproject.com/) and follows a standard Django project structure. It relies on Django’s templating system for rendering pages, along with Bootstrap for front-end styling.

---

## Project Structure

Below is a simplified view of the directory tree for this application:

- **Experimental-Flights/WebApp/**  
  - **drones/**  
    - **templates/**  
      - `base.html` 
      -  **drones/**  
        - `about.html`  
        - `home.html`  
        - `login.html`  
        - `map.html`  
        - `register.html`  
    - `forms.py`  
    - `models.py`  
    - `urls.py`  
    - `views.py`  
    - `admin.py`  
    - etc.
  - **FireFightingDronePage/**  
    - `settings.py`  
    - `urls.py`  
    - `wsgi.py`  
  - `db.sqlite3` (auto-generated after migrations)  
  - `manage.py`  
  - `README.md` (this file)  

---

## Features

1. **User Registration & Authentication**  
   - Users can sign up, log in, and log out.  
   - Customizable user profile with optional personal details.

2. **Drone Listings**  
   - View a list of drones, each with relevant details (e.g., name, model, etc.).  
   - Mark certain drones as “favorites” for quick access.

3. **Map Integration**  
   - Interactive map to display drone locations.  
   - Possible future enhancements for real-time location updates.

4. **About Page**  
   - Provides general information about the system.

5. **Responsive Design**  
   - Built with Bootstrap to ensure a mobile-friendly experience.

6. **Terminal Commands**  
   - Standard Django management commands for setup, migrations, and running the development server.

---

## Dependency Installation and Setup

1. **Create & Activate a Virtual Environment (recommended but not required)**  
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. **Install Required Dependencies**  
   ```bash
   pip install -r requirements.txt
   ```
   - If a requirements file is not present, manually install the main packages:  
     ```bash
     pip install django
     pip install requests
     ```

    If you run into any trouble, contact Aaryak through Teams or email (update requirements and delete this line after august 2025)

---

## Running the Application

1. **Start the Development Server**  
   ```bash
   python3 manage.py runserver
   ```
2. **Open Your Browser**  
   - Navigate to [http://localhost:8000/](http://localhost:8000/) to access the home page.

---

## Database and Migrations

1. **Apply Migrations**  
   - Make sure all migrations are generated and applied:
     ```bash
     python3 manage.py makemigrations
     python3 manage.py migrate
     ```
   - These commands ensure that all database tables (including user profiles) are created.  
2. **Creating a Superuser (optional)**  
   ```bash
   python3 manage.py createsuperuser
   ```
   - This allows you to access Django’s admin portal at [http://localhost:8000/admin/](http://localhost:8000/admin/).

---
## Things That Need to Be Fixed

1. **UserProfile Table Issues**  
    - Make sure `UserProfile` is defined in `models.py` and that the application has completed its migrations successfully. If the table doesn’t exist, you will encounter an `OperationalError`.
    - Confirm that `drones` is listed under `INSTALLED_APPS` in `settings.py` and then run the migration commands.

2. **`drone_list` URL Pattern**  
    - A `NoReverseMatch` error indicates that the URL for `drone_list` is not resolved. In `drones/urls.py`, add a path for `drone_list`, and in `views.py`, create a corresponding view (e.g., `drone_list(request)`).

3. **UserProfile Integration**  
    - After adding or changing the `UserProfile` model, re-run `python3 manage.py makemigrations` and `python3 manage.py migrate`. Ensure your form logic in `forms.py` references the correct fields.

4. **Profile Page or Other Unimplemented URLs**  
    - Check for references like `profile`, `favorites_drones_list`, or `map`. Implement these view functions and templates to avoid any `NoReverseMatch` or `AttributeError`.

5. **Implement Live Camera Feature**  
    - Integrate real-time video streaming from drones using OpenCV or similar libraries.
    - Implement recording and playback features for camera feeds.

6. **Error Handling & Validation**  
    - Certain forms (e.g., login, registration) might require extra validation. Ensure all form submissions have appropriate feedback and error messages.

7. **Security Improvements**  
    - For production, set `DEBUG=False` in `settings.py` and configure the `ALLOWED_HOSTS`.  
    - Consider using environment variables for sensitive data (e.g., email credentials, API keys).

8. **Google Maps or Other APIs**  
    - If you require a Google Maps API key, confirm it’s properly stored in `settings.py` and used securely in the map templates.

---

## Helpful Tips

- **Admin Interface**  
  - Leverage Django’s admin portal to review and manage database content, including `UserProfile` entries and drone records.
- **Template Debugging**  
  - Check for broken links or stale references in templates. If a template references a URL that doesn’t exist (like `'drone_list'` without a matching URL pattern), update `urls.py` accordingly.
- **Project Maintenance**  
  - Use version control (Git) to track changes, perform safe rollbacks, and collaborate with other developers.

---

**Thank you for using the Drone Management System!** For any further issues, suggestions, or contributions, please create a new branch or file an issue in the repository.  