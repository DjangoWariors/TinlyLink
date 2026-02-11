"""
Authentication views for TinlyLink.
"""

from django.utils import timezone
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from drf_spectacular.utils import extend_schema, OpenApiResponse

from ..models import User
from ..serializers import (
    RegisterSerializer, LoginSerializer, TokenSerializer,
    RefreshTokenSerializer, ForgotPasswordSerializer,
    ResetPasswordSerializer, VerifyEmailSerializer,
    UserSerializer, SubscriptionSerializer
)
from ..tasks import send_verification_email, send_password_reset_email


def get_tokens_for_user(user):
    """Generate JWT tokens for user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
    }


class RegisterView(APIView):
    """
    Register a new user account.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: TokenSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.save()
        
        # Send verification email
        user.generate_verification_token()
        send_verification_email.delay(str(user.id))
        
        # Create session for this registration
        from ..session_utils import create_session_for_user
        create_session_for_user(user, request, is_current=True)
        
        # Generate tokens
        tokens = get_tokens_for_user(user)
        
        # Get subscription
        subscription = getattr(user, "subscription", None)
        
        return Response({
            "user": UserSerializer(user).data,
            "subscription": SubscriptionSerializer(subscription).data if subscription else None,
            **tokens
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Login with email and password.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=LoginSerializer,
        responses={
            200: TokenSerializer,
            400: OpenApiResponse(description="Invalid credentials"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data["user"]
        
        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        
        # Create session for this login
        from ..session_utils import create_session_for_user
        create_session_for_user(user, request, is_current=True)
        
        # Generate tokens
        tokens = get_tokens_for_user(user)
        
        # Get subscription
        subscription = getattr(user, "subscription", None)
        
        return Response({
            "user": UserSerializer(user).data,
            "subscription": SubscriptionSerializer(subscription).data if subscription else None,
            **tokens
        })


class LogoutView(APIView):
    """
    Logout and blacklist refresh token.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=RefreshTokenSerializer,
        responses={
            200: OpenApiResponse(description="Successfully logged out"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        # Delete current session
        from ..session_utils import delete_session_for_user
        delete_session_for_user(request.user)
        
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass  # Token might already be blacklisted
        
        return Response({"success": True})


class RefreshTokenView(APIView):
    """
    Refresh access token using refresh token.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=RefreshTokenSerializer,
        responses={
            200: TokenSerializer,
            400: OpenApiResponse(description="Invalid token"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            refresh = RefreshToken(serializer.validated_data["refresh_token"])
            
            # Get user from token
            user_id = refresh.payload.get("sub") or refresh.payload.get("user_id")
            user = User.objects.get(id=user_id)
            
            # Generate new tokens (rotation)
            new_tokens = get_tokens_for_user(user)
            
            # Blacklist old token
            refresh.blacklist()
            
            return Response({
                "access_token": new_tokens["access_token"],
                "refresh_token": new_tokens["refresh_token"],
            })
        except Exception as e:
            return Response(
                {"error": "Invalid or expired refresh token"},
                status=status.HTTP_400_BAD_REQUEST
            )


class ForgotPasswordView(APIView):
    """
    Request password reset email.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=ForgotPasswordSerializer,
        responses={
            200: OpenApiResponse(description="Reset email sent if account exists"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get user if exists (don't reveal if email exists)
        user = getattr(serializer, "user", None)
        if user:
            token = user.generate_password_reset_token()
            send_password_reset_email.delay(str(user.id), token)
        
        return Response({
            "message": "If an account exists with this email, a reset link has been sent."
        })


class ResetPasswordView(APIView):
    """
    Reset password with token.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=ResetPasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password reset successful"),
            400: OpenApiResponse(description="Invalid or expired token"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]
        
        # Find user with this token
        try:
            user = User.objects.get(password_reset_token=token)
            if user.reset_password(token, password):
                # Blacklist all existing tokens for this user
                OutstandingToken.objects.filter(user=user).delete()
                
                return Response({"success": True})
            else:
                return Response(
                    {"error": "Invalid or expired token"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST
            )


class VerifyEmailView(APIView):
    """
    Verify email address with token.
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=VerifyEmailSerializer,
        responses={
            200: OpenApiResponse(description="Email verified"),
            400: OpenApiResponse(description="Invalid or expired token"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data["token"]
        
        try:
            user = User.objects.get(email_verification_token=token)
            if user.verify_email(token):
                return Response({"success": True})
            else:
                return Response(
                    {"error": "Invalid or expired token"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST
            )


class ResendVerificationView(APIView):
    """
    Resend email verification.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        responses={
            200: OpenApiResponse(description="Verification email sent"),
            400: OpenApiResponse(description="Email already verified"),
        },
        tags=["Authentication"],
    )
    def post(self, request):
        user = request.user
        
        if user.email_verified:
            return Response(
                {"error": "Email is already verified"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.generate_verification_token()
        send_verification_email.delay(str(user.id))
        
        return Response({"message": "Verification email sent"})


class MeView(APIView):
    """
    Get current authenticated user details.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        responses={200: TokenSerializer},
        tags=["Authentication"],
    )
    def get(self, request):
        user = request.user
        subscription = getattr(user, "subscription", None)
        
        from ..serializers import UserWithSubscriptionSerializer
        
        return Response(UserWithSubscriptionSerializer(user).data)
