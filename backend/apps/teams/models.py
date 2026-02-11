"""
Team models for multi-user collaboration.
"""

import uuid
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Team(models.Model):
    """
    A team (workspace) that groups users together.
    Resources can be shared within a team.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    owner = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="owned_teams"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teams"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Team.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def member_count(self):
        return self.members.count()


class TeamMember(models.Model):
    """
    Association between a user and a team with role.
    """
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("editor", "Editor"),
        ("viewer", "Viewer"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="team_memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="viewer")

    invited_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+"
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "team_members"
        unique_together = [["team", "user"]]
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.email} ({self.role}) in {self.team.name}"

    @property
    def can_edit(self):
        """Check if member can create/edit/delete resources."""
        return self.role in ("owner", "admin", "editor")

    @property
    def can_manage(self):
        """Check if member can manage team members and invites."""
        return self.role in ("owner", "admin")

    @property
    def is_owner(self):
        """Check if member is the team owner."""
        return self.role == "owner"


class TeamInvite(models.Model):
    """
    Invitation to join a team.
    """
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("expired", "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="invites")
    email = models.EmailField()
    role = models.CharField(
        max_length=20,
        choices=TeamMember.ROLE_CHOICES,
        default="editor"
    )
    token = models.CharField(max_length=100, unique=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    invited_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="+"
    )
    accepted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+"
    )

    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "team_invites"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite {self.email} to {self.team.name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(48)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.status == "pending" and not self.is_expired
