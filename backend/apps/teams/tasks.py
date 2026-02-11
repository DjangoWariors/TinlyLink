"""
Celery tasks for teams app.
"""

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone


@shared_task(queue="priority")
def send_team_invite_email(invite_id):
    """Send team invitation email with accept link."""
    from .models import TeamInvite

    try:
        invite = TeamInvite.objects.select_related(
            "team", "invited_by"
        ).get(id=invite_id)
    except TeamInvite.DoesNotExist:
        return

    if invite.status != "pending":
        return

    accept_url = f"{settings.FRONTEND_URL}/teams/invite/{invite.token}"

    subject = f"You've been invited to join {invite.team.name} on TinlyLink"

    # Try to render HTML template, fall back to plain text
    try:
        html_message = render_to_string("emails/team_invite.html", {
            "team_name": invite.team.name,
            "inviter_name": invite.invited_by.display_name,
            "role": invite.get_role_display(),
            "accept_url": accept_url,
            "expires_at": invite.expires_at.strftime("%B %d, %Y"),
        })
    except Exception:
        # Fallback to plain text
        html_message = None

    plain_message = f"""
Hi,

{invite.invited_by.display_name} has invited you to join "{invite.team.name}" on TinlyLink as a {invite.get_role_display()}.

Click the link below to accept your invitation:
{accept_url}

This invitation expires on {invite.expires_at.strftime("%B %d, %Y")}.

If you didn't expect this invitation, you can safely ignore this email.

Best,
The TinlyLink Team
    """.strip()

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invite.email],
        html_message=html_message,
        fail_silently=False,
    )


@shared_task
def send_member_removed_email(user_email, team_name):
    """Notify user they've been removed from a team."""
    subject = f"You've been removed from {team_name}"
    message = f"""
Hi,

You have been removed from the team "{team_name}" on TinlyLink.

If you believe this was a mistake, please contact the team owner.

Best,
The TinlyLink Team
    """.strip()

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=True,
    )


@shared_task
def send_role_changed_email(user_email, team_name, new_role):
    """Notify user their role changed."""
    subject = f"Your role in {team_name} has been updated"
    message = f"""
Hi,

Your role in the team "{team_name}" on TinlyLink has been changed to {new_role}.

Best,
The TinlyLink Team
    """.strip()

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=True,
    )


@shared_task(queue="default")
def cleanup_expired_invites():
    """
    Periodic task: expire old invites.
    Run this task daily via Celery Beat.
    """
    from .models import TeamInvite

    expired_count = TeamInvite.objects.filter(
        status="pending",
        expires_at__lt=timezone.now()
    ).update(status="expired")

    return f"Expired {expired_count} invites"
