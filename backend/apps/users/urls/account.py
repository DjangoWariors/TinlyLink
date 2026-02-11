"""
Account management URL configuration.
"""

from django.urls import path

from ..views.account import (
    ProfileView, ChangePasswordView, UsageView, DeleteAccountView,
    APIKeyListCreateView, APIKeyDetailView, APIKeyRegenerateView,
    NotificationSettingsView, IntegrationListView, IntegrationConnectView,
    IntegrationDisconnectView, SessionListView, SessionRevokeView, 
    SessionRevokeAllView, DataExportView
)

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("password/", ChangePasswordView.as_view(), name="change_password"),
    path("usage/", UsageView.as_view(), name="usage"),
    path("delete/", DeleteAccountView.as_view(), name="delete_account"),
    
    # API Keys
    path("api-keys/", APIKeyListCreateView.as_view(), name="api_keys"),
    path("api-keys/<uuid:pk>/", APIKeyDetailView.as_view(), name="api_key_detail"),
    path("api-keys/<uuid:pk>/regenerate/", APIKeyRegenerateView.as_view(), name="api_key_regenerate"),
    
    # Notifications
    path("notifications/", NotificationSettingsView.as_view(), name="notifications"),
    
    # Integrations
    path("integrations/", IntegrationListView.as_view(), name="integrations"),
    path("integrations/<str:provider>/connect/", IntegrationConnectView.as_view(), name="integration_connect"),
    path("integrations/<str:provider>/", IntegrationDisconnectView.as_view(), name="integration_disconnect"),
    
    # Sessions
    path("sessions/", SessionListView.as_view(), name="sessions"),
    path("sessions/<uuid:pk>/", SessionRevokeView.as_view(), name="session_revoke"),
    path("sessions/revoke-all/", SessionRevokeAllView.as_view(), name="session_revoke_all"),
    
    # Data Export (GDPR)
    path("export/", DataExportView.as_view(), name="data_export"),
]
