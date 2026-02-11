"""
Celery tasks for user operations.
Email sending, cleanup, reports.
"""

import logging
from datetime import datetime, timedelta, timezone as dt_tz

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_email_notification(
    recipient_email,
    subject,
    text_message,
    html_template=None,
    template_context=None,
    fail_silently=False,
):
    """
    Helper to send email notifications consistently.

    Args:
        recipient_email: Email address to send to
        subject: Email subject line
        text_message: Plain text message body
        html_template: Optional path to HTML template (e.g., "emails/verification.html")
        template_context: Context dict for rendering HTML template
        fail_silently: Whether to suppress exceptions from send_mail

    Returns:
        True if email was sent, False otherwise
    """
    html_message = None
    if html_template and template_context:
        html_message = render_to_string(html_template, template_context)

    send_mail(
        subject=subject,
        message=text_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient_email],
        html_message=html_message,
        fail_silently=fail_silently,
    )
    return True


@shared_task(bind=True, max_retries=3, queue="priority")
def send_async_email_notification(self, user_id, subject, template=None, context=None, text_message=None):
    """
    Celery task wrapper for sending email notifications.
    Used when email sending needs to be deferred via .delay().
    """
    from .models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for email notification")
        return "User not found"

    try:
        if not text_message:
            text_message = subject

        send_email_notification(
            recipient_email=user.email,
            subject=subject,
            text_message=text_message,
            html_template=template,
            template_context={**(context or {}), "user": user},
        )
        logger.info(f"Async email notification sent to {user.email}: {subject}")
        return "Email sent"
    except Exception as e:
        logger.exception(f"Failed to send async email notification: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3, queue="priority")
def send_export_ready_email(self, user_id, download_url):
    """
    Send email notification when an analytics export is ready for download.
    """
    from .models import User

    try:
        user = User.objects.get(id=user_id)

        text_message = f"""Hi {user.display_name},

Your analytics export is ready for download.

Download link: {download_url}

This link expires in 24 hours.

Thanks,
The TinlyLink Team"""

        send_email_notification(
            recipient_email=user.email,
            subject="Your TinlyLink analytics export is ready",
            text_message=text_message,
        )

        logger.info(f"Export ready email sent to {user.email}")
        return "Email sent"

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for export ready email")
        return "User not found"
    except Exception as e:
        logger.exception(f"Failed to send export ready email: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3, queue="priority")
def send_verification_email(self, user_id):
    """
    Send email verification to user.
    """
    from .models import User
    
    try:
        user = User.objects.get(id=user_id)
        
        if user.email_verified:
            return "Email already verified"
        
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={user.email_verification_token}"
        
        subject = "Verify your TinlyLink account"
        
        html_message = render_to_string("emails/verification.html", {
            "user": user,
            "verification_url": verification_url,
        })
        
        text_message = f"""
Hi {user.display_name},

Please verify your email address by clicking the link below:

{verification_url}

This link expires in 24 hours.

Thanks,
The TinlyLink Team
        """
        
        send_mail(
            subject=subject,
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Verification email sent to {user.email}")
        return "Email sent"
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for verification email")
        return "User not found"
    except Exception as e:
        logger.exception(f"Failed to send verification email: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3, queue="priority")
def send_password_reset_email(self, user_id, token):
    """
    Send password reset email to user.
    """
    from .models import User

    try:
        user = User.objects.get(id=user_id)

        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

        text_message = f"""
Hi {user.display_name},

You requested to reset your password. Click the link below to set a new password:

{reset_url}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

Thanks,
The TinlyLink Team
        """

        send_email_notification(
            recipient_email=user.email,
            subject="Reset your TinlyLink password",
            text_message=text_message,
            html_template="emails/password_reset.html",
            template_context={"user": user, "reset_url": reset_url},
        )

        logger.info(f"Password reset email sent to {user.email}")
        return "Email sent"

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for password reset email")
        return "User not found"
    except Exception as e:
        logger.exception(f"Failed to send password reset email: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3, queue="priority")
def send_payment_failed_email(self, user_id):
    """
    Notify user that their payment failed and subscription is past_due.
    """
    from .models import User

    try:
        user = User.objects.get(id=user_id)

        text_message = f"""
Hi {user.display_name},

We were unable to process your latest payment. Your account has been
placed in a limited state.

Please update your payment method to continue using TinlyLink:
{settings.FRONTEND_URL}/dashboard/settings?tab=billing

If you need help, reply to this email.

Thanks,
The TinlyLink Team
        """

        send_email_notification(
            recipient_email=user.email,
            subject="TinlyLink: Payment failed — action needed",
            text_message=text_message,
        )

        logger.info(f"Payment failed email sent to {user.email}")
        return "Email sent"

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for payment failed email")
        return "User not found"
    except Exception as e:
        logger.exception(f"Failed to send payment failed email: {e}")
        raise self.retry(exc=e, countdown=120)


@shared_task(queue="priority")
def send_usage_warning_email(user_id, resource, percent_used):
    """
    Send usage warning when user reaches 80% of their limit.
    """
    from .models import User

    try:
        user = User.objects.get(id=user_id)

        text_message = f"""
Hi {user.display_name},

You've used {percent_used}% of your monthly {resource} limit.

Consider upgrading your plan to get more capacity and unlock additional features.

Upgrade here: {settings.FRONTEND_URL}/dashboard/settings/billing

Thanks,
The TinlyLink Team
        """

        send_email_notification(
            recipient_email=user.email,
            subject=f"TinlyLink: You've used {percent_used}% of your {resource}",
            text_message=text_message,
        )

        logger.info(f"Usage warning sent to {user.email} for {resource}")

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for usage warning")
    except Exception as e:
        logger.exception(f"Failed to send usage warning: {e}")


@shared_task(queue="default")
def send_weekly_reports():
    """
    Send weekly analytics reports to users.
    Runs every Monday at 9am.
    """
    from .models import User
    from apps.links.models import Link
    from apps.analytics.models import ClickEvent
    
    # Get users who want weekly reports and have activity
    users = User.objects.filter(
        is_active=True,
        email_verified=True,
    ).select_related("subscription")
    
    last_week = timezone.now() - timedelta(days=7)
    
    for user in users:
        try:
            # Get stats for the week
            links_count = Link.objects.filter(
                user=user,
                created_at__gte=last_week
            ).count()
            
            total_clicks = ClickEvent.objects.filter(
                link__user=user,
                clicked_at__gte=last_week
            ).count()
            
            # Only send if there's activity
            if links_count == 0 and total_clicks == 0:
                continue
            
            text_message = f"""
Hi {user.display_name},

Here's your TinlyLink activity for the past week:

Quick Stats:
- New links created: {links_count}
- Total clicks: {total_clicks}

View detailed analytics: {settings.FRONTEND_URL}/dashboard/analytics

Thanks,
The TinlyLink Team
            """

            send_email_notification(
                recipient_email=user.email,
                subject="Your TinlyLink Weekly Report",
                text_message=text_message,
                fail_silently=True,
            )
            
        except Exception as e:
            logger.exception(f"Failed to send weekly report to {user.email}: {e}")
    
    logger.info("Weekly reports sent")


@shared_task(queue="bulk")
def cleanup_unverified_users():
    """
    Delete users who haven't verified their email after 7 days.
    Runs daily at 3am UTC.
    """
    from .models import User
    
    cutoff = timezone.now() - timedelta(days=7)
    
    # Get unverified users older than 7 days
    unverified = User.objects.filter(
        email_verified=False,
        created_at__lt=cutoff,
        is_staff=False,
    )
    
    count = unverified.count()
    
    if count > 0:
        unverified.delete()
        logger.info(f"Deleted {count} unverified users")
    
    return f"Deleted {count} users"


@shared_task(queue="bulk")
def cleanup_scheduled_deletions():
    """
    Permanently delete accounts scheduled for deletion.
    """
    from .models import User
    
    # Get users whose deletion time has passed
    users_to_delete = User.objects.filter(
        deletion_scheduled_at__lte=timezone.now(),
        is_active=False,
    )
    
    count = users_to_delete.count()
    
    if count > 0:
        # This will cascade delete related objects
        users_to_delete.delete()
        logger.info(f"Permanently deleted {count} accounts")
    
    return f"Deleted {count} accounts"


@shared_task(queue="default")
def sync_stripe_subscription(subscription_id):
    """
    Sync subscription status from Stripe.
    """
    import stripe
    from .models import Subscription
    
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    try:
        subscription = Subscription.objects.get(stripe_subscription_id=subscription_id)
        
        # Fetch from Stripe
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        
        # Update local subscription
        subscription.status = stripe_sub.status
        subscription.current_period_start = datetime.fromtimestamp(
            stripe_sub.current_period_start, tz=dt_tz.utc
        )
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_sub.current_period_end, tz=dt_tz.utc
        )
        subscription.cancel_at_period_end = stripe_sub.cancel_at_period_end
        subscription.save()
        
        logger.info(f"Synced subscription {subscription_id}")
        
    except Subscription.DoesNotExist:
        logger.error(f"Subscription {subscription_id} not found")
    except Exception as e:
        logger.exception(f"Failed to sync subscription: {e}")


@shared_task(bind=True, max_retries=2, queue="bulk")
def process_data_export(self, job_id):
    """
    Process data export request (GDPR compliance).
    """
    import json
    import zipfile
    from io import BytesIO
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    
    from .models import User, ExportJob
    from apps.links.models import Link
    from apps.analytics.models import ClickEvent
    
    try:
        job = ExportJob.objects.get(id=job_id)
        job.status = "processing"
        job.started_at = timezone.now()
        job.save()
        
        user = job.user
        export_type = job.export_type
        
        # Create ZIP file
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            
            # User data (always included)
            user_data = {
                "email": user.email,
                "full_name": user.full_name,
                "company": user.company,
                "email_verified": user.email_verified,
                "created_at": user.created_at.isoformat(),
            }
            zf.writestr("user_profile.json", json.dumps(user_data, indent=2))
            
            # Links data
            if export_type in ["links", "all"]:
                links = Link.objects.filter(user=user)
                links_data = [{
                    "short_code": l.short_code,
                    "original_url": l.original_url,
                    "title": l.title,
                    "total_clicks": l.total_clicks,
                    "created_at": l.created_at.isoformat(),
                } for l in links]
                zf.writestr("links.json", json.dumps(links_data, indent=2))
            
            # Analytics data
            if export_type in ["analytics", "all"]:
                link_ids = list(Link.objects.filter(user=user).values_list("id", flat=True))
                clicks = ClickEvent.objects.filter(link_id__in=link_ids)[:10000]
                analytics_data = [{
                    "clicked_at": c.clicked_at.isoformat(),
                    "country": c.country_name,
                    "city": c.city,
                    "device": c.device_type,
                    "browser": c.browser,
                } for c in clicks]
                zf.writestr("analytics.json", json.dumps(analytics_data, indent=2))
        
        zip_buffer.seek(0)
        
        # Save to storage
        filename = f"exports/{user.id}/data-export-{timezone.now().strftime('%Y%m%d-%H%M%S')}.zip"
        path = default_storage.save(filename, ContentFile(zip_buffer.read()))
        
        # Update job
        job.status = "completed"
        job.completed_at = timezone.now()
        job.file_url = default_storage.url(path)
        job.file_size = zip_buffer.tell()
        job.expires_at = timezone.now() + timedelta(days=7)
        job.save()
        
        # Send email notification
        send_email_notification(
            recipient_email=user.email,
            subject="Your TinlyLink data export is ready",
            text_message=f"Your data export is ready for download.\n\nDownload link: {job.file_url}\n\nThis link expires in 7 days.",
            fail_silently=True,
        )
        
        logger.info(f"Data export completed for user {user.email}")
        return "Export completed"
        
    except ExportJob.DoesNotExist:
        logger.error(f"Export job {job_id} not found")
        return "Job not found"
    except Exception as e:
        logger.exception(f"Data export failed: {e}")
        
        try:
            job = ExportJob.objects.get(id=job_id)
            job.status = "failed"
            job.error_message = str(e)
            job.save()
        except Exception as inner_e:
            logger.error(f"Failed to update export job {job_id} status to failed: {inner_e}")
        
        raise self.retry(exc=e, countdown=300)


@shared_task(queue="default")
def sync_all_stripe_subscriptions():
    """
    Sync all active Stripe subscriptions.
    Runs daily at 5am UTC to keep local data in sync.
    """
    from .models import Subscription

    active_subs = Subscription.objects.filter(
        stripe_subscription_id__gt="",
        status__in=["active", "past_due", "trialing"],
    ).values_list("stripe_subscription_id", flat=True)

    synced = 0
    for sub_id in active_subs:
        sync_stripe_subscription.delay(sub_id)
        synced += 1

    logger.info(f"Queued sync for {synced} active subscriptions")
    return f"Queued {synced} subscription syncs"


@shared_task(queue="bulk")
def cleanup_expired_sessions():
    """
    Delete sessions that have been inactive for more than 30 days.
    Runs daily at 4am UTC.
    """
    from .session_utils import cleanup_expired_sessions as do_cleanup
    
    count = do_cleanup(days=30)
    
    if count > 0:
        logger.info(f"Cleaned up {count} expired sessions")
    
    return f"Deleted {count} expired sessions"
