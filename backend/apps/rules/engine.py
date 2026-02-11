"""
Rule evaluation engine for conditional redirects.
Evaluates rules against request context and returns matching actions.
"""

import re
import logging
from typing import Optional, Dict, Any, List, Union
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from django.utils import timezone

logger = logging.getLogger(__name__)


class RuleEngine:
    """
    Evaluate rules against context and determine action.

    Context dict should contain:
    - country_code: ISO 2-letter country code (e.g., "US")
    - country_name: Full country name
    - city: City name
    - region: Region/state name
    - device_type: "mobile", "tablet", "desktop"
    - os: Operating system name (e.g., "iOS", "Android", "Windows")
    - browser: Browser name (e.g., "Chrome", "Safari", "Firefox")
    - language: Accept-Language header value
    - referrer: HTTP referer URL
    - time: Current datetime
    - scan_count: Number of previous scans/clicks
    - is_first_scan: Boolean indicating first scan
    - query_params: Dict of URL query parameters
    """

    @staticmethod
    def evaluate(rules, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Evaluate rules against context and return first matching action.

        Args:
            rules: QuerySet or list of Rule objects (should be ordered by priority)
            context: Dict containing request context data

        Returns:
            Dict with action details if a rule matches, None otherwise.
            {
                "action": "redirect" | "block" | "add_utm" | "show_content" | "set_header",
                "value": {...},  # Action-specific configuration
                "rule_id": "uuid",
                "rule_name": "Rule Name",
            }
        """
        for rule in rules:
            # Skip inactive rules
            if not rule.is_scheduled_active:
                continue

            try:
                if RuleEngine._check_condition(rule, context):
                    # Increment match counter asynchronously
                    rule.increment_matches()

                    return {
                        "action": rule.action_type,
                        "value": rule.action_value,
                        "rule_id": str(rule.id),
                        "rule_name": rule.name,
                    }
            except Exception as e:
                logger.warning(f"Error evaluating rule {rule.id}: {e}")
                continue

        return None

    @staticmethod
    def evaluate_groups(rule_groups, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Evaluate rule groups (AND/OR logic) against context.

        Args:
            rule_groups: QuerySet or list of RuleGroup objects
            context: Dict containing request context data

        Returns:
            Dict with action details if a group matches, None otherwise.
        """
        for group in rule_groups:
            if not group.is_active:
                continue

            conditions = list(group.conditions.all())
            if not conditions:
                continue

            try:
                if group.logic == "and":
                    # All conditions must match
                    matches = all(
                        RuleEngine._check_single_condition(
                            c.condition_type,
                            c.condition_operator,
                            c.condition_value,
                            c.condition_key,
                            context
                        )
                        for c in conditions
                    )
                else:
                    # Any condition can match (OR)
                    matches = any(
                        RuleEngine._check_single_condition(
                            c.condition_type,
                            c.condition_operator,
                            c.condition_value,
                            c.condition_key,
                            context
                        )
                        for c in conditions
                    )

                if matches:
                    return {
                        "action": group.action_type,
                        "value": group.action_value,
                        "rule_id": str(group.id),
                        "rule_name": group.name,
                    }

            except Exception as e:
                logger.warning(f"Error evaluating rule group {group.id}: {e}")
                continue

        return None

    @staticmethod
    def _check_condition(rule, context: Dict[str, Any]) -> bool:
        """Check if rule condition matches context."""
        return RuleEngine._check_single_condition(
            rule.condition_type,
            rule.condition_operator,
            rule.condition_value,
            rule.condition_key,
            context
        )

    @staticmethod
    def _check_single_condition(
        condition_type: str,
        operator: str,
        value: Any,
        condition_key: str,
        context: Dict[str, Any]
    ) -> bool:
        """Check a single condition against context."""

        # Get context value based on condition type
        ctx_value = RuleEngine._get_context_value(condition_type, condition_key, context)

        # Apply operator
        return RuleEngine._apply_operator(operator, ctx_value, value)

    @staticmethod
    def _get_context_value(
        condition_type: str,
        condition_key: str,
        context: Dict[str, Any]
    ) -> Any:
        """Extract value from context based on condition type."""

        if condition_type == "country":
            return (context.get("country_code") or "").upper()

        elif condition_type == "city":
            return (context.get("city") or "").lower()

        elif condition_type == "region":
            return (context.get("region") or "").lower()

        elif condition_type == "device":
            return (context.get("device_type") or "").lower()

        elif condition_type == "os":
            return (context.get("os") or "").lower()

        elif condition_type == "browser":
            return (context.get("browser") or "").lower()

        elif condition_type == "language":
            # Get first 2 characters of language (e.g., "en" from "en-US")
            lang = context.get("language") or ""
            return lang[:2].lower() if lang else ""

        elif condition_type == "referrer":
            referrer = context.get("referrer") or ""
            if referrer:
                try:
                    parsed = urlparse(referrer)
                    return parsed.netloc.lower()
                except Exception:
                    return referrer.lower()
            return ""

        elif condition_type == "time":
            # Return current hour (0-23)
            now = context.get("time") or timezone.now()
            return now.hour

        elif condition_type == "date":
            # Return date as ISO string
            now = context.get("time") or timezone.now()
            return now.date().isoformat()

        elif condition_type == "day_of_week":
            # Return weekday (0=Monday, 6=Sunday)
            now = context.get("time") or timezone.now()
            return now.weekday()

        elif condition_type == "scan_count":
            return context.get("scan_count", 0)

        elif condition_type == "is_first_scan":
            return context.get("is_first_scan", False)

        elif condition_type == "query_param":
            params = context.get("query_params", {})
            return params.get(condition_key, "")

        return None

    @staticmethod
    def _apply_operator(operator: str, ctx_value: Any, rule_value: Any) -> bool:
        """Apply comparison operator."""

        # Handle None values
        if ctx_value is None:
            return False

        # Normalize strings for comparison
        if isinstance(ctx_value, str):
            ctx_value = ctx_value.lower()
        if isinstance(rule_value, str):
            rule_value = rule_value.lower()

        try:
            if operator == "eq":
                return ctx_value == rule_value

            elif operator == "neq":
                return ctx_value != rule_value

            elif operator == "contains":
                return str(rule_value) in str(ctx_value)

            elif operator == "not_contains":
                return str(rule_value) not in str(ctx_value)

            elif operator == "starts_with":
                return str(ctx_value).startswith(str(rule_value))

            elif operator == "ends_with":
                return str(ctx_value).endswith(str(rule_value))

            elif operator == "gt":
                return float(ctx_value) > float(rule_value)

            elif operator == "gte":
                return float(ctx_value) >= float(rule_value)

            elif operator == "lt":
                return float(ctx_value) < float(rule_value)

            elif operator == "lte":
                return float(ctx_value) <= float(rule_value)

            elif operator == "between":
                # rule_value should be [min, max]
                if isinstance(rule_value, list) and len(rule_value) == 2:
                    return float(rule_value[0]) <= float(ctx_value) <= float(rule_value[1])
                return False

            elif operator == "in":
                # rule_value should be a list
                if isinstance(rule_value, list):
                    # Normalize list values for comparison
                    normalized = [str(v).lower() if isinstance(v, str) else v for v in rule_value]
                    return ctx_value in normalized
                return ctx_value == rule_value

            elif operator == "not_in":
                if isinstance(rule_value, list):
                    normalized = [str(v).lower() if isinstance(v, str) else v for v in rule_value]
                    return ctx_value not in normalized
                return ctx_value != rule_value

            elif operator == "regex":
                try:
                    pattern = re.compile(str(rule_value), re.IGNORECASE)
                    return bool(pattern.search(str(ctx_value)))
                except re.error:
                    return False

        except (ValueError, TypeError) as e:
            logger.debug(f"Operator comparison failed: {e}")
            return False

        return False

    @staticmethod
    def apply_action(action_type: str, action_value: Dict, original_url: str) -> Dict[str, Any]:
        """
        Apply action and return result.

        Args:
            action_type: Type of action (redirect, block, add_utm, etc.)
            action_value: Action configuration
            original_url: Original destination URL

        Returns:
            Dict with action result:
            {
                "type": "redirect" | "block" | "content",
                "url": "...",  # For redirect
                "message": "...",  # For block
                "content": {...},  # For content
            }
        """
        if action_type == "redirect":
            return {
                "type": "redirect",
                "url": action_value.get("url", original_url),
            }

        elif action_type == "block":
            return {
                "type": "block",
                "message": action_value.get("message", "Access denied"),
                "status_code": action_value.get("status_code", 403),
            }

        elif action_type == "add_utm":
            # Add UTM parameters to original URL
            url = RuleEngine._add_utm_params(original_url, action_value)
            return {
                "type": "redirect",
                "url": url,
            }

        elif action_type == "show_content":
            return {
                "type": "content",
                "template": action_value.get("template"),
                "data": action_value.get("data", {}),
            }

        elif action_type == "set_header":
            # This would need to be handled differently in the view
            return {
                "type": "redirect",
                "url": original_url,
                "headers": action_value.get("headers", {}),
            }

        # Default: redirect to original URL
        return {
            "type": "redirect",
            "url": original_url,
        }

    @staticmethod
    def _add_utm_params(url: str, utm_params: Dict[str, str]) -> str:
        """Add UTM parameters to URL."""
        try:
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)

            # Add UTM parameters
            for key, value in utm_params.items():
                if key.startswith("utm_") and value:
                    query_params[key] = [value]

            # Rebuild URL
            new_query = urlencode(query_params, doseq=True)
            return urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))
        except Exception as e:
            logger.warning(f"Failed to add UTM params: {e}")
            return url

    @staticmethod
    def build_context(request, link=None, qr_code=None) -> Dict[str, Any]:
        """
        Build evaluation context from HTTP request.

        Args:
            request: Django HttpRequest object
            link: Optional Link object
            qr_code: Optional QRCode object

        Returns:
            Context dict for rule evaluation
        """
        from apps.links.tasks import parse_user_agent, get_geo_from_ip

        # Get IP
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "")

        # Parse user agent
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        ua_data = parse_user_agent(user_agent)

        # Get geo data
        geo_data = get_geo_from_ip(ip)

        # Get scan count
        scan_count = 0
        is_first_scan = True

        if link:
            scan_count = link.total_clicks
            is_first_scan = scan_count == 0
        elif qr_code:
            scan_count = qr_code.total_scans
            is_first_scan = scan_count == 0

        # Get query parameters
        query_params = dict(request.GET)
        # Flatten single-value lists
        query_params = {k: v[0] if len(v) == 1 else v for k, v in query_params.items()}

        return {
            # Geographic
            "country_code": geo_data.get("country_code", ""),
            "country_name": geo_data.get("country_name", ""),
            "city": geo_data.get("city", ""),
            "region": geo_data.get("region", ""),
            # Device
            "device_type": ua_data.get("device_type", ""),
            "os": ua_data.get("os", ""),
            "browser": ua_data.get("browser", ""),
            # User context
            "language": request.META.get("HTTP_ACCEPT_LANGUAGE", ""),
            "referrer": request.META.get("HTTP_REFERER", ""),
            # Time
            "time": timezone.now(),
            # Scan/click context
            "scan_count": scan_count,
            "is_first_scan": is_first_scan,
            # Query params
            "query_params": query_params,
            # Raw request info (for advanced rules)
            "user_agent": user_agent,
            "ip": ip,
        }


