import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, queue="priority")
def send_contact_email(self, name, email, subject, message):
    """Send contact form submission to the support team and confirmation to the sender."""
    try:
        subject_labels = {
            "general": "General Inquiry",
            "support": "Technical Support",
            "billing": "Billing Question",
            "bug": "Bug Report",
            "feature": "Feature Request",
            "other": "Other",
        }
        subject_label = subject_labels.get(subject, subject)

        # Send to support team
        send_mail(
            subject=f"[TinlyLink Contact] {subject_label} from {name}",
            message=(
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Topic: {subject_label}\n\n"
                f"Message:\n{message}"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.DEFAULT_FROM_EMAIL],
            fail_silently=False,
        )

        # Send confirmation to the sender
        send_mail(
            subject="We received your message - TinlyLink",
            message=(
                f"Hi {name},\n\n"
                f"Thanks for reaching out. We received your message about \"{subject_label}\" "
                f"and will get back to you within 1-2 business days.\n\n"
                f"For reference, here's what you sent:\n\n"
                f"---\n{message}\n---\n\n"
                f"Best,\n"
                f"The TinlyLink Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        logger.info("Contact form email sent: %s (%s)", subject_label, email)
        return f"Contact email sent for {email}"

    except Exception as exc:
        logger.error("Failed to send contact email: %s", exc)
        raise self.retry(exc=exc, countdown=60)
