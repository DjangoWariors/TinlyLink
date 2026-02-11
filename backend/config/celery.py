"""
Celery Configuration for TinlyLink
"""

import os

from celery import Celery
from celery.schedules import crontab


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("tinlylink")


app.config_from_object("django.conf:settings", namespace="CELERY")


app.autodiscover_tasks()

# Celery Beat Schedule
app.conf.beat_schedule = {
    # Analytics aggregation
    "aggregate-hourly-stats": {
        "task": "apps.analytics.tasks.aggregate_hourly_stats",
        "schedule": crontab(minute=5),  # Every hour at :05
    },
    "aggregate-daily-stats": {
        "task": "apps.analytics.tasks.aggregate_daily_stats",
        "schedule": crontab(hour=0, minute=15),  # Daily at 00:15 UTC
    },
    
    # Cleanup tasks
    "cleanup-expired-links": {
        "task": "apps.links.tasks.cleanup_expired_links",
        "schedule": crontab(minute=0),  # Every hour
    },
    "cleanup-old-analytics": {
        "task": "apps.analytics.tasks.cleanup_old_analytics",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2am UTC
    },
    "cleanup-unverified-users": {
        "task": "apps.users.tasks.cleanup_unverified_users",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3am UTC
    },
    
    # Domain verification
    "verify-pending-domains": {
        "task": "apps.links.tasks.verify_pending_domains",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    
    # Partition maintenance
    "partition-maintenance": {
        "task": "apps.analytics.tasks.partition_maintenance",
        "schedule": crontab(day_of_month=1, hour=4, minute=0),  # Monthly
    },
    
    # Sync click counters from Redis to DB
    "sync-click-counters": {
        "task": "apps.analytics.tasks.sync_click_counters",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },

    # Sync QR scan counters from Redis to DB
    "sync-qr-scan-counters": {
        "task": "apps.analytics.tasks.sync_qr_scan_counters",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    
    # Weekly reports
    "send-weekly-reports": {
        "task": "apps.users.tasks.send_weekly_reports",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),  # Monday 9am
    },

    # Campaign scheduler - activate/complete campaigns based on schedule
    "update-campaign-statuses": {
        "task": "apps.campaigns.tasks.update_campaign_statuses",
        "schedule": crontab(minute="*"),  # Every minute
    },

    # Sync campaign stats
    "sync-campaign-stats": {
        "task": "apps.campaigns.tasks.sync_campaign_stats",
        "schedule": crontab(minute=30),  # Every hour at :30
    },

    # Sync Stripe subscriptions daily
    "sync-stripe-subscriptions": {
        "task": "apps.users.tasks.sync_all_stripe_subscriptions",
        "schedule": crontab(hour=5, minute=0),  # Daily at 5am UTC
    },

    # Cleanup scheduled account deletions
    "cleanup-scheduled-deletions": {
        "task": "apps.users.tasks.cleanup_scheduled_deletions",
        "schedule": crontab(hour=3, minute=30),  # Daily at 3:30am UTC
    },

    # Cleanup old serial batch exports
    "cleanup-expired-batch-exports": {
        "task": "apps.qrcodes.tasks.cleanup_expired_batch_exports",
        "schedule": crontab(hour=4, minute=30),  # Daily at 4:30am UTC
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f"Request: {self.request!r}")
