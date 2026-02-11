"""
Account management views for TinlyLink.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter

from ..models import User, APIKey, UsageTracking
from ..serializers import (
    UserSerializer, UpdateProfileSerializer, ChangePasswordSerializer,
    APIKeySerializer, CreateAPIKeySerializer, APIKeyResponseSerializer,
    UsageSerializer, DeleteAccountSerializer, UserWithSubscriptionSerializer
)
from ..permissions import HasPaidPlan


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Get or update user profile.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == "GET":
            return UserWithSubscriptionSerializer
        return UpdateProfileSerializer
    
    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    Change user password.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed"),
            400: OpenApiResponse(description="Invalid current password"),
        },
        tags=["Account"],
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        
        return Response({"success": True})


class UsageView(APIView):
    """
    Get current usage statistics.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        responses={200: UsageSerializer},
        tags=["Account"],
    )
    def get(self, request):
        user = request.user
        usage = UsageTracking.get_current_period(user)
        subscription = getattr(user, "subscription", None)
        limits = subscription.limits if subscription else {}
        
        return Response({
            "period": {
                "start": usage.period_start,
                "end": usage.period_end,
            },
            "links": {
                "used": usage.links_created,
                "limit": limits.get("links_per_month", 50),
            },
            "qr_codes": {
                "used": usage.qr_codes_created,
                "limit": limits.get("qr_codes_per_month", 10),
            },
            "api_calls": {
                "used": usage.api_calls,
                "limit": limits.get("api_calls_per_month", 0),
            },
        })


