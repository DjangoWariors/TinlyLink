"""
Factory definitions for test data generation.
"""

import factory
from factory import fuzzy
from faker import Faker
from django.utils import timezone
from datetime import timedelta

fake = Faker()


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for User model."""
    
    class Meta:
        model = "users.User"
        django_get_or_create = ("email",)
    
    email = factory.LazyAttribute(lambda _: fake.unique.email())
    full_name = factory.LazyAttribute(lambda _: fake.name())
    password = factory.PostGenerationMethodCall("set_password", "TestPassword123!")
    is_email_verified = True
    is_active = True


class SubscriptionFactory(factory.django.DjangoModelFactory):
    """Factory for Subscription model."""
    
    class Meta:
        model = "users.Subscription"
    
    user = factory.SubFactory(UserFactory)
    plan = "free"
    status = "active"
    current_period_start = factory.LazyFunction(timezone.now)
    current_period_end = factory.LazyAttribute(
        lambda o: o.current_period_start + timedelta(days=30)
    )


class LinkFactory(factory.django.DjangoModelFactory):
    """Factory for Link model."""
    
    class Meta:
        model = "links.Link"
    
    user = factory.SubFactory(UserFactory)
    original_url = factory.LazyAttribute(lambda _: fake.url())
    title = factory.LazyAttribute(lambda _: fake.sentence(nb_words=4))
    is_active = True


class CustomDomainFactory(factory.django.DjangoModelFactory):
    """Factory for CustomDomain model."""
    
    class Meta:
        model = "links.CustomDomain"
    
    user = factory.SubFactory(UserFactory)
    domain = factory.LazyAttribute(lambda _: f"short.{fake.domain_name()}")
    is_verified = False
    ssl_enabled = False


class CampaignFactory(factory.django.DjangoModelFactory):
    """Factory for Campaign model."""
    
    class Meta:
        model = "campaigns.Campaign"
    
    user = factory.SubFactory(UserFactory)
    name = factory.LazyAttribute(lambda _: fake.catch_phrase())
    description = factory.LazyAttribute(lambda _: fake.paragraph())
    utm_source = factory.LazyAttribute(lambda _: fake.word())
    utm_medium = fuzzy.FuzzyChoice(["email", "social", "cpc", "affiliate"])
    utm_campaign = factory.LazyAttribute(lambda _: fake.slug())


class QRCodeFactory(factory.django.DjangoModelFactory):
    """Factory for QRCode model."""
    
    class Meta:
        model = "qrcodes.QRCode"
    
    user = factory.SubFactory(UserFactory)
    link = factory.SubFactory(LinkFactory)
    foreground_color = "#000000"
    background_color = "#FFFFFF"
    size = 256


class ClickEventFactory(factory.django.DjangoModelFactory):
    """Factory for ClickEvent model."""
    
    class Meta:
        model = "analytics.ClickEvent"
    
    link = factory.SubFactory(LinkFactory)
    ip_address = factory.LazyAttribute(lambda _: fake.ipv4_public())
    user_agent = factory.LazyAttribute(lambda _: fake.user_agent())
    referer = factory.LazyAttribute(lambda _: fake.url())
    country_code = fuzzy.FuzzyChoice(["US", "GB", "DE", "FR", "CA", "AU", "JP"])
    city = factory.LazyAttribute(lambda _: fake.city())
    device_type = fuzzy.FuzzyChoice(["desktop", "mobile", "tablet"])
    browser = fuzzy.FuzzyChoice(["Chrome", "Firefox", "Safari", "Edge"])
    os = fuzzy.FuzzyChoice(["Windows", "macOS", "Linux", "iOS", "Android"])
    is_unique = True
    created_at = factory.LazyFunction(timezone.now)


class APIKeyFactory(factory.django.DjangoModelFactory):
    """Factory for APIKey model."""
    
    class Meta:
        model = "users.APIKey"
    
    user = factory.SubFactory(UserFactory)
    name = factory.LazyAttribute(lambda _: f"API Key - {fake.word()}")
    scopes = ["links:read", "links:write"]
    is_active = True


class UsageTrackingFactory(factory.django.DjangoModelFactory):
    """Factory for UsageTracking model."""
    
    class Meta:
        model = "users.UsageTracking"
    
    user = factory.SubFactory(UserFactory)
    period_start = factory.LazyFunction(lambda: timezone.now().replace(day=1))
    period_end = factory.LazyAttribute(
        lambda o: (o.period_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    )
    links_created = 0
    qr_codes_created = 0
    api_calls_made = 0
