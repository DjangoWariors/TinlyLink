"""
Authentication URL configuration.
"""

from django.urls import path

from ..views.auth import (
    ForgotPasswordView, ResetPasswordView, VerifyEmailView,
    ResendVerificationView, MeView, RegisterView, LoginView, LogoutView, RefreshTokenView
)
from ..views.google_auth import GoogleLoginView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify_email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend_verification"),
    path("me/", MeView.as_view(), name="me"),
    path("google/", GoogleLoginView.as_view(), name="google_login"),
]
