from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="change-me-in-production")


DATABASES = {
    "default": dj_database_url.config(
        default=config(
            "DATABASE_URL",
            default="postgres://postgres:12345@localhost:5433/tinlylink2",  # Configure in .env
        ),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://127.0.0.1:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": {"max_connections": 50},
            "SOCKET_CONNECT_TIMEOUT": 15,
            "SOCKET_TIMEOUT": 15,
        },
        "KEY_PREFIX": "tinlylink",
    }
}


DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sitemaps",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    "django_celery_results",
    "storages",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.users",
    "apps.links",
    "apps.qrcodes",
    "apps.analytics",
    "apps.billing",
    "apps.campaigns",
    "apps.public",
    "apps.teams",
    "apps.rules",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.users.middleware.RateLimitMiddleware",
    "apps.users.middleware.SessionTrackingMiddleware",
    "apps.teams.middleware.TeamContextMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 days
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"


AUTH_USER_MODEL = "users.User"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.users.authentication.JWTAuthentication",
        "apps.users.authentication.APIKeyAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
    "EXCEPTION_HANDLER": "apps.users.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "type",
    "JTI_CLAIM": "jti",
}


CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-requested-with",
    "x-api-key",
]


FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")


CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "default"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True

CELERY_TASK_QUEUES = {
    "default": {"exchange": "default", "routing_key": "default"},
    "priority": {"exchange": "priority", "routing_key": "priority"},
    "analytics": {"exchange": "analytics", "routing_key": "analytics"},
    "bulk": {"exchange": "bulk", "routing_key": "bulk"},
}

CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_ROUTES = {
    "apps.analytics.tasks.*": {"queue": "analytics"},
    "apps.users.tasks.send_*": {"queue": "priority"},
    "apps.links.tasks.bulk_*": {"queue": "bulk"},
}


GOOGLE_OAUTH_CLIENT_ID = config("GOOGLE_OAUTH_CLIENT_ID", default="")


STRIPE_PUBLISHABLE_KEY = config("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_SECRET_KEY = config("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = config("STRIPE_WEBHOOK_SECRET", default="")

STRIPE_PRODUCTS = {
    "pro": {
        "price_id": config("STRIPE_PRO_PRICE_ID", default="price_1Sw3dMD44dfQ294CXECDW3i3"),
        "amount": 1200,
    },
    "business": {
        "price_id": config("STRIPE_BUSINESS_PRICE_ID", default="price_1Sw3e2D44dfQ294C7HMojDpO"),
        "amount": 4900,
    },
    "enterprise": {
        "price_id": config("STRIPE_ENTERPRISE_PRICE_ID", default="price_enterprise_placeholder"),
        "amount": 9900,
    },
}


SENDGRID_API_KEY = config("SENDGRID_API_KEY", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@tinlylink.com")

GEOIP_PATH = config("GEOIP_PATH", default="/var/lib/geoip")



DEFAULT_SHORT_DOMAIN = config("DEFAULT_SHORT_DOMAIN", default="tinlylink.com")


PLAN_LIMITS = {
    "free": {
        "links_per_month": 50,
        "qr_codes_per_month": 10,
        "api_calls_per_month": 0,
        "custom_domains": 0,
        "analytics_retention_days": 30,
        "custom_slugs": False,
        "password_protection": False,
        "show_ads": True,
        "team_members": 0,
    },
    "pro": {
        "links_per_month": 500,
        "qr_codes_per_month": 100,
        "api_calls_per_month": 1000,
        "custom_domains": 1,
        "analytics_retention_days": 365,
        "custom_slugs": True,
        "password_protection": True,
        "show_ads": False,
        "team_members": 0,
    },
    "business": {
        "links_per_month": 5000,
        "qr_codes_per_month": 500,
        "api_calls_per_month": 50000,
        "custom_domains": 10,
        "analytics_retention_days": 730,
        "custom_slugs": True,
        "password_protection": True,
        "show_ads": False,
        "team_members": 15,
        "serial_batch_limit": 10000,
    },
    "enterprise": {
        "links_per_month": -1,  # Unlimited
        "qr_codes_per_month": -1,  # Unlimited
        "api_calls_per_month": -1,  # Unlimited
        "custom_domains": 50,
        "analytics_retention_days": 3650,  # 10 years
        "custom_slugs": True,
        "password_protection": True,
        "show_ads": False,
        "team_members": 100,
        "priority_support": True,
        "sso": True,
        "dedicated_account_manager": True,
        "custom_integrations": True,
        "serial_batch_limit": 100000,
    },
}


RATE_LIMITS = {
    "anon_shorten": "5/hour",
    "anon_redirect": "100/minute",
    "free_shorten": "10/hour",
    "free_api": "60/minute",
    "pro_shorten": "100/hour",
    "pro_api": "120/minute",
    "business_shorten": "500/hour",
    "business_api": "1000/minute",
    "enterprise_shorten": "unlimited",
    "enterprise_api": "unlimited",
    "login": "5/15minutes",
    "password_reset": "3/hour",
}


BLOCKED_URL_PATTERNS = [
    r"^(file|javascript|data|vbscript):",
    r"localhost",
    r"127\.\d+\.\d+\.\d+",
    r"10\.\d+\.\d+\.\d+",
    r"172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+",
    r"192\.168\.\d+\.\d+",
    r"\.onion$",
    r"\.local$",
]

RESERVED_SLUGS = [
    "api", "admin", "app", "auth", "billing", "docs", "help",
    "login", "logout", "register", "settings", "static", "webhook",
    "dashboard", "links", "qr", "analytics", "campaigns", "account",
]


ADSENSE_CLIENT_ID = config("ADSENSE_CLIENT_ID", default="")
ADSENSE_SLOT_ID = config("ADSENSE_SLOT_ID", default="")
INTERSTITIAL_DURATION = 5


SPECTACULAR_SETTINGS = {
    "TITLE": "TinlyLink API",
    "DESCRIPTION": "URL Shortener & QR Code Generator API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1/",
}
