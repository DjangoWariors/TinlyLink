"""
Admin configuration for teams app.
"""

from django.contrib import admin
from .models import Team, TeamMember, TeamInvite


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "owner", "member_count", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "slug", "owner__email"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["owner"]

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = "Members"


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ["user", "team", "role", "joined_at"]
    list_filter = ["role", "joined_at"]
    search_fields = ["user__email", "team__name"]
    raw_id_fields = ["user", "team", "invited_by"]


@admin.register(TeamInvite)
class TeamInviteAdmin(admin.ModelAdmin):
    list_display = ["email", "team", "role", "status", "expires_at", "created_at"]
    list_filter = ["status", "role", "created_at"]
    search_fields = ["email", "team__name"]
    raw_id_fields = ["team", "invited_by", "accepted_by"]
    readonly_fields = ["token"]
