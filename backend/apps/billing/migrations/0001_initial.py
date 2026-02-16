"""
Initial migration for billing app.
Creates the Plan model and seeds the 4 default plans.
"""

from django.db import migrations, models


def seed_plans(apps, schema_editor):
    """Seed the 4 default plans from existing settings."""
    Plan = apps.get_model("billing", "Plan")

    plans = [
        {
            "slug": "free",
            "name": "Free",
            "description": "Perfect for getting started",
            "is_enabled": True,
            "is_coming_soon": False,
            "sort_order": 0,
            "is_popular": False,
            "cta_text": "Get Started",
            "features_json": [
                "50 links per month",
                "10 QR codes per month",
                "30-day analytics",
                "Basic link tracking",
            ],
            "monthly_price": 0,
            "yearly_price": 0,
            "stripe_monthly_price_id": "",
            "stripe_yearly_price_id": "",
            "links_per_month": 50,
            "qr_codes_per_month": 10,
            "api_calls_per_month": 0,
            "custom_domains": 0,
            "analytics_retention_days": 30,
            "team_members": 0,
            "serial_batch_limit": 0,
            "custom_slugs": False,
            "password_protection": False,
            "show_ads": True,
            "priority_support": False,
            "sso": False,
        },
        {
            "slug": "pro",
            "name": "Pro",
            "description": "Best for professionals",
            "is_enabled": True,
            "is_coming_soon": False,
            "sort_order": 1,
            "is_popular": True,
            "cta_text": "Start Free Trial",
            "features_json": [
                "500 links per month",
                "100 QR codes per month",
                "1-year analytics retention",
                "Custom slugs",
                "Password protection",
                "1 custom domain",
                "1,000 API calls per month",
            ],
            "monthly_price": 1200,
            "yearly_price": 9900,
            "stripe_monthly_price_id": "price_1Sw3dMD44dfQ294CXECDW3i3",
            "stripe_yearly_price_id": "",
            "links_per_month": 500,
            "qr_codes_per_month": 100,
            "api_calls_per_month": 1000,
            "custom_domains": 1,
            "analytics_retention_days": 365,
            "team_members": 0,
            "serial_batch_limit": 0,
            "custom_slugs": True,
            "password_protection": True,
            "show_ads": False,
            "priority_support": False,
            "sso": False,
        },
        {
            "slug": "business",
            "name": "Business",
            "description": "For growing teams",
            "is_enabled": True,
            "is_coming_soon": False,
            "sort_order": 2,
            "is_popular": False,
            "cta_text": "Start Free Trial",
            "features_json": [
                "5,000 links per month",
                "500 QR codes per month",
                "2-year analytics retention",
                "Custom slugs",
                "Password protection",
                "10 custom domains",
                "50,000 API calls per month",
                "Up to 15 team members",
                "Priority support",
            ],
            "monthly_price": 4900,
            "yearly_price": 39900,
            "stripe_monthly_price_id": "price_1Sw3e2D44dfQ294C7HMojDpO",
            "stripe_yearly_price_id": "",
            "links_per_month": 5000,
            "qr_codes_per_month": 500,
            "api_calls_per_month": 50000,
            "custom_domains": 10,
            "analytics_retention_days": 730,
            "team_members": 15,
            "serial_batch_limit": 10000,
            "custom_slugs": True,
            "password_protection": True,
            "show_ads": False,
            "priority_support": True,
            "sso": False,
        },
        {
            "slug": "enterprise",
            "name": "Enterprise",
            "description": "For large organizations",
            "is_enabled": True,
            "is_coming_soon": False,
            "sort_order": 3,
            "is_popular": False,
            "cta_text": "Contact Sales",
            "features_json": [
                "Unlimited links",
                "Unlimited QR codes",
                "10-year analytics retention",
                "Custom slugs",
                "Password protection",
                "50 custom domains",
                "Unlimited API calls",
                "Up to 100 team members",
                "Priority support",
                "SSO & SAML",
                "Dedicated account manager",
            ],
            "monthly_price": 9900,
            "yearly_price": 89900,
            "stripe_monthly_price_id": "price_enterprise_placeholder",
            "stripe_yearly_price_id": "",
            "links_per_month": -1,
            "qr_codes_per_month": -1,
            "api_calls_per_month": -1,
            "custom_domains": 50,
            "analytics_retention_days": 3650,
            "team_members": 100,
            "serial_batch_limit": 100000,
            "custom_slugs": True,
            "password_protection": True,
            "show_ads": False,
            "priority_support": True,
            "sso": True,
        },
    ]

    for plan_data in plans:
        Plan.objects.create(**plan_data)


def reverse_seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    Plan.objects.all().delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Plan",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "slug",
                    models.SlugField(max_length=30, unique=True),
                ),
                ("name", models.CharField(max_length=50)),
                ("description", models.CharField(blank=True, max_length=200)),
                ("is_enabled", models.BooleanField(default=True)),
                ("is_coming_soon", models.BooleanField(default=False)),
                ("sort_order", models.IntegerField(default=0)),
                ("is_popular", models.BooleanField(default=False)),
                ("badge_text", models.CharField(blank=True, max_length=30)),
                ("cta_text", models.CharField(default="Get Started", max_length=50)),
                ("features_json", models.JSONField(default=list)),
                ("monthly_price", models.IntegerField(default=0)),
                ("yearly_price", models.IntegerField(default=0)),
                (
                    "stripe_monthly_price_id",
                    models.CharField(blank=True, max_length=100),
                ),
                (
                    "stripe_yearly_price_id",
                    models.CharField(blank=True, max_length=100),
                ),
                ("links_per_month", models.IntegerField(default=50)),
                ("qr_codes_per_month", models.IntegerField(default=10)),
                ("api_calls_per_month", models.IntegerField(default=0)),
                ("custom_domains", models.IntegerField(default=0)),
                ("analytics_retention_days", models.IntegerField(default=30)),
                ("team_members", models.IntegerField(default=0)),
                ("serial_batch_limit", models.IntegerField(default=0)),
                ("custom_slugs", models.BooleanField(default=False)),
                ("password_protection", models.BooleanField(default=False)),
                ("show_ads", models.BooleanField(default=True)),
                ("priority_support", models.BooleanField(default=False)),
                ("sso", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "monthly_price"],
            },
        ),
        migrations.RunPython(seed_plans, reverse_seed),
    ]
