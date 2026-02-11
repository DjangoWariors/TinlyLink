"""
URL configuration for public redirects.
These URLs catch short codes and handle redirections.
"""

from django.urls import path, re_path

from .views_redirect import RedirectView, HealthCheckView

urlpatterns = [
    # Health check for load balancers
    path("health/", HealthCheckView.as_view(), name="health_check"),
    path("ready/", HealthCheckView.as_view(), name="ready_check"),
    
    # Short code redirect - catches everything else
    # Must be last in main urls.py to avoid catching other routes
    re_path(r"^(?P<short_code>[a-zA-Z0-9_-]{4,50})$", RedirectView.as_view(), name="redirect"),
]
