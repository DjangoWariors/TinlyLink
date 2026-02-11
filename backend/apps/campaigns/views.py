"""
Views for campaigns app.
"""

from django.db import models
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.users.permissions import HasPaidPlan
from apps.links.models import Link
from apps.links.serializers import LinkSerializer
from .models import Campaign, Variant
from .serializers import (
    CampaignSerializer, CreateCampaignSerializer,
    UpdateCampaignSerializer, CampaignStatsSerializer,
    VariantSerializer, CreateVariantSerializer, UpdateVariantSerializer,
)


class CampaignListCreateView(generics.ListCreateAPIView):
    """
    List and create campaigns.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = CampaignSerializer
    pagination_class = None
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return Campaign.objects.filter(team=self.request.team).select_related("user")
        return Campaign.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(
        request=CreateCampaignSerializer,
        responses={201: CampaignSerializer},
        tags=["Campaigns"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        campaign = Campaign.objects.create(
            user=request.user,
            team=request.team,  # Team context
            **serializer.validated_data
        )
        
        return Response(CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)


class CampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get, update, or delete a campaign.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = CampaignSerializer
    
    def get_queryset(self):
        # Team-scoped queryset
        if self.request.team:
            return Campaign.objects.filter(team=self.request.team).select_related("user")
        return Campaign.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(
        request=UpdateCampaignSerializer,
        responses={200: CampaignSerializer},
        tags=["Campaigns"]
    )
    def patch(self, request, *args, **kwargs):
        campaign = self.get_object()
        serializer = UpdateCampaignSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        for field, value in serializer.validated_data.items():
            setattr(campaign, field, value)
        campaign.save()
        
        return Response(CampaignSerializer(campaign).data)
    
    def destroy(self, request, *args, **kwargs):
        campaign = self.get_object()
        
        # Set campaign_id to NULL for associated links (don't delete them)
        Link.objects.filter(campaign=campaign).update(campaign=None)
        
        campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignActivateView(APIView):
    """Activate a campaign."""
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(responses={200: CampaignSerializer}, tags=["Campaigns"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        camp_filter = {"pk": pk}
        if team:
            camp_filter["team"] = team
        else:
            camp_filter["user"] = request.user
            camp_filter["team__isnull"] = True
        try:
            campaign = Campaign.objects.get(**camp_filter)
        except Campaign.DoesNotExist:
            return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        if campaign.status == "completed":
            return Response(
                {"error": "Cannot activate a completed campaign"},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.status = "active"
        campaign.save(update_fields=["status"])
        return Response(CampaignSerializer(campaign).data)


class CampaignPauseView(APIView):
    """Pause an active campaign."""
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(responses={200: CampaignSerializer}, tags=["Campaigns"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        camp_filter = {"pk": pk}
        if team:
            camp_filter["team"] = team
        else:
            camp_filter["user"] = request.user
            camp_filter["team__isnull"] = True
        try:
            campaign = Campaign.objects.get(**camp_filter)
        except Campaign.DoesNotExist:
            return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        if campaign.status != "active":
            return Response(
                {"error": "Only active campaigns can be paused"},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.status = "paused"
        campaign.save(update_fields=["status"])
        return Response(CampaignSerializer(campaign).data)


class CampaignDuplicateView(APIView):
    """Duplicate a campaign with its links."""
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(responses={201: CampaignSerializer}, tags=["Campaigns"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        camp_filter = {"pk": pk}
        if team:
            camp_filter["team"] = team
        else:
            camp_filter["user"] = request.user
            camp_filter["team__isnull"] = True
        try:
            campaign = Campaign.objects.get(**camp_filter)
        except Campaign.DoesNotExist:
            return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        # Clone campaign
        new_campaign = Campaign.objects.create(
            user=request.user,
            team=team,
            name=f"{campaign.name} (Copy)",
            description=campaign.description,
            fallback_url=campaign.fallback_url,
            expired_message=campaign.expired_message,
            default_utm_source=campaign.default_utm_source,
            default_utm_medium=campaign.default_utm_medium,
            default_utm_campaign=campaign.default_utm_campaign,
            tags=campaign.tags.copy() if campaign.tags else [],
            status="draft",
        )

        # Clone links
        for link in campaign.links.all():
            Link.objects.create(
                user=request.user,
                team=team,
                campaign=new_campaign,
                original_url=link.original_url,
                title=link.title,
                utm_source=link.utm_source,
                utm_medium=link.utm_medium,
                utm_campaign=link.utm_campaign,
                utm_term=link.utm_term,
                utm_content=link.utm_content,
            )

        return Response(CampaignSerializer(new_campaign).data, status=status.HTTP_201_CREATED)


class CampaignLinksView(generics.ListAPIView):
    """
    Get links for a campaign.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = LinkSerializer

    def get_queryset(self):
        campaign_id = self.kwargs["pk"]
        # Team-scoped queryset
        if self.request.team:
            return Link.objects.filter(
                team=self.request.team,
                campaign_id=campaign_id
            ).select_related("domain", "user")
        return Link.objects.filter(
            user=self.request.user,
            team__isnull=True,
            campaign_id=campaign_id
        ).select_related("domain")


