"""
Centralized S3/R2 client helper.

All code that needs a raw boto3 S3 client should use ``get_s3_client()``
instead of constructing one directly.  This ensures the correct endpoint,
region, and signature settings are applied regardless of whether the
backend is AWS S3 or Cloudflare R2.
"""

import boto3
from botocore.config import Config
from django.conf import settings


def get_s3_client():
    """Return a boto3 S3 client configured for the active storage backend."""
    kwargs = {
        "region_name": settings.AWS_S3_REGION_NAME,
        "config": Config(signature_version="s3v4"),
    }
    if getattr(settings, "AWS_S3_ENDPOINT_URL", None):
        kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)