class DeleteAccountView(APIView):
    """
    Delete user account.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=DeleteAccountSerializer,
        responses={
            200: OpenApiResponse(description="Account scheduled for deletion"),
            400: OpenApiResponse(description="Invalid password"),
        },
        tags=["Account"],
    )
    def post(self, request):
        serializer = DeleteAccountSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        
        # Schedule deletion in 30 days
        user.deletion_scheduled_at = timezone.now() + timedelta(days=30)
        user.is_active = False
        user.save(update_fields=["deletion_scheduled_at", "is_active"])
        
        return Response({
            "message": "Your account has been scheduled for deletion in 30 days. "
                      "Contact support to cancel this action."
        })


# =============================================================================
# API KEY MANAGEMENT
# =============================================================================

class APIKeyListCreateView(generics.ListCreateAPIView):
    """
    List and create API keys.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    pagination_class = None
    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateAPIKeySerializer
        return APIKeySerializer
    
    def get_queryset(self):
        return APIKey.objects.filter(user=self.request.user)
    
    @extend_schema(
        responses={201: APIKeyResponseSerializer},
        tags=["API Keys"],
    )
    def create(self, request, *args, **kwargs):
        serializer = CreateAPIKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check API key limit
        existing_count = self.get_queryset().count()
        if existing_count >= 5:  # Max 5 API keys per user
            return Response(
                {"error": "Maximum number of API keys reached"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        api_key, key = APIKey.create_for_user(
            user=request.user,
            name=serializer.validated_data["name"],
            scopes=serializer.validated_data.get("scopes"),
        )
        
        return Response({
            "api_key": APIKeySerializer(api_key).data,
            "key": key,  # Only shown once!
        }, status=status.HTTP_201_CREATED)


class APIKeyDetailView(generics.RetrieveDestroyAPIView):
    """
    Get or delete an API key.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = APIKeySerializer
    
    def get_queryset(self):
        return APIKey.objects.filter(user=self.request.user)


class APIKeyRegenerateView(APIView):
    """
    Regenerate an API key.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    
    @extend_schema(
        responses={200: APIKeyResponseSerializer},
        tags=["API Keys"],
    )
    def post(self, request, pk):
        try:
            api_key = APIKey.objects.get(pk=pk, user=request.user)
        except APIKey.DoesNotExist:
            return Response(
                {"error": "API key not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Generate new key
        new_key = APIKey.generate_key()
        api_key.key_prefix = new_key[:12]
        api_key.key_hash = APIKey.hash_key(new_key)
        api_key.save(update_fields=["key_prefix", "key_hash"])
        
        return Response({
            "api_key": APIKeySerializer(api_key).data,
            "key": new_key,  # Only shown once!
        })


# =============================================================================
# NOTIFICATION SETTINGS
# =============================================================================

class NotificationSettingsView(APIView):
    """Get or update notification settings."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Account"])
    def get(self, request):
        from ..models import NotificationSettings
        settings, _ = NotificationSettings.objects.get_or_create(user=request.user)
        return Response({
            "weekly_report": settings.weekly_report,
            "usage_warning": settings.usage_warning,
            "link_alerts": settings.link_alerts,
            "security_alerts": settings.security_alerts,
            "marketing": settings.marketing,
        })
    
    @extend_schema(tags=["Account"])
    def put(self, request):
        from ..models import NotificationSettings
        settings, _ = NotificationSettings.objects.get_or_create(user=request.user)

        for field in ["weekly_report", "usage_warning", "link_alerts", "security_alerts", "marketing"]:
            if field in request.data:
                setattr(settings, field, bool(request.data[field]))

        settings.save()
        return Response({"success": True})

    @extend_schema(tags=["Account"])
    def patch(self, request):
        return self.put(request)


# =============================================================================
# INTEGRATIONS
# =============================================================================

class IntegrationListView(APIView):
    """List all integrations."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Integrations"])
    def get(self, request):
        from ..models import Integration
        
        # Get existing integrations
        integrations = Integration.objects.filter(user=request.user)
        integration_map = {i.provider: i for i in integrations}
        
        # Return all providers with status
        providers = [
            {"provider": "zapier", "name": "Zapier", "description": "Automate workflows"},
            {"provider": "slack", "name": "Slack", "description": "Get notifications in Slack"},
            {"provider": "google_analytics", "name": "Google Analytics", "description": "Enhanced tracking"},
            {"provider": "webhook", "name": "Webhooks", "description": "Custom integrations"},
        ]
        
        result = []
        for p in providers:
            integration = integration_map.get(p["provider"])
            result.append({
                **p,
                "status": integration.status if integration else "disconnected",
                "connected_at": integration.connected_at.isoformat() if integration and integration.connected_at else None,
            })
        
        return Response({"integrations": result})


class IntegrationConnectView(APIView):
    """Connect an integration."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Integrations"])
    def post(self, request, provider):
        from ..models import Integration
        
        valid_providers = ["zapier", "slack", "google_analytics", "webhook"]
        if provider not in valid_providers:
            return Response({"error": "Invalid provider"}, status=status.HTTP_400_BAD_REQUEST)
        
        integration, _ = Integration.objects.get_or_create(
            user=request.user,
            provider=provider
        )
        
        # For webhook, require URL and connect immediately
        if provider == "webhook":
            webhook_url = request.data.get("webhook_url")
            if not webhook_url:
                return Response({"error": "Webhook URL required"}, status=status.HTTP_400_BAD_REQUEST)
            integration.connect(webhook_url=webhook_url)
            return Response({
                "provider": provider,
                "status": integration.status,
                "connected_at": integration.connected_at.isoformat(),
            })

        # For OAuth providers, return authorization URL
        oauth_urls = {
            "zapier": "https://zapier.com/developer/public-invite/",
            "slack": "https://slack.com/oauth/v2/authorize",
            "google_analytics": "https://accounts.google.com/o/oauth2/v2/auth",
        }
        authorization_url = oauth_urls.get(provider)
        if not authorization_url:
            return Response(
                {"error": f"OAuth not configured for {provider}"},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        return Response({
            "authorization_url": authorization_url,
        })


class IntegrationDisconnectView(APIView):
    """Disconnect an integration."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Integrations"])
    def delete(self, request, provider):
        from ..models import Integration
        
        try:
            integration = Integration.objects.get(user=request.user, provider=provider)
            integration.disconnect()
            return Response({"success": True})
        except Integration.DoesNotExist:
            return Response({"error": "Integration not found"}, status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# SESSIONS
# =============================================================================

class SessionListView(APIView):
    """List active sessions."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Account"])
    def get(self, request):
        from ..models import UserSession
        
        sessions = UserSession.objects.filter(user=request.user)[:20]
        return Response({
            "sessions": [{
                "id": str(s.id),
                "device": s.device_type,
                "device_type": s.device_type,
                "browser": s.browser,
                "os": s.os,
                "ip_address": s.ip_address,
                "location": s.location,
                "is_current": s.is_current,
                "last_active": s.last_active.isoformat(),
                "created_at": s.created_at.isoformat(),
            } for s in sessions]
        })


class SessionRevokeView(APIView):
    """Revoke a session."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Account"])
    def delete(self, request, pk):
        from ..models import UserSession
        
        try:
            session = UserSession.objects.get(pk=pk, user=request.user)
            if session.is_current:
                return Response({"error": "Cannot revoke current session"}, status=status.HTTP_400_BAD_REQUEST)
            session.revoke()
            return Response({"success": True})
        except UserSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)