class CampaignStatsView(APIView):
    """
    Get statistics for a campaign.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    
    @extend_schema(
        responses={200: CampaignStatsSerializer},
        tags=["Campaigns"]
    )
    def get(self, request, pk):
        team = getattr(request, "team", None)
        camp_filter = {"pk": pk}
        if team:
            camp_filter["team"] = team
        else:
            camp_filter["user"] = request.user
            camp_filter["team__isnull"] = True
        try:
            campaign = Campaign.objects.get(**camp_filter)
        except Campaign.DoesNotExist:
            return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get stats
        from apps.analytics.services import get_campaign_stats
        stats = get_campaign_stats(campaign.id)
        
        return Response(stats)


# =============================================================================
# CAMPAIGN COMPARISON
# =============================================================================

class CampaignCompareView(APIView):
    """Compare multiple campaigns performance."""
    permission_classes = [IsAuthenticated, HasPaidPlan]
    
    @extend_schema(
        parameters=[
            OpenApiParameter("campaign_ids", str, description="Comma-separated campaign IDs"),
            OpenApiParameter("period", str, description="Time period: 7d, 30d, 90d"),
        ],
        tags=["Campaigns"]
    )
    def get(self, request):
        from apps.analytics.models import ClickEvent
        from apps.analytics.services import get_period_dates
        from apps.links.models import Link
        from django.db.models import Count, Sum
        
        campaign_ids = request.query_params.get("campaign_ids", "").split(",")
        campaign_ids = [c.strip() for c in campaign_ids if c.strip()]
        period = request.query_params.get("period", "30d")
        
        if not campaign_ids:
            return Response({"error": "No campaigns specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(campaign_ids) > 5:
            return Response({"error": "Maximum 5 campaigns"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify ownership
        team = getattr(request, "team", None)
        camp_filter = {"id__in": campaign_ids}
        if team:
            camp_filter["team"] = team
        else:
            camp_filter["user"] = request.user
            camp_filter["team__isnull"] = True
        campaigns = Campaign.objects.filter(**camp_filter)
        
        if not campaigns:
            return Response({"error": "No campaigns found"}, status=status.HTTP_404_NOT_FOUND)
        
        start_date, end_date = get_period_dates(period)
        
        result = []
        for campaign in campaigns:
            # Get campaign links
            link_ids = list(Link.objects.filter(campaign=campaign).values_list("id", flat=True))
            
            # Get clicks
            clicks = ClickEvent.objects.filter(
                link_id__in=link_ids,
                clicked_at__gte=start_date,
                clicked_at__lte=end_date
            )
            
            total_clicks = clicks.count()
            unique_visitors = clicks.values("ip_hash").distinct().count()
            
            result.append({
                "id": str(campaign.id),
                "name": campaign.name,
                "links_count": len(link_ids),
                "total_clicks": total_clicks,
                "unique_visitors": unique_visitors,
                "ctr": round(unique_visitors / total_clicks * 100, 1) if total_clicks > 0 else 0,
            })
        
        # Sort by clicks
        result.sort(key=lambda x: x["total_clicks"], reverse=True)
        
        return Response({
            "period": period,
            "campaigns": result
        })


class CampaignTemplatesView(APIView):
    """Get campaign templates."""
    permission_classes = [IsAuthenticated, HasPaidPlan]
    
    @extend_schema(tags=["Campaigns"])
    def get(self, request):
        templates = [
            {
                "id": "social",
                "name": "Social Media",
                "description": "For social media campaigns",
                "utm_source": "social",
                "utm_medium": "post",
            },
            {
                "id": "email",
                "name": "Email Marketing",
                "description": "For newsletter and email campaigns",
                "utm_source": "email",
                "utm_medium": "newsletter",
            },
            {
                "id": "ads",
                "name": "Paid Advertising",
                "description": "For PPC and display ads",
                "utm_source": "google",
                "utm_medium": "cpc",
            },
            {
                "id": "affiliate",
                "name": "Affiliate Marketing",
                "description": "For affiliate and partner links",
                "utm_source": "affiliate",
                "utm_medium": "partner",
            },
            {
                "id": "qr",
                "name": "QR Code Campaign",
                "description": "For offline to online tracking",
                "utm_source": "qr",
                "utm_medium": "offline",
            },
        ]
        return Response({"templates": templates})


# =============================================================================
# VARIANT VIEWS (A/B Testing)
# =============================================================================

class LinkVariantListCreateView(generics.ListCreateAPIView):
    """List and create variants for a link."""
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = VariantSerializer

    def get_queryset(self):
        link_id = self.kwargs["link_id"]
        team = getattr(self.request, "team", None)
        # Verify link ownership
        link_filter = {"id": link_id}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = self.request.user
            link_filter["team__isnull"] = True
        if not Link.objects.filter(**link_filter).exists():
            return Variant.objects.none()
        return Variant.objects.filter(link_id=link_id)

    @extend_schema(
        request=CreateVariantSerializer,
        responses={201: VariantSerializer},
        tags=["A/B Testing"]
    )
    def post(self, request, link_id):
        team = getattr(request, "team", None)
        link_filter = {"id": link_id}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True
        try:
            link = Link.objects.get(**link_filter)
        except Link.DoesNotExist:
            return Response({"error": "Link not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateVariantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # If this is the first variant, make it control
        is_first = not Variant.objects.filter(link=link).exists()
        is_control = serializer.validated_data.get("is_control", is_first)

        # If setting as control, unset other controls
        if is_control:
            Variant.objects.filter(link=link, is_control=True).update(is_control=False)

        variant = Variant.objects.create(
            link=link,
            is_control=is_control,
            **{k: v for k, v in serializer.validated_data.items() if k != "is_control"}
        )

        return Response(VariantSerializer(variant).data, status=status.HTTP_201_CREATED)


class VariantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a variant."""
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = VariantSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return Variant.objects.filter(
                models.Q(link__team=team) | models.Q(qr_code__team=team)
            )
        return Variant.objects.filter(
            models.Q(link__user=self.request.user, link__team__isnull=True) |
            models.Q(qr_code__user=self.request.user, qr_code__team__isnull=True)
        )

    @extend_schema(
        request=UpdateVariantSerializer,
        responses={200: VariantSerializer},
        tags=["A/B Testing"]
    )
    def patch(self, request, *args, **kwargs):
        from django.db import models as db_models
        variant = self.get_object()
        serializer = UpdateVariantSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(variant, field, value)
        variant.save()

        return Response(VariantSerializer(variant).data)

    @extend_schema(tags=["A/B Testing"])
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class VariantSetWinnerView(APIView):
    """Set a variant as the winner and disable others."""
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(responses={200: VariantSerializer}, tags=["A/B Testing"])
    def post(self, request, pk):
        from django.db import models as db_models
        team = getattr(request, "team", None)

        variant_filter = {"pk": pk}
        if team:
            variant = Variant.objects.filter(
                db_models.Q(link__team=team) | db_models.Q(qr_code__team=team),
                **variant_filter
            ).first()
        else:
            variant = Variant.objects.filter(
                db_models.Q(link__user=request.user, link__team__isnull=True) |
                db_models.Q(qr_code__user=request.user, qr_code__team__isnull=True),
                **variant_filter
            ).first()

        if not variant:
            return Response({"error": "Variant not found"}, status=status.HTTP_404_NOT_FOUND)

        # Disable all other variants
        siblings = Variant.objects.filter(
            link=variant.link,
            qr_code=variant.qr_code,
        ).exclude(id=variant.id)
        siblings.update(is_active=False, is_winner=False)

        # Set winner
        variant.is_winner = True
        variant.weight = 100
        variant.save(update_fields=["is_winner", "weight"])

        return Response(VariantSerializer(variant).data)


