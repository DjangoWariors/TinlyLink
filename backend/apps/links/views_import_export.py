"""
CSV Import/Export views for links.
"""

import csv
import io
import json
import logging
from datetime import datetime

from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.users.models import UsageTracking
from apps.users.permissions import HasPaidPlan
from .models import Link
from .serializers import LinkSerializer

logger = logging.getLogger(__name__)


class LinksExportView(APIView):
    """
    Export user's links to CSV or JSON.
    Requires Pro or Business plan.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("format", str, description="Export format: csv or json"),
            OpenApiParameter("campaign", str, description="Filter by campaign ID"),
        ],
        tags=["Links"]
    )
    def get(self, request):
        user = request.user
        export_format = request.query_params.get("format", "csv")
        campaign_id = request.query_params.get("campaign")
        
        # Get links
        links = Link.objects.filter(user=user)
        if campaign_id:
            links = links.filter(campaign_id=campaign_id)
        
        links = links.select_related("domain", "campaign").order_by("-created_at")
        
        if export_format == "json":
            return self._export_json(links)
        else:
            return self._export_csv(links)
    
    def _export_csv(self, links):
        """Export links to CSV format."""
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="links-export-{datetime.now().strftime("%Y%m%d")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            "Short Code", "Short URL", "Original URL", "Title", 
            "Total Clicks", "Unique Clicks", "Campaign",
            "UTM Source", "UTM Medium", "UTM Campaign",
            "Is Active", "Created At"
        ])
        
        for link in links:
            writer.writerow([
                link.short_code,
                link.short_url,
                link.original_url,
                link.title,
                link.total_clicks,
                link.unique_clicks,
                link.campaign.name if link.campaign else "",
                link.utm_source,
                link.utm_medium,
                link.utm_campaign,
                "Yes" if link.is_active else "No",
                link.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            ])
        
        return response
    
    def _export_json(self, links):
        """Export links to JSON format."""
        data = []
        for link in links:
            data.append({
                "short_code": link.short_code,
                "short_url": link.short_url,
                "original_url": link.original_url,
                "title": link.title,
                "total_clicks": link.total_clicks,
                "unique_clicks": link.unique_clicks,
                "campaign": link.campaign.name if link.campaign else None,
                "utm_source": link.utm_source,
                "utm_medium": link.utm_medium,
                "utm_campaign": link.utm_campaign,
                "is_active": link.is_active,
                "created_at": link.created_at.isoformat(),
            })
        
        response = HttpResponse(
            json.dumps(data, indent=2),
            content_type="application/json"
        )
        response["Content-Disposition"] = f'attachment; filename="links-export-{datetime.now().strftime("%Y%m%d")}.json"'
        
        return response


class LinksImportView(APIView):
    """
    Import links from CSV file.
    Requires Pro or Business plan.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    parser_classes = [MultiPartParser, FormParser]
    
    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "file": {"type": "string", "format": "binary"},
                    "campaign_id": {"type": "string", "format": "uuid"},
                },
                "required": ["file"],
            }
        },
        tags=["Links"]
    )
    def post(self, request):
        user = request.user
        file = request.FILES.get("file")
        campaign_id = request.data.get("campaign_id")
        
        if not file:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check file type
        if not file.name.endswith(".csv"):
            return Response(
                {"error": "Only CSV files are supported"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check file size (max 5MB)
        if file.size > 5 * 1024 * 1024:
            return Response(
                {"error": "File size must be less than 5MB"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check plan limits
        subscription = getattr(user, "subscription", None)
        usage = UsageTracking.get_current_period(user)
        limit = subscription.limits.get("links_per_month", 50) if subscription else 50
        
        # Parse CSV
        try:
            decoded_file = file.read().decode("utf-8")
            reader = csv.DictReader(io.StringIO(decoded_file))
            
            # Validate headers
            required_headers = ["url"]  # Minimum required
            optional_headers = ["title", "custom_slug", "utm_source", "utm_medium", "utm_campaign"]
            
            headers = [h.lower().strip() for h in reader.fieldnames] if reader.fieldnames else []
            
            if "url" not in headers:
                return Response(
                    {"error": "CSV must have a 'url' column"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            rows = list(reader)
            
            # Check if import would exceed limit
            if limit != -1 and (usage.links_created + len(rows)) > limit:
                return Response({
                    "error": f"Importing {len(rows)} links would exceed your monthly limit of {limit}",
                    "current_usage": usage.links_created,
                    "limit": limit,
                }, status=status.HTTP_403_FORBIDDEN)
            
        except UnicodeDecodeError:
            return Response(
                {"error": "File encoding must be UTF-8"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except csv.Error as e:
            return Response(
                {"error": f"Invalid CSV format: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process rows
        created = []
        errors = []
        
        for i, row in enumerate(rows, start=2):  # Start at 2 (after header)
            url = row.get("url", "").strip()
            
            if not url:
                errors.append({"row": i, "error": "URL is required"})
                continue
            
            # Add protocol if missing
            if not url.startswith(("http://", "https://")):
                url = f"https://{url}"
            
            # Validate URL
            is_valid, error = Link.validate_url(url)
            if not is_valid:
                errors.append({"row": i, "url": url, "error": error})
                continue
            
            # Custom slug validation
            custom_slug = row.get("custom_slug", "").strip()
            if custom_slug:
                if not subscription or not subscription.can_use_custom_slug():
                    errors.append({"row": i, "error": "Custom slugs require Pro plan"})
                    custom_slug = None
                else:
                    is_valid, error = Link.validate_slug(custom_slug)
                    if not is_valid:
                        errors.append({"row": i, "error": error})
                        custom_slug = None
            
            # Create link
            try:
                link = Link.objects.create(
                    user=user,
                    original_url=url,
                    short_code=custom_slug if custom_slug else None,
                    title=row.get("title", "")[:255].strip(),
                    campaign_id=campaign_id,
                    utm_source=row.get("utm_source", "")[:100].strip(),
                    utm_medium=row.get("utm_medium", "")[:100].strip(),
                    utm_campaign=row.get("utm_campaign", "")[:100].strip(),
                )
                created.append(LinkSerializer(link).data)
                usage.increment_links()
                
            except Exception as e:
                errors.append({"row": i, "url": url, "error": str(e)})
        
        return Response({
            "imported": len(created),
            "errors": errors[:50],  # Limit errors in response
            "total_errors": len(errors),
            "links": created[:10],  # Preview of created links
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)


class LinksImportTemplateView(APIView):
    """
    Download CSV template for link import.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(tags=["Links"])
    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="link-import-template.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            "url", "title", "custom_slug", "utm_source", "utm_medium", "utm_campaign"
        ])
        writer.writerow([
            "https://example.com/page1", "My First Link", "my-custom-slug", 
            "newsletter", "email", "spring_2024"
        ])
        writer.writerow([
            "https://example.com/page2", "Another Link", "", 
            "social", "twitter", "promo"
        ])
        
        return response
