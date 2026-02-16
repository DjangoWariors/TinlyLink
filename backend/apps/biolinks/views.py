"""
Views for bio pages and landing pages.
"""

import csv
import hashlib
from io import StringIO

from django.db import models
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import render, get_object_or_404
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from .models import BioPage, BioLink, LandingPage, LandingPageTemplate, FormSubmission
from .serializers import (
    BioPageSerializer, CreateBioPageSerializer, UpdateBioPageSerializer,
    BioLinkSerializer, CreateBioLinkSerializer, UpdateBioLinkSerializer,
    LandingPageSerializer, CreateLandingPageSerializer, UpdateLandingPageSerializer,
    LandingPageTemplateSerializer, FormSubmissionSerializer,
)


# =============================================================================
# BIO PAGES
# =============================================================================


class BioPageListCreateView(generics.ListCreateAPIView):
    """List or create bio pages."""
    permission_classes = [IsAuthenticated]
    serializer_class = BioPageSerializer
    pagination_class = None
    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return BioPage.objects.filter(team=team).annotate(annotated_links_count=Count("links"))
        return BioPage.objects.filter(user=self.request.user, team__isnull=True).annotate(annotated_links_count=Count("links"))

    @extend_schema(request=CreateBioPageSerializer, responses={201: BioPageSerializer}, tags=["Bio Pages"])
    def post(self, request, *args, **kwargs):
        serializer = CreateBioPageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        team = getattr(request, "team", None)
        page = BioPage.objects.create(
            user=request.user,
            team=team,
            **serializer.validated_data,
        )
        return Response(BioPageSerializer(page).data, status=status.HTTP_201_CREATED)


class BioPageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a bio page."""
    permission_classes = [IsAuthenticated]
    serializer_class = BioPageSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return BioPage.objects.filter(team=team).annotate(annotated_links_count=Count("links"))
        return BioPage.objects.filter(user=self.request.user, team__isnull=True).annotate(annotated_links_count=Count("links"))

    @extend_schema(request=UpdateBioPageSerializer, responses={200: BioPageSerializer}, tags=["Bio Pages"])
    def patch(self, request, *args, **kwargs):
        page = self.get_object()
        serializer = UpdateBioPageSerializer(
            data=request.data, partial=True, context={"instance": page}
        )
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(page, field, value)
        page.save()

        return Response(BioPageSerializer(page).data)


class BioPageCheckSlugView(APIView):
    """Check if a bio page slug is available."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        slug = request.query_params.get("slug", "").strip()
        if not slug:
            return Response({"available": False}, status=status.HTTP_400_BAD_REQUEST)
        available = not BioPage.objects.filter(slug=slug).exists()
        return Response({"available": available})


class BioLinkListCreateView(generics.ListCreateAPIView):
    """List or create bio links for a bio page."""
    permission_classes = [IsAuthenticated]
    serializer_class = BioLinkSerializer
    pagination_class = None
    def get_bio_page(self):
        team = getattr(self.request, "team", None)
        if team:
            return get_object_or_404(BioPage, id=self.kwargs["bio_page_id"], team=team)
        return get_object_or_404(
            BioPage, id=self.kwargs["bio_page_id"],
            user=self.request.user, team__isnull=True,
        )

    def get_queryset(self):
        page = self.get_bio_page()
        return BioLink.objects.filter(bio_page=page).select_related("link")

    @extend_schema(request=CreateBioLinkSerializer, responses={201: BioLinkSerializer}, tags=["Bio Pages"])
    def post(self, request, *args, **kwargs):
        page = self.get_bio_page()
        serializer = CreateBioLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        link_id = data.pop("link_id", None)

        max_pos = BioLink.objects.filter(bio_page=page).aggregate(
            m=models.Max("position")
        )["m"] or 0

        bio_link = BioLink.objects.create(
            bio_page=page,
            link_id=link_id,
            position=max_pos + 1,
            **data,
        )
        return Response(BioLinkSerializer(bio_link).data, status=status.HTTP_201_CREATED)


class BioLinkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update or delete a bio link."""
    permission_classes = [IsAuthenticated]
    serializer_class = BioLinkSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return BioLink.objects.filter(bio_page__team=team)
        return BioLink.objects.filter(
            bio_page__user=self.request.user, bio_page__team__isnull=True
        )

    @extend_schema(request=UpdateBioLinkSerializer, responses={200: BioLinkSerializer}, tags=["Bio Pages"])
    def patch(self, request, *args, **kwargs):
        bio_link = self.get_object()
        serializer = UpdateBioLinkSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(bio_link, field, value)
        bio_link.save()

        return Response(BioLinkSerializer(bio_link).data)


class BioLinkReorderView(APIView):
    """Reorder bio links by drag-and-drop."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Bio Pages"])
    def post(self, request, bio_page_id):
        team = getattr(request, "team", None)
        if team:
            page = get_object_or_404(BioPage, id=bio_page_id, team=team)
        else:
            page = get_object_or_404(
                BioPage, id=bio_page_id,
                user=request.user, team__isnull=True,
            )

        link_ids = request.data.get("link_ids", [])
        if not link_ids:
            return Response({"error": "link_ids required"}, status=status.HTTP_400_BAD_REQUEST)

        for i, lid in enumerate(link_ids):
            BioLink.objects.filter(id=lid, bio_page=page).update(position=i)

        return Response({"success": True})


