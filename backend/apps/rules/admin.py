from django.contrib import admin
from .models import Rule, RuleGroup, RuleCondition


class RuleConditionInline(admin.TabularInline):
    model = RuleCondition
    extra = 1


@admin.register(Rule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ["name", "condition_type", "condition_operator", "action_type", "priority", "is_active", "times_matched"]
    list_filter = ["condition_type", "action_type", "is_active"]
    search_fields = ["name", "description"]
    ordering = ["-priority", "-created_at"]


@admin.register(RuleGroup)
class RuleGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "logic", "action_type", "priority", "is_active"]
    list_filter = ["logic", "action_type", "is_active"]
    search_fields = ["name", "description"]
    inlines = [RuleConditionInline]