class SessionRevokeAllView(APIView):
    """Revoke all sessions except current."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Account"])
    def post(self, request):
        from ..session_utils import revoke_all_other_sessions
        
        count = revoke_all_other_sessions(request.user)
        return Response({"success": True, "revoked": count})


# =============================================================================
# DATA EXPORT (GDPR)
# =============================================================================

class DataExportView(APIView):
    """Export user data (GDPR compliance)."""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        parameters=[OpenApiParameter("type", str, description="Export type: links, analytics, all")],
        tags=["Account"]
    )
    def post(self, request):
        from ..models import ExportJob
        from ..tasks import process_data_export
        
        export_type = request.data.get("type", "all")
        if export_type not in ["links", "analytics", "all"]:
            return Response({"error": "Invalid export type"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check for recent exports (rate limit)
        recent = ExportJob.objects.filter(
            user=request.user,
            created_at__gte=timezone.now() - timedelta(hours=1)
        ).count()
        
        if recent >= 3:
            return Response(
                {"error": "Too many export requests. Please wait an hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # Create export job
        job = ExportJob.objects.create(
            user=request.user,
            export_type=export_type
        )
        
        # Queue async task
        process_data_export.delay(str(job.id))
        
        return Response({
            "job_id": str(job.id),
            "status": job.status,
            "message": "Export started. You will receive an email when ready.",
        }, status=status.HTTP_202_ACCEPTED)
    
    @extend_schema(tags=["Account"])
    def get(self, request):
        """
        Export user data or get job status.
        - If 'type' param is provided: immediate ZIP download
        - If 'job_id' param is provided: get job status
        - Otherwise: list recent export jobs
        """
        import json
        import zipfile
        from io import BytesIO
        from django.http import HttpResponse
        from ..models import ExportJob
        from apps.links.models import Link
        from apps.analytics.models import ClickEvent
        
        user = request.user
        export_type = request.query_params.get("type")
        
        # Immediate sync download if type is provided
        if export_type in ["links", "analytics", "all"]:
            zip_buffer = BytesIO()
            
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                # User profile data (always included)
                user_data = {
                    "email": user.email,
                    "full_name": user.full_name,
                    "company": user.company,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
                zf.writestr("user_profile.json", json.dumps(user_data, indent=2))
                
                # Links data
                if export_type in ["links", "all"]:
                    links = Link.objects.filter(user=user)
                    links_data = [{
                        "short_code": l.short_code,
                        "original_url": l.original_url,
                        "title": l.title,
                        "total_clicks": l.total_clicks,
                        "created_at": l.created_at.isoformat() if l.created_at else None,
                    } for l in links]
                    zf.writestr("links.json", json.dumps(links_data, indent=2))
                
                # Analytics data
                if export_type in ["analytics", "all"]:
                    link_ids = list(Link.objects.filter(user=user).values_list("id", flat=True))
                    clicks = ClickEvent.objects.filter(link_id__in=link_ids)[:5000]
                    analytics_data = [{
                        "clicked_at": c.clicked_at.isoformat() if c.clicked_at else None,
                        "country": c.country_name,
                        "city": c.city,
                        "device": c.device_type,
                        "browser": c.browser,
                    } for c in clicks]
                    zf.writestr("analytics.json", json.dumps(analytics_data, indent=2))
            
            zip_buffer.seek(0)
            
            response = HttpResponse(
                zip_buffer.read(),
                content_type="application/zip"
            )
            response["Content-Disposition"] = f'attachment; filename="tinlylink-{export_type}-export.zip"'
            return response
        
        # Job status query
        job_id = request.query_params.get("job_id")
        if job_id:
            try:
                job = ExportJob.objects.get(pk=job_id, user=request.user)
                return Response({
                    "job_id": str(job.id),
                    "type": job.export_type,
                    "status": job.status,
                    "file_url": job.file_url if job.status == "completed" else None,
                    "created_at": job.created_at.isoformat(),
                })
            except ExportJob.DoesNotExist:
                return Response({"error": "Job not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # List recent jobs
        jobs = ExportJob.objects.filter(user=request.user)[:10]
        return Response({
            "jobs": [{
                "job_id": str(j.id),
                "type": j.export_type,
                "status": j.status,
                "file_url": j.file_url if j.status == "completed" else None,
                "created_at": j.created_at.isoformat(),
            } for j in jobs]
        })

