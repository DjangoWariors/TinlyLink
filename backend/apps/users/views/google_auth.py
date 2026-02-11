
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, views
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class GoogleLoginView(views.APIView):
    """
    Login or register using Google OAuth2.
    Accepts 'credential' (ID Token) from frontend.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.data.get("credential")
        access_token = request.data.get("access_token")
        
        if not token and not access_token:
            return Response(
                {"error": "No credential or access_token provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            email = None
            email_verified = False
            name = ""
            picture = ""
            
            # Scenario 1: ID Token (credential)
            if token:
                # Verify token
                client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None)
                idinfo = id_token.verify_oauth2_token(
                    token, 
                    requests.Request(), 
                    audience=client_id
                )
                email = idinfo.get("email")
                email_verified = idinfo.get("email_verified")
                name = idinfo.get("name", "")
                picture = idinfo.get("picture", "")

            # Scenario 2: Access Token (from custom button hook)
            elif access_token:
                import requests as req
                resp = req.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo", 
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if resp.status_code != 200:
                     raise ValueError("Invalid access token")
                
                userinfo = resp.json()
                email = userinfo.get("email")
                email_verified = userinfo.get("email_verified")
                name = userinfo.get("name", "")
                picture = userinfo.get("picture", "")

            if not email_verified:
                 return Response(
                    {"error": "Google email not verified"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get or create user
            user, created = User.objects.get_or_create(email=email)
            
            if created:
                # Set basic info
                user.full_name = name
                user.email_verified = True
                user.email_verified_at = timezone.now()
                user.set_unusable_password()
                user.save()
                
                # Signal for new user (e.g. create subscription)
                # The post_save signal on User model should handle this if it exists
                # If not, explicitly create subscription here as fallback
                if not hasattr(user, 'subscription'):
                    from apps.users.models import Subscription
                    Subscription.objects.create(user=user)
                    
            else:
                # Update existing user info if empty
                if not user.full_name:
                    user.full_name = name
                if not user.avatar_url:
                    user.avatar_url = picture
                
                # If user wasn't verified before, verify them now since Google says so
                if not user.email_verified:
                    user.email_verified = True
                    user.email_verified_at = timezone.now()
                
                user.save()

            # Issue JWT
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "refresh_token": str(refresh),
                "access_token": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url,
                },
                "created": created
            })

        except ValueError as e:
            logger.warning(f"Google Token Verification Failed: {e}")
            return Response(
                {"error": "Invalid token"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.exception(f"Google Login Error: {e}")
            return Response(
                {"error": "Authentication failed"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
