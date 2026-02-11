"""
Rules Engine models for conditional redirects.
Enables dynamic content delivery based on user context.
"""

import uuid

from django.conf import settings
from django.db import models


class Rule(models.Model):
    """
    Conditional rule for dynamic redirect behavior.
    Rules are evaluated in priority order (highest first).
    First matching rule determines the action.
    """

    # Condition types - what to check
    CONDITION_TYPE_CHOICES = [
        # Geographic
        ("country", "Country"),
        ("city", "City"),
        ("region", "Region/State"),
        # Device
        ("device", "Device Type"),
        ("os", "Operating System"),
        ("browser", "Browser"),
        # User context
        ("language", "Language"),
        ("referrer", "Referrer Domain"),
        # Time-based
        ("time", "Time of Day (Hour)"),
        ("date", "Date"),
        ("day_of_week", "Day of Week"),
        # Scan/click context
        ("scan_count", "Scan/Click Count"),
        ("is_first_scan", "Is First Scan"),
        # Custom
        ("query_param", "Query Parameter"),
    ]

    # Operators for condition matching
    OPERATOR_CHOICES = [
        ("eq", "Equals"),
        ("neq", "Not Equals"),
        ("contains", "Contains"),
        ("not_contains", "Does Not Contain"),
        ("starts_with", "Starts With"),
        ("ends_with", "Ends With"),
        ("gt", "Greater Than"),
        ("gte", "Greater Than or Equal"),
        ("lt", "Less Than"),
        ("lte", "Less Than or Equal"),
        ("between", "Between"),
        ("in", "In List"),
        ("not_in", "Not In List"),
        ("regex", "Matches Regex"),
    ]

    # Action types - what to do when rule matches
    ACTION_TYPE_CHOICES = [
        ("redirect", "Redirect to URL"),
        ("show_content", "Show Content Page"),
        ("block", "Block Access"),
        ("add_utm", "Add UTM Parameters"),
        ("set_header", "Set Response Header"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Owner
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rules"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )

    # Can be attached to Link, QRCode, Campaign, or SerialBatch
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )
    qr_code = models.ForeignKey(
        "qrcodes.QRCode",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )
    serial_batch = models.ForeignKey(
        "qrcodes.SerialBatch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rules"
    )

    # Rule identification
    name = models.CharField(max_length=100, help_text="Descriptive name for this rule")
    description = models.TextField(blank=True, help_text="Optional description of rule purpose")

    # Priority - higher values are evaluated first
    priority = models.IntegerField(
        default=0,
        help_text="Higher priority rules are evaluated first"
    )

    # Condition definition
    condition_type = models.CharField(max_length=30, choices=CONDITION_TYPE_CHOICES)
    condition_operator = models.CharField(max_length=20, choices=OPERATOR_CHOICES)
    condition_value = models.JSONField(
        help_text="Value(s) to match against. Format depends on operator."
    )
    # For query_param condition type, store the param name
    condition_key = models.CharField(
        max_length=100,
        blank=True,
        help_text="Key for query_param conditions"
    )

    # Action definition
    action_type = models.CharField(max_length=30, choices=ACTION_TYPE_CHOICES)
    action_value = models.JSONField(
        help_text="Action configuration. Format depends on action type."
    )

    # Status
    is_active = models.BooleanField(default=True)

    # Schedule (optional - rule only active during this period)
    schedule_start = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Rule becomes active at this time"
    )
    schedule_end = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Rule deactivates at this time"
    )

    # Stats
    times_matched = models.IntegerField(default=0)
    last_matched_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rules"
        ordering = ["-priority", "created_at"]
        constraints = [
            # Rule must be attached to exactly one target
            models.CheckConstraint(
                check=(
                    models.Q(link__isnull=False, qr_code__isnull=True, campaign__isnull=True, serial_batch__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=False, campaign__isnull=True, serial_batch__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=True, campaign__isnull=False, serial_batch__isnull=True) |
                    models.Q(link__isnull=True, qr_code__isnull=True, campaign__isnull=True, serial_batch__isnull=False)
                ),
                name="rule_must_have_one_target"
            ),
        ]
        indexes = [
            models.Index(fields=["link", "is_active", "-priority"]),
            models.Index(fields=["qr_code", "is_active", "-priority"]),
            models.Index(fields=["campaign", "is_active", "-priority"]),
            models.Index(fields=["serial_batch", "is_active", "-priority"]),
        ]

    def __str__(self):
        target = self.link or self.qr_code
        return f"{self.name} ({self.condition_type} {self.condition_operator}) -> {target}"

    @property
    def is_scheduled_active(self):
        """Check if rule is currently active based on schedule."""
        from django.utils import timezone

        if not self.is_active:
            return False

        now = timezone.now()

        if self.schedule_start and now < self.schedule_start:
            return False

        if self.schedule_end and now > self.schedule_end:
            return False

        return True

    def increment_matches(self):
        """Increment match counter."""
        from django.utils import timezone

        Rule.objects.filter(id=self.id).update(
            times_matched=models.F("times_matched") + 1,
            last_matched_at=timezone.now()
        )


class RuleGroup(models.Model):
    """
    Group of rules with AND/OR logic.
    Allows complex conditions like "US AND mobile" or "UK OR DE OR FR".
    """

    LOGIC_CHOICES = [
        ("and", "All conditions must match (AND)"),
        ("or", "Any condition can match (OR)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Owner
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rule_groups"
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rule_groups"
    )

    # Can be attached to Link, QRCode, Campaign, or SerialBatch
    link = models.ForeignKey(
        "links.Link",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rule_groups"
    )
    qr_code = models.ForeignKey(
        "qrcodes.QRCode",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rule_groups"
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rule_groups"
    )
    serial_batch = models.ForeignKey(
        "qrcodes.SerialBatch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="rule_groups"
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Logic for combining rules
    logic = models.CharField(max_length=10, choices=LOGIC_CHOICES, default="and")

    # Priority
    priority = models.IntegerField(default=0)

    # Action (same as Rule)
    action_type = models.CharField(max_length=30, choices=Rule.ACTION_TYPE_CHOICES)
    action_value = models.JSONField()

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rule_groups"
        ordering = ["-priority", "created_at"]

    def __str__(self):
        return f"{self.name} ({self.logic.upper()})"


class RuleCondition(models.Model):
    """
    Individual condition within a RuleGroup.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        RuleGroup,
        on_delete=models.CASCADE,
        related_name="conditions"
    )

    condition_type = models.CharField(max_length=30, choices=Rule.CONDITION_TYPE_CHOICES)
    condition_operator = models.CharField(max_length=20, choices=Rule.OPERATOR_CHOICES)
    condition_value = models.JSONField()
    condition_key = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "rule_conditions"

    def __str__(self):
        return f"{self.condition_type} {self.condition_operator} {self.condition_value}"
