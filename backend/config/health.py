"""
Health check endpoints for monitoring and load balancers.
"""

import logging
from datetime import timedelta
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views import View

logger = logging.getLogger(__name__)


class HealthCheckView(View):
    
    def get(self, request):
        return JsonResponse({
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
        })


class ReadinessCheckView(View):
    
    def get(self, request):
        checks = {}
        healthy = True
        
        # Database check
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = {"status": "healthy"}
        except Exception as e:
            checks["database"] = {"status": "unhealthy", "error": str(e)}
            healthy = False
        
        # Redis check
        try:
            cache.set("health_check", "ok", timeout=10)
            value = cache.get("health_check")
            if value == "ok":
                checks["redis"] = {"status": "healthy"}
            else:
                checks["redis"] = {"status": "unhealthy", "error": "Cache read failed"}
                healthy = False
        except Exception as e:
            checks["redis"] = {"status": "unhealthy", "error": str(e)}
            healthy = False
        
        # Celery check (optional)
        try:
            from config.celery import app as celery_app
            inspector = celery_app.control.inspect()
            workers = inspector.ping()
            if workers:
                checks["celery"] = {"status": "healthy", "workers": len(workers)}
            else:
                checks["celery"] = {"status": "degraded", "error": "No workers responding"}
        except Exception as e:
            checks["celery"] = {"status": "unknown", "error": str(e)}
        
        status_code = 200 if healthy else 503
        
        return JsonResponse({
            "status": "healthy" if healthy else "unhealthy",
            "timestamp": timezone.now().isoformat(),
            "checks": checks,
        }, status=status_code)


class LivenessCheckView(View):

    def get(self, request):
        # Simple check that the app can process requests
        return JsonResponse({
            "status": "alive",
            "timestamp": timezone.now().isoformat(),
        })


class MetricsView(View):

    
    def get(self, request):
        from apps.links.models import Link
        from apps.users.models import User
        from apps.analytics.models import ClickEvent
        
        # Get basic stats
        total_users = User.objects.count()
        total_links = Link.objects.count()
        active_links = Link.objects.filter(is_active=True).count()
        
        # Clicks in last 24 hours
        yesterday = timezone.now() - timedelta(days=1)
        clicks_24h = ClickEvent.objects.filter(clicked_at__gte=yesterday).count()
        
        # Build Prometheus metrics
        metrics = []
        metrics.append(f"# HELP tinlylink_users_total Total number of users")
        metrics.append(f"# TYPE tinlylink_users_total gauge")
        metrics.append(f"tinlylink_users_total {total_users}")
        
        metrics.append(f"# HELP tinlylink_links_total Total number of links")
        metrics.append(f"# TYPE tinlylink_links_total gauge")
        metrics.append(f"tinlylink_links_total {total_links}")
        
        metrics.append(f"# HELP tinlylink_links_active Number of active links")
        metrics.append(f"# TYPE tinlylink_links_active gauge")
        metrics.append(f"tinlylink_links_active {active_links}")
        
        metrics.append(f"# HELP tinlylink_clicks_24h Clicks in last 24 hours")
        metrics.append(f"# TYPE tinlylink_clicks_24h gauge")
        metrics.append(f"tinlylink_clicks_24h {clicks_24h}")
        
        return JsonResponse(
            "\n".join(metrics),
            safe=False,
            content_type="text/plain"
        )
