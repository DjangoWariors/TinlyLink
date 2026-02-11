"""
Views for Rules Engine API.
"""

from datetime import datetime

from django.utils import timezone
from rest_framework import status, generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.users.permissions import HasPaidPlan
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Rule, RuleGroup
from .serializers import (
    RuleSerializer, CreateRuleSerializer, UpdateRuleSerializer,
    RuleGroupSerializer, CreateRuleGroupSerializer, TestRuleSerializer,
)
from .engine import RuleEngine, get_rules_for_link, get_rules_for_qr_code


class RuleListCreateView(generics.ListCreateAPIView):
    """
    List rules or create a new rule.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "condition_type", "action_type"]
    search_fields = ["name", "description"]
    ordering_fields = ["priority", "created_at", "times_matched"]
    ordering = ["-priority", "-created_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateRuleSerializer
        return RuleSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        qs = Rule.objects.all()

        if team:
            qs = qs.filter(team=team)
        else:
            qs = qs.filter(user=self.request.user, team__isnull=True)

        # Filter by link or QR code if specified
        link_id = self.request.query_params.get("link_id")
        qr_code_id = self.request.query_params.get("qr_code_id")

        if link_id:
            qs = qs.filter(link_id=link_id)
        if qr_code_id:
            qs = qs.filter(qr_code_id=qr_code_id)

        return qs.select_related("link", "qr_code")

    @extend_schema(
        parameters=[
            OpenApiParameter("link_id", str, description="Filter by link ID"),
            OpenApiParameter("qr_code_id", str, description="Filter by QR code ID"),
        ],
        tags=["Rules"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CreateRuleSerializer,
        responses={201: RuleSerializer},
        tags=["Rules"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateRuleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        rule = serializer.save()
        return Response(RuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class RuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get, update, or delete a rule.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = RuleSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return Rule.objects.filter(team=team).select_related("link", "qr_code")
        return Rule.objects.filter(
            user=self.request.user, team__isnull=True
        ).select_related("link", "qr_code")

    @extend_schema(tags=["Rules"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=UpdateRuleSerializer,
        responses={200: RuleSerializer},
        tags=["Rules"]
    )
    def patch(self, request, *args, **kwargs):
        rule = self.get_object()
        serializer = UpdateRuleSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        rule = serializer.update(rule, serializer.validated_data)
        return Response(RuleSerializer(rule).data)

    @extend_schema(tags=["Rules"])
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class RuleToggleView(APIView):
    """
    Toggle rule active status.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(tags=["Rules"])
    def post(self, request, pk):
        team = getattr(request, "team", None)
        rule_filter = {"pk": pk}
        if team:
            rule_filter["team"] = team
        else:
            rule_filter["user"] = request.user
            rule_filter["team__isnull"] = True

        try:
            rule = Rule.objects.get(**rule_filter)
        except Rule.DoesNotExist:
            return Response({"error": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)

        rule.is_active = not rule.is_active
        rule.save(update_fields=["is_active", "updated_at"])

        return Response({
            "id": str(rule.id),
            "is_active": rule.is_active,
        })


class RuleReorderView(APIView):
    """
    Reorder rules by setting new priorities.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(tags=["Rules"])
    def post(self, request):
        """
        Expects body: {"rules": [{"id": "...", "priority": 100}, ...]}
        """
        rules_data = request.data.get("rules", [])

        if not rules_data:
            return Response(
                {"error": "Rules list is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        team = getattr(request, "team", None)

        updated = []
        for item in rules_data:
            rule_id = item.get("id")
            priority = item.get("priority")

            if not rule_id or priority is None:
                continue

            rule_filter = {"id": rule_id}
            if team:
                rule_filter["team"] = team
            else:
                rule_filter["user"] = request.user
                rule_filter["team__isnull"] = True

            count = Rule.objects.filter(**rule_filter).update(priority=priority)
            if count:
                updated.append({"id": rule_id, "priority": priority})

        return Response({"updated": updated})


class LinkRulesView(generics.ListAPIView):
    """
    List rules for a specific link.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = RuleSerializer

    def get_queryset(self):
        link_id = self.kwargs.get("link_id")

        # Verify link ownership
        from apps.links.models import Link
        team = getattr(self.request, "team", None)
        link_filter = {"id": link_id}
        if team:
            link_filter["team"] = team
        else:
            link_filter["user"] = self.request.user
            link_filter["team__isnull"] = True

        if not Link.objects.filter(**link_filter).exists():
            return Rule.objects.none()

        return Rule.objects.filter(link_id=link_id).order_by("-priority", "created_at")

    @extend_schema(tags=["Rules"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class QRCodeRulesView(generics.ListAPIView):
    """
    List rules for a specific QR code.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = RuleSerializer

    def get_queryset(self):
        qr_code_id = self.kwargs.get("qr_code_id")

        # Verify QR code ownership
        from apps.qrcodes.models import QRCode
        team = getattr(self.request, "team", None)
        qr_filter = {"id": qr_code_id}
        if team:
            qr_filter["team"] = team
        else:
            qr_filter["user"] = self.request.user
            qr_filter["team__isnull"] = True

        if not QRCode.objects.filter(**qr_filter).exists():
            return Rule.objects.none()

        return Rule.objects.filter(qr_code_id=qr_code_id).order_by("-priority", "created_at")

    @extend_schema(tags=["Rules"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class RuleGroupListCreateView(generics.ListCreateAPIView):
    """
    List rule groups or create a new one.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active", "logic"]
    search_fields = ["name", "description"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateRuleGroupSerializer
        return RuleGroupSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return RuleGroup.objects.filter(team=team).prefetch_related("conditions")
        return RuleGroup.objects.filter(
            user=self.request.user, team__isnull=True
        ).prefetch_related("conditions")

    @extend_schema(tags=["Rule Groups"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CreateRuleGroupSerializer,
        responses={201: RuleGroupSerializer},
        tags=["Rule Groups"]
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateRuleGroupSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(
            RuleGroupSerializer(group).data,
            status=status.HTTP_201_CREATED
        )


class RuleGroupDetailView(generics.RetrieveDestroyAPIView):
    """
    Get or delete a rule group.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]
    serializer_class = RuleGroupSerializer

    def get_queryset(self):
        team = getattr(self.request, "team", None)
        if team:
            return RuleGroup.objects.filter(team=team).prefetch_related("conditions")
        return RuleGroup.objects.filter(
            user=self.request.user, team__isnull=True
        ).prefetch_related("conditions")

    @extend_schema(tags=["Rule Groups"])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(tags=["Rule Groups"])
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class TestRulesView(APIView):
    """
    Test rule evaluation with simulated context.
    Useful for debugging rules before they're live.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(
        request=TestRuleSerializer,
        tags=["Rules"]
    )
    def post(self, request):
        serializer = TestRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        link_id = data.get("link_id")
        qr_code_id = data.get("qr_code_id")

        # Get rules
        if link_id:
            from apps.links.models import Link
            try:
                link = Link.objects.get(id=link_id, user=request.user)
            except Link.DoesNotExist:
                return Response({"error": "Link not found"}, status=404)
            rules = get_rules_for_link(link)
            original_url = link.destination_url
        else:
            from apps.qrcodes.models import QRCode
            try:
                qr = QRCode.objects.get(id=qr_code_id, user=request.user)
            except QRCode.DoesNotExist:
                return Response({"error": "QR code not found"}, status=404)
            rules = get_rules_for_qr_code(qr)
            original_url = qr.get_redirect_url()

        # Build test context
        test_time = timezone.now()
        if data.get("time_hour") is not None:
            test_time = test_time.replace(hour=data["time_hour"])
        if data.get("day_of_week") is not None:
            # Adjust date to match day of week
            current_dow = test_time.weekday()
            target_dow = data["day_of_week"]
            delta = target_dow - current_dow
            test_time = test_time + timezone.timedelta(days=delta)

        context = {
            "country_code": data.get("country_code", "").upper(),
            "city": data.get("city", ""),
            "device_type": data.get("device_type", ""),
            "os": data.get("os", ""),
            "browser": data.get("browser", ""),
            "language": data.get("language", ""),
            "referrer": data.get("referrer", ""),
            "time": test_time,
            "scan_count": data.get("scan_count", 0),
            "is_first_scan": data.get("is_first_scan", False),
            "query_params": {},
        }

        # Evaluate rules
        result = RuleEngine.evaluate(rules, context)

        if result:
            # Apply action
            action_result = RuleEngine.apply_action(
                result["action"],
                result["value"],
                original_url
            )

            return Response({
                "matched": True,
                "rule": {
                    "id": result["rule_id"],
                    "name": result["rule_name"],
                    "action": result["action"],
                    "action_value": result["value"],
                },
                "result": action_result,
                "context_used": context,
            })

        return Response({
            "matched": False,
            "rule": None,
            "result": {
                "type": "redirect",
                "url": original_url,
            },
            "context_used": context,
        })


class RuleStatsView(APIView):
    """
    Get statistics for rules on a link or QR code.
    """
    permission_classes = [IsAuthenticated, HasPaidPlan]

    @extend_schema(
        parameters=[
            OpenApiParameter("link_id", str, description="Link ID"),
            OpenApiParameter("qr_code_id", str, description="QR code ID"),
        ],
        tags=["Rules"]
    )
    def get(self, request):
        link_id = request.query_params.get("link_id")
        qr_code_id = request.query_params.get("qr_code_id")

        if not link_id and not qr_code_id:
            return Response(
                {"error": "link_id or qr_code_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        team = getattr(request, "team", None)

        if link_id:
            rule_filter = {"link_id": link_id}
        else:
            rule_filter = {"qr_code_id": qr_code_id}

        if team:
            rule_filter["team"] = team
        else:
            rule_filter["user"] = request.user
            rule_filter["team__isnull"] = True

        rules = Rule.objects.filter(**rule_filter)

        stats = {
            "total_rules": rules.count(),
            "active_rules": rules.filter(is_active=True).count(),
            "total_matches": sum(r.times_matched for r in rules),
            "rules_by_type": {},
            "top_rules": [],
        }

        # Count by condition type
        for rule in rules:
            ct = rule.condition_type
            if ct not in stats["rules_by_type"]:
                stats["rules_by_type"][ct] = 0
            stats["rules_by_type"][ct] += 1

        # Top 5 most matched rules
        top_rules = rules.order_by("-times_matched")[:5]
        for rule in top_rules:
            stats["top_rules"].append({
                "id": str(rule.id),
                "name": rule.name,
                "times_matched": rule.times_matched,
                "last_matched": rule.last_matched_at,
            })

        return Response(stats)
