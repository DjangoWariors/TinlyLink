"""
Celery tasks for campaigns app.
Scheduling and status management.
"""

import logging

from celery import shared_task
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(queue="default")
def update_campaign_statuses():
    """
    Update campaign statuses based on schedule and budget.
    Runs every minute via Celery Beat.

    Actions:
    - Activate scheduled campaigns when start time is reached
    - Complete campaigns when end time passes
    - Complete campaigns when click budget is exhausted
    """
    from .models import Campaign

    now = timezone.now()

    # Activate scheduled campaigns that have started
    activated = Campaign.objects.filter(
        status="scheduled",
        starts_at__lte=now,
    ).exclude(
        ends_at__lt=now  # Don't activate if already ended
    ).update(status="active")

    if activated:
        logger.info(f"Activated {activated} scheduled campaigns")

    # Complete campaigns that have ended
    completed_by_time = Campaign.objects.filter(
        status="active",
        ends_at__lt=now,
    ).update(status="completed")

    if completed_by_time:
        logger.info(f"Completed {completed_by_time} campaigns (end time reached)")

    # Complete campaigns that exhausted their click budget
    completed_by_budget = Campaign.objects.filter(
        status="active",
        click_budget__isnull=False,
        clicks_used__gte=models.F("click_budget"),
    ).update(status="completed")

    if completed_by_budget:
        logger.info(f"Completed {completed_by_budget} campaigns (budget exhausted)")

    total_changes = activated + completed_by_time + completed_by_budget
    return f"Updated {total_changes} campaigns"


@shared_task(queue="default")
def sync_campaign_stats():
    """
    Sync denormalized campaign stats from links.
    Runs hourly.
    """
    from .models import Campaign
    from django.db.models import Count, Sum

    updated = 0

    for campaign in Campaign.objects.filter(status__in=["active", "scheduled"]).iterator():
        stats = campaign.links.aggregate(
            total_links=Count("id"),
            total_clicks=Sum("total_clicks")
        )

        Campaign.objects.filter(id=campaign.id).update(
            total_links=stats["total_links"] or 0,
            total_clicks=stats["total_clicks"] or 0,
        )
        updated += 1

    logger.info(f"Synced stats for {updated} campaigns")
    return f"Synced {updated} campaigns"


@shared_task(queue="default")
def send_campaign_notifications():
    """
    Send notifications for campaign events.
    - Campaign started
    - Campaign ending soon (24h)
    - Campaign completed
    - Budget nearly exhausted (90%)
    """
    from .models import Campaign
    from apps.users.tasks import send_async_email_notification
    from datetime import timedelta

    now = timezone.now()

    # Campaigns ending in 24 hours
    ending_soon = Campaign.objects.filter(
        status="active",
        ends_at__gt=now,
        ends_at__lte=now + timedelta(hours=24),
    ).select_related("user")

    for campaign in ending_soon:
        # Check if notification already sent (using tags)
        if "ending_soon_notified" not in campaign.tags:
            send_async_email_notification.delay(
                user_id=str(campaign.user_id),
                subject=f"Campaign '{campaign.name}' ending soon",
                template="emails/campaign_ending_soon.html",
                context={
                    "campaign_name": campaign.name,
                    "ends_at": campaign.ends_at.isoformat(),
                }
            )
            # Mark as notified
            campaign.tags.append("ending_soon_notified")
            campaign.save(update_fields=["tags"])

    # Campaigns with budget nearly exhausted (90%)
    budget_warning = Campaign.objects.filter(
        status="active",
        click_budget__isnull=False,
    ).annotate(
        budget_percent=models.F("clicks_used") * 100 / models.F("click_budget")
    ).filter(
        budget_percent__gte=90,
        budget_percent__lt=100,
    ).select_related("user")

    for campaign in budget_warning:
        if "budget_warning_notified" not in campaign.tags:
            send_async_email_notification.delay(
                user_id=str(campaign.user_id),
                subject=f"Campaign '{campaign.name}' budget nearly exhausted",
                template="emails/campaign_budget_warning.html",
                context={
                    "campaign_name": campaign.name,
                    "clicks_used": campaign.clicks_used,
                    "click_budget": campaign.click_budget,
                }
            )
            campaign.tags.append("budget_warning_notified")
            campaign.save(update_fields=["tags"])

    return "Notifications sent"