class VariantStatsView(APIView):
    """Get A/B test statistics with significance calculation."""
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(tags=["A/B Testing"])
    def get(self, request, link_id):
        from django.db import models as db_models
        team = getattr(request, "team", None)

        # Verify link ownership
        link_filter = {"id": link_id}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = request.user
            link_filter["team__isnull"] = True
        if not Link.objects.filter(**link_filter).exists():
            return Response({"error": "Link not found"}, status=status.HTTP_404_NOT_FOUND)

        variants = Variant.objects.filter(link_id=link_id)

        stats = []
        for v in variants:
            stats.append({
                "id": str(v.id),
                "name": v.name,
                "weight": v.weight,
                "impressions": v.impressions,
                "clicks": v.clicks,
                "click_rate": v.click_rate,
                "conversions": v.conversions,
                "conversion_rate": v.conversion_rate,
                "is_control": v.is_control,
                "is_winner": v.is_winner,
                "is_active": v.is_active,
                "lift": None,
                "significance": None,
            })

        # Calculate statistical significance
        if len(stats) >= 2:
            control = next((s for s in stats if s["is_control"]), stats[0])
            for s in stats:
                if s["id"] != control["id"]:
                    s["lift"] = self._calculate_lift(control, s)
                    s["significance"] = self._calculate_significance(control, s)

        return Response({"variants": stats})

    def _calculate_lift(self, control, variant):
        """Calculate lift percentage vs control."""
        if control["click_rate"] == 0:
            return 0
        return round(
            ((variant["click_rate"] - control["click_rate"]) / control["click_rate"]) * 100,
            2
        )

    def _calculate_significance(self, control, variant):
        """
        Calculate statistical significance using z-test for proportions.
        Returns confidence level (0-100).
        """
        n1, c1 = control["impressions"], control["clicks"]
        n2, c2 = variant["impressions"], variant["clicks"]

        if n1 < 100 or n2 < 100:
            return 0  # Not enough data

        p1 = c1 / n1 if n1 > 0 else 0
        p2 = c2 / n2 if n2 > 0 else 0
        p_pool = (c1 + c2) / (n1 + n2) if (n1 + n2) > 0 else 0

        if p_pool == 0 or p_pool == 1:
            return 0

        se = (p_pool * (1 - p_pool) * (1/n1 + 1/n2)) ** 0.5
        if se == 0:
            return 0

        z = abs(p1 - p2) / se

        # Convert z-score to confidence
        if z >= 2.576:
            return 99
        elif z >= 1.96:
            return 95
        elif z >= 1.645:
            return 90
        elif z >= 1.28:
            return 80
        else:
            return int(z / 1.28 * 80)


