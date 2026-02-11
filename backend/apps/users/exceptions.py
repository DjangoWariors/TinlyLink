"""
Custom exception handler for TinlyLink.
Provides consistent error responses.
"""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.
    """
    # Get standard error response
    response = exception_handler(exc, context)
    
    # If DRF didn't handle it, create response
    if response is None:
        if isinstance(exc, DjangoValidationError):
            response = Response(
                {"error": str(exc.message) if hasattr(exc, "message") else str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif isinstance(exc, Http404):
            response = Response(
                {"error": "Not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        else:
            # Log unexpected exceptions
            logger.exception(
                "Unhandled exception",
                extra={
                    "exception": str(exc),
                    "view": context.get("view").__class__.__name__ if context.get("view") else None,
                }
            )
            response = Response(
                {"error": "An unexpected error occurred"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # Standardize error format
    if response is not None:
        # Handle validation errors
        if isinstance(exc, ValidationError):
            if isinstance(response.data, dict):
                if "detail" in response.data:
                    response.data = {"error": response.data["detail"]}
                elif "non_field_errors" in response.data:
                    response.data = {"error": response.data["non_field_errors"][0]}
                else:
                    # Field-specific errors
                    errors = {}
                    for field, messages in response.data.items():
                        if isinstance(messages, list):
                            errors[field] = messages[0]
                        else:
                            errors[field] = messages
                    response.data = {"errors": errors}
        
        # Handle other DRF exceptions
        elif hasattr(exc, "detail"):
            if isinstance(exc.detail, str):
                response.data = {"error": exc.detail}
            elif isinstance(exc.detail, dict):
                response.data = {"error": exc.detail.get("detail", str(exc.detail))}
        
        # Add status code to response
        response.data["status_code"] = response.status_code
    
    return response


class TinlyLinkException(APIException):
    """Base exception for TinlyLink."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "An error occurred"
    default_code = "error"


class UsageLimitExceeded(TinlyLinkException):
    """Exception when user exceeds usage limits."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You have exceeded your plan limits"
    default_code = "usage_limit_exceeded"


class FeatureNotAvailable(TinlyLinkException):
    """Exception when feature is not available on user's plan."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "This feature is not available on your current plan"
    default_code = "feature_not_available"


class InvalidURL(TinlyLinkException):
    """Exception for invalid URLs."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The provided URL is invalid"
    default_code = "invalid_url"


class SlugNotAvailable(TinlyLinkException):
    """Exception when slug is not available."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This short code is not available"
    default_code = "slug_not_available"


class LinkNotFound(TinlyLinkException):
    """Exception when link is not found."""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Link not found"
    default_code = "link_not_found"


class LinkExpired(TinlyLinkException):
    """Exception when link is expired."""
    status_code = status.HTTP_410_GONE
    default_detail = "This link has expired"
    default_code = "link_expired"


class PasswordRequired(TinlyLinkException):
    """Exception when password is required."""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "This link is password protected"
    default_code = "password_required"


class InvalidPassword(TinlyLinkException):
    """Exception for invalid password."""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Invalid password"
    default_code = "invalid_password"