class PublicBioPageView(APIView):
    """Render a public bio page at /@slug."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        page = get_object_or_404(BioPage, slug=slug, is_published=True)

        # Increment view counter
        BioPage.objects.filter(id=page.id).update(total_views=models.F("total_views") + 1)

        links = page.links.filter(is_active=True).select_related("link").order_by("position")

        return render(request, "biolinks/page.html", {
            "page": page,
            "links": links,
        })


# =============================================================================
# LANDING PAGES
# =============================================================================


class LandingPageListCreateView(generics.ListCreateAPIView):
    """List or create landing pages."""
    permission_classes = [IsAuthenticated]
    serializer_class = LandingPageSerializer
    pagination_class = None

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return LandingPage.objects.filter(team=team)
        return LandingPage.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(request=CreateLandingPageSerializer, responses={201: LandingPageSerializer}, tags=["Landing Pages"])
    def post(self, request, *args, **kwargs):
        serializer = CreateLandingPageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        template_id = data.pop("template_id", None)

        team = getattr(request, "team", None)

        # If template_id provided, copy blocks/settings from template
        if template_id:
            try:
                template = LandingPageTemplate.objects.get(id=template_id, is_active=True)
                if not data.get("blocks"):
                    data["blocks"] = template.blocks
                if not data.get("settings"):
                    data["settings"] = template.settings
                data["template"] = template
            except LandingPageTemplate.DoesNotExist:
                pass

        page = LandingPage.objects.create(user=request.user, team=team, **data)
        return Response(LandingPageSerializer(page).data, status=status.HTTP_201_CREATED)


class LandingPageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a landing page."""
    permission_classes = [IsAuthenticated]
    serializer_class = LandingPageSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return LandingPage.objects.filter(team=team)
        return LandingPage.objects.filter(user=self.request.user, team__isnull=True)

    @extend_schema(request=UpdateLandingPageSerializer, responses={200: LandingPageSerializer}, tags=["Landing Pages"])
    def patch(self, request, *args, **kwargs):
        page = self.get_object()
        serializer = UpdateLandingPageSerializer(
            data=request.data, partial=True, context={"instance": page}
        )
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(page, field, value)
        page.save()

        return Response(LandingPageSerializer(page).data)


class LandingPagePublishView(APIView):
    """Publish a landing page."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Landing Pages"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        if team:
            page = get_object_or_404(LandingPage, id=pk, team=team)
        else:
            page = get_object_or_404(LandingPage, id=pk, user=request.user, team__isnull=True)

        page.is_published = True
        page.save(update_fields=["is_published"])
        return Response(LandingPageSerializer(page).data)


class LandingPageDuplicateView(APIView):
    """Duplicate a landing page."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Landing Pages"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        if team:
            original = get_object_or_404(LandingPage, id=pk, team=team)
        else:
            original = get_object_or_404(LandingPage, id=pk, user=request.user, team__isnull=True)

        import uuid
        new_slug = f"{original.slug}-copy-{uuid.uuid4().hex[:6]}"

        clone = LandingPage.objects.create(
            user=request.user,
            team=team,
            slug=new_slug,
            title=f"{original.title} (Copy)",
            blocks=original.blocks,
            settings=original.settings,
            seo_title=original.seo_title,
            seo_description=original.seo_description,
            template=original.template,
        )
        return Response(LandingPageSerializer(clone).data, status=status.HTTP_201_CREATED)


class LandingPageTemplateListView(generics.ListAPIView):
    """List available landing page templates."""
    permission_classes = [IsAuthenticated]
    serializer_class = LandingPageTemplateSerializer
    queryset = LandingPageTemplate.objects.filter(is_active=True)


class FormSubmissionListView(generics.ListAPIView):
    """List form submissions for a landing page."""
    permission_classes = [IsAuthenticated]
    serializer_class = FormSubmissionSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            page = get_object_or_404(LandingPage, id=self.kwargs["pk"], team=team)
        else:
            page = get_object_or_404(
                LandingPage, id=self.kwargs["pk"],
                user=self.request.user, team__isnull=True,
            )
        return FormSubmission.objects.filter(landing_page=page)


class FormSubmissionExportView(APIView):
    """Export form submissions as CSV."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        team = getattr(request, "team", None)
        if team:
            page = get_object_or_404(LandingPage, id=pk, team=team)
        else:
            page = get_object_or_404(LandingPage, id=pk, user=request.user, team__isnull=True)

        submissions = FormSubmission.objects.filter(landing_page=page)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="submissions-{page.slug}.csv"'

        # Collect all field keys
        all_keys = set()
        for sub in submissions:
            all_keys.update(sub.data.keys())
        all_keys = sorted(all_keys)

        writer = csv.writer(response)
        writer.writerow(["Submitted At"] + all_keys)
        for sub in submissions:
            row = [sub.submitted_at.isoformat()] + [sub.data.get(k, "") for k in all_keys]
            writer.writerow(row)

        return response


class PublicFormSubmitView(APIView):
    """Public form submission endpoint (rate-limited)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AnonRateThrottle]

    @extend_schema(tags=["Landing Pages"])
    def post(self, request, slug):
        page = get_object_or_404(LandingPage, slug=slug, is_published=True)

        block_id = request.data.get("block_id", "")
        form_data = request.data.get("data", {})

        if not block_id or not form_data:
            return Response(
                {"error": "block_id and data are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Hash IP for privacy
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
        if "," in ip:
            ip = ip.split(",")[0].strip()
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]

        FormSubmission.objects.create(
            landing_page=page,
            block_id=block_id,
            data=form_data,
            ip_hash=ip_hash,
        )

        # Increment conversion counter
        LandingPage.objects.filter(id=page.id).update(
            total_conversions=models.F("total_conversions") + 1
        )

        return Response({"success": True}, status=status.HTTP_201_CREATED)


class PublicLandingPageView(APIView):
    """Render a public landing page at /p/slug."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        page = get_object_or_404(LandingPage, slug=slug, is_published=True)

        # Increment view counter
        LandingPage.objects.filter(id=page.id).update(
            total_views=models.F("total_views") + 1
        )

        return render(request, "biolinks/landing.html", {"page": page})
