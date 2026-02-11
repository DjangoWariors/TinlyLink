from django.urls import path
from django.views.generic import TemplateView
from .views import (
    LandingView, PricingView, FeaturesView, BlogView,
    AboutView, UseCasesView, TermsView, PrivacyView,
    ContactView, BlogPostView, RedirectToFrontendView,
    VerifyAPIView, VerifyPageView,
)

urlpatterns = [
    path("", LandingView.as_view(), name="landing"),
    path("pricing", PricingView.as_view(), name="pricing"),
    path("features", FeaturesView.as_view(), name="features"),
    path("blog", BlogView.as_view(), name="blog"),
    path("about", AboutView.as_view(), name="about"),
    path("use-cases", UseCasesView.as_view(), name="use-cases"),
    path("terms", TermsView.as_view(), name="terms"),
    path("privacy", PrivacyView.as_view(), name="privacy"),
    path("contact", ContactView.as_view(), name="contact"),

    # Blog posts
    path("blog/utm-parameters-guide", BlogPostView.as_view(
        template_name="public/blog/utm-parameters-guide.html",
        page_title="The Complete Guide to UTM Parameters - TinlyLink Blog",
        page_description="Learn how to effectively use UTM parameters to track your marketing campaigns and make data-driven decisions.",
        extra_context={
            "article_author": "Sarah Johnson",
            "article_date": "January 10, 2025",
            "article_read_time": "10 min read",
            "article_category": "Marketing",
        },
    ), name="blog-utm-parameters-guide"),
    path("blog/qr-codes-for-business", BlogPostView.as_view(
        template_name="public/blog/qr-codes-for-business.html",
        page_title="QR Codes for Small Business: A Practical Guide - TinlyLink Blog",
        page_description="Discover how small businesses can leverage QR codes to drive foot traffic, streamline payments, and boost customer engagement.",
        extra_context={
            "article_author": "Emily Davis",
            "article_date": "January 5, 2025",
            "article_read_time": "9 min read",
            "article_category": "QR Codes",
        },
    ), name="blog-qr-codes-for-business"),
    path("blog/link-analytics-metrics", BlogPostView.as_view(
        template_name="public/blog/link-analytics-metrics.html",
        page_title="Understanding Link Analytics: Metrics That Matter - TinlyLink Blog",
        page_description="A deep dive into the link analytics metrics you should be tracking to measure campaign performance and optimize your strategy.",
        extra_context={
            "article_author": "Sarah Johnson",
            "article_date": "January 2, 2025",
            "article_read_time": "8 min read",
            "article_category": "Analytics",
        },
    ), name="blog-link-analytics-metrics"),
    path("blog/click-through-rate-tips", BlogPostView.as_view(
        template_name="public/blog/click-through-rate-tips.html",
        page_title="10 Ways to Increase Click-Through Rates - TinlyLink Blog",
        page_description="Discover proven strategies to boost engagement and get more clicks on your shortened URLs and marketing links.",
        extra_context={
            "article_author": "Mike Chen",
            "article_date": "January 8, 2025",
            "article_read_time": "7 min read",
            "article_category": "Tips & Tricks",
        },
    ), name="blog-click-through-rate-tips"),

    # App Routes (Redirect to React)
    path("login", RedirectToFrontendView.as_view(), name="login"),
    path("register", RedirectToFrontendView.as_view(), name="register"),
    path("dashboard", RedirectToFrontendView.as_view(), name="dashboard"),
    path("forgot-password", RedirectToFrontendView.as_view(), name="forgot-password"),

    # Product Verification
    path("verify/<str:serial>", VerifyPageView.as_view(), name="verify_page"),
    path("verify/", VerifyPageView.as_view(), name="verify_page_empty"),
    path("api/verify/", VerifyAPIView.as_view(), name="verify_api"),

    # SEO
    path("robots.txt", TemplateView.as_view(template_name="public/robots.txt", content_type="text/plain")),
]