class QRCodeVariantListCreateView(generics.ListCreateAPIView):
    """List and create variants for a QR code."""
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = VariantSerializer

    def get_queryset(self):
        from apps.qrcodes.models import QRCode
        qr_id = self.kwargs["qr_id"]
        team = getattr(self.request, "team", None)
        # Verify QR ownership
        qr_filter = {"id": qr_id}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = self.request.user
            qr_filter["team__isnull"] = True
        if not QRCode.objects.filter(**qr_filter).exists():
            return Variant.objects.none()
        return Variant.objects.filter(qr_code_id=qr_id)

    @extend_schema(
        request=CreateVariantSerializer,
        responses={201: VariantSerializer},
        tags=["A/B Testing"]
    )
    def post(self, request, qr_id):
        from apps.qrcodes.models import QRCode
        team = getattr(request, "team", None)
        qr_filter = {"id": qr_id}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = request.user
            qr_filter["team__isnull"] = True
        try:
            qr = QRCode.objects.get(**qr_filter)
        except QRCode.DoesNotExist:
            return Response({"error": "QR code not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateVariantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # If this is the first variant, make it control
        is_first = not Variant.objects.filter(qr_code=qr).exists()
        is_control = serializer.validated_data.get("is_control", is_first)

        # If setting as control, unset other controls
        if is_control:
            Variant.objects.filter(qr_code=qr, is_control=True).update(is_control=False)

        variant = Variant.objects.create(
            qr_code=qr,
            is_control=is_control,
            **{k: v for k, v in serializer.validated_data.items() if k != "is_control"}
        )

        return Response(VariantSerializer(variant).data, status=status.HTTP_201_CREATED)