def get_rules_for_link(link, active_only=True):
    """
    Get rules for a link, including campaign-level and serial-batch-level rules.

    Args:
        link: Link object
        active_only: If True, only return active rules

    Returns:
        QuerySet of Rule objects
    """
    from django.db.models import Q
    from .models import Rule

    # Match rules targeting this link directly, or its campaign
    filters = Q(link=link)

    if link.campaign_id:
        filters |= Q(campaign_id=link.campaign_id)

    # Check if the link has a QR code that belongs to a serial batch
    try:
        qr = link.qr_code
        if hasattr(qr, "serial") and qr.serial and qr.serial.batch_id:
            filters |= Q(serial_batch_id=qr.serial.batch_id)
    except Exception:
        pass

    qs = Rule.objects.filter(filters)

    if active_only:
        qs = qs.filter(is_active=True)

    return qs.order_by("-priority", "created_at")


def get_rules_for_qr_code(qr_code, active_only=True):
    """
    Get rules for a QR code, ordered by priority.

    Args:
        qr_code: QRCode object
        active_only: If True, only return active rules

    Returns:
        QuerySet of Rule objects
    """
    from .models import Rule

    qs = Rule.objects.filter(qr_code=qr_code)

    if active_only:
        qs = qs.filter(is_active=True)

    return qs.order_by("-priority", "created_at")
