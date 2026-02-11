"""
Serializers for Rules Engine API.
"""

from rest_framework import serializers

from apps.users.exceptions import FeatureNotAvailable
from .models import Rule, RuleGroup, RuleCondition


class RuleSerializer(serializers.ModelSerializer):
    """Serializer for Rule model."""

    link_title = serializers.SerializerMethodField()
    qr_code_title = serializers.SerializerMethodField()
    campaign_name = serializers.SerializerMethodField()
    serial_batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Rule
        fields = [
            "id", "name", "description",
            "link", "link_title", "qr_code", "qr_code_title",
            "campaign", "campaign_name", "serial_batch", "serial_batch_name",
            "priority",
            "condition_type", "condition_operator", "condition_value", "condition_key",
            "action_type", "action_value",
            "is_active", "schedule_start", "schedule_end",
            "times_matched", "last_matched_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "times_matched", "last_matched_at", "created_at", "updated_at"]

    def get_link_title(self, obj):
        if obj.link:
            return obj.link.title or obj.link.short_code
        return None

    def get_qr_code_title(self, obj):
        if obj.qr_code:
            return obj.qr_code.title or str(obj.qr_code.id)[:8]
        return None

    def get_campaign_name(self, obj):
        if obj.campaign:
            return obj.campaign.name
        return None

    def get_serial_batch_name(self, obj):
        if obj.serial_batch:
            return obj.serial_batch.name
        return None


class CreateRuleSerializer(serializers.Serializer):
    """Serializer for creating a new rule."""

    # Basic info
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    priority = serializers.IntegerField(default=0, min_value=-1000, max_value=1000)

    # Target (exactly one of these is required)
    link_id = serializers.UUIDField(required=False, allow_null=True)
    qr_code_id = serializers.UUIDField(required=False, allow_null=True)
    campaign_id = serializers.UUIDField(required=False, allow_null=True)
    serial_batch_id = serializers.UUIDField(required=False, allow_null=True)

    # Condition
    condition_type = serializers.ChoiceField(choices=Rule.CONDITION_TYPE_CHOICES)
    condition_operator = serializers.ChoiceField(choices=Rule.OPERATOR_CHOICES)
    condition_value = serializers.JSONField()
    condition_key = serializers.CharField(max_length=100, required=False, allow_blank=True)

    # Action
    action_type = serializers.ChoiceField(choices=Rule.ACTION_TYPE_CHOICES)
    action_value = serializers.JSONField()

    # Status
    is_active = serializers.BooleanField(default=True)
    schedule_start = serializers.DateTimeField(required=False, allow_null=True)
    schedule_end = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        # Must have exactly one target
        link_id = attrs.get("link_id")
        qr_code_id = attrs.get("qr_code_id")
        campaign_id = attrs.get("campaign_id")
        serial_batch_id = attrs.get("serial_batch_id")

        targets = [t for t in [link_id, qr_code_id, campaign_id, serial_batch_id] if t]
        if len(targets) == 0:
            raise serializers.ValidationError(
                "One of link_id, qr_code_id, campaign_id, or serial_batch_id is required."
            )
        if len(targets) > 1:
            raise serializers.ValidationError(
                "Specify exactly one target: link_id, qr_code_id, campaign_id, or serial_batch_id."
            )

        # Check plan permissions
        request = self.context.get("request")
        subscription = getattr(request.user, "subscription", None)
        plan = subscription.plan if subscription else "free"

        if plan == "free":
            raise FeatureNotAvailable(
                detail="Conditional rules are only available on paid plans."
            )

        team = getattr(request, "team", None)

        # Validate link ownership
        if link_id:
            from apps.links.models import Link
            link_filter = {"id": link_id}
            if team:
                link_filter["team"] = team
            else:
                link_filter["user"] = request.user
                link_filter["team__isnull"] = True

            if not Link.objects.filter(**link_filter).exists():
                raise serializers.ValidationError({"link_id": "Link not found."})

        # Validate QR code ownership
        if qr_code_id:
            from apps.qrcodes.models import QRCode
            qr_filter = {"id": qr_code_id}
            if team:
                qr_filter["team"] = team
            else:
                qr_filter["user"] = request.user
                qr_filter["team__isnull"] = True

            if not QRCode.objects.filter(**qr_filter).exists():
                raise serializers.ValidationError({"qr_code_id": "QR code not found."})

        # Validate campaign ownership
        if campaign_id:
            from apps.campaigns.models import Campaign
            camp_filter = {"id": campaign_id}
            if team:
                camp_filter["team"] = team
            else:
                camp_filter["user"] = request.user
                camp_filter["team__isnull"] = True

            if not Campaign.objects.filter(**camp_filter).exists():
                raise serializers.ValidationError({"campaign_id": "Campaign not found."})

        # Validate serial batch ownership
        if serial_batch_id:
            from apps.qrcodes.models import SerialBatch
            batch_filter = {"id": serial_batch_id}
            if team:
                batch_filter["team"] = team
            else:
                batch_filter["user"] = request.user
                batch_filter["team__isnull"] = True

            if not SerialBatch.objects.filter(**batch_filter).exists():
                raise serializers.ValidationError({"serial_batch_id": "Serial batch not found."})

        # Validate action value based on action type
        action_type = attrs.get("action_type")
        action_value = attrs.get("action_value", {})

        if action_type == "redirect":
            if not action_value.get("url"):
                raise serializers.ValidationError(
                    {"action_value": "URL is required for redirect action."}
                )

        elif action_type == "add_utm":
            # Validate UTM params
            valid_utm = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
            if not any(key in action_value for key in valid_utm):
                raise serializers.ValidationError(
                    {"action_value": "At least one UTM parameter is required."}
                )

        # Validate schedule
        if attrs.get("schedule_start") and attrs.get("schedule_end"):
            if attrs["schedule_start"] >= attrs["schedule_end"]:
                raise serializers.ValidationError(
                    {"schedule_end": "End time must be after start time."}
                )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        link_id = validated_data.pop("link_id", None)
        qr_code_id = validated_data.pop("qr_code_id", None)
        campaign_id = validated_data.pop("campaign_id", None)
        serial_batch_id = validated_data.pop("serial_batch_id", None)

        rule = Rule.objects.create(
            user=request.user,
            team=getattr(request, "team", None),
            link_id=link_id,
            qr_code_id=qr_code_id,
            campaign_id=campaign_id,
            serial_batch_id=serial_batch_id,
            **validated_data
        )

        return rule


class UpdateRuleSerializer(serializers.Serializer):
    """Serializer for updating a rule."""

    name = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    priority = serializers.IntegerField(required=False, min_value=-1000, max_value=1000)

    condition_type = serializers.ChoiceField(choices=Rule.CONDITION_TYPE_CHOICES, required=False)
    condition_operator = serializers.ChoiceField(choices=Rule.OPERATOR_CHOICES, required=False)
    condition_value = serializers.JSONField(required=False)
    condition_key = serializers.CharField(max_length=100, required=False, allow_blank=True)

    action_type = serializers.ChoiceField(choices=Rule.ACTION_TYPE_CHOICES, required=False)
    action_value = serializers.JSONField(required=False)

    is_active = serializers.BooleanField(required=False)
    schedule_start = serializers.DateTimeField(required=False, allow_null=True)
    schedule_end = serializers.DateTimeField(required=False, allow_null=True)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class RuleConditionSerializer(serializers.ModelSerializer):
    """Serializer for RuleCondition model."""

    class Meta:
        model = RuleCondition
        fields = [
            "id", "condition_type", "condition_operator",
            "condition_value", "condition_key",
        ]
        read_only_fields = ["id"]


class RuleGroupSerializer(serializers.ModelSerializer):
    """Serializer for RuleGroup model."""

    conditions = RuleConditionSerializer(many=True, read_only=True)
    link_title = serializers.SerializerMethodField()
    qr_code_title = serializers.SerializerMethodField()

    class Meta:
        model = RuleGroup
        fields = [
            "id", "name", "description",
            "link", "link_title", "qr_code", "qr_code_title",
            "logic", "priority",
            "action_type", "action_value",
            "conditions",
            "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_link_title(self, obj):
        if obj.link:
            return obj.link.title or obj.link.short_code
        return None

    def get_qr_code_title(self, obj):
        if obj.qr_code:
            return obj.qr_code.title or str(obj.qr_code.id)[:8]
        return None


class CreateRuleGroupSerializer(serializers.Serializer):
    """Serializer for creating a rule group with conditions."""

    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    logic = serializers.ChoiceField(choices=RuleGroup.LOGIC_CHOICES, default="and")
    priority = serializers.IntegerField(default=0)

    link_id = serializers.UUIDField(required=False, allow_null=True)
    qr_code_id = serializers.UUIDField(required=False, allow_null=True)

    action_type = serializers.ChoiceField(choices=Rule.ACTION_TYPE_CHOICES)
    action_value = serializers.JSONField()

    conditions = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=10,
        help_text="List of conditions to evaluate"
    )

    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        # Check plan permissions
        request = self.context.get("request")
        subscription = getattr(request.user, "subscription", None)
        plan = subscription.plan if subscription else "free"

        if plan == "free":
            raise FeatureNotAvailable(
                detail="Rule groups are only available on paid plans."
            )

        link_id = attrs.get("link_id")
        qr_code_id = attrs.get("qr_code_id")

        if not link_id and not qr_code_id:
            raise serializers.ValidationError(
                "Either link_id or qr_code_id is required."
            )

        if link_id and qr_code_id:
            raise serializers.ValidationError(
                "Cannot specify both link_id and qr_code_id."
            )

        # Validate conditions
        for i, condition in enumerate(attrs.get("conditions", [])):
            if "condition_type" not in condition:
                raise serializers.ValidationError(
                    {f"conditions[{i}]": "condition_type is required."}
                )
            if "condition_operator" not in condition:
                raise serializers.ValidationError(
                    {f"conditions[{i}]": "condition_operator is required."}
                )
            if "condition_value" not in condition:
                raise serializers.ValidationError(
                    {f"conditions[{i}]": "condition_value is required."}
                )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        conditions_data = validated_data.pop("conditions")

        link_id = validated_data.pop("link_id", None)
        qr_code_id = validated_data.pop("qr_code_id", None)

        group = RuleGroup.objects.create(
            user=request.user,
            team=getattr(request, "team", None),
            link_id=link_id,
            qr_code_id=qr_code_id,
            **validated_data
        )

        # Create conditions
        for condition in conditions_data:
            RuleCondition.objects.create(
                group=group,
                condition_type=condition["condition_type"],
                condition_operator=condition["condition_operator"],
                condition_value=condition["condition_value"],
                condition_key=condition.get("condition_key", ""),
            )

        return group


class TestRuleSerializer(serializers.Serializer):
    """Serializer for testing rule evaluation."""

    link_id = serializers.UUIDField(required=False, allow_null=True)
    qr_code_id = serializers.UUIDField(required=False, allow_null=True)

    # Context values to test with
    country_code = serializers.CharField(max_length=2, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    device_type = serializers.ChoiceField(
        choices=[("mobile", "Mobile"), ("tablet", "Tablet"), ("desktop", "Desktop")],
        required=False
    )
    os = serializers.CharField(max_length=50, required=False, allow_blank=True)
    browser = serializers.CharField(max_length=50, required=False, allow_blank=True)
    language = serializers.CharField(max_length=10, required=False, allow_blank=True)
    referrer = serializers.URLField(required=False, allow_blank=True)
    time_hour = serializers.IntegerField(min_value=0, max_value=23, required=False)
    day_of_week = serializers.IntegerField(min_value=0, max_value=6, required=False)
    scan_count = serializers.IntegerField(min_value=0, required=False)
    is_first_scan = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs.get("link_id") and not attrs.get("qr_code_id"):
            raise serializers.ValidationError(
                "Either link_id or qr_code_id is required."
            )
        return attrs
