from django.contrib import sitemaps
from django.urls import reverse


class StaticViewSitemap(sitemaps.Sitemap):
    priority = 0.8
    changefreq = "weekly"

    def items(self):
        return ["landing", "pricing", "features", "blog", "about", "use-cases"]

    def location(self, item):
        return reverse(item)


class BlogPostSitemap(sitemaps.Sitemap):
    priority = 0.7
    changefreq = "monthly"

    def items(self):
        return [
            "blog-utm-parameters-guide",
            "blog-qr-codes-for-business",
            "blog-link-analytics-metrics",
            "blog-click-through-rate-tips",
        ]

    def location(self, item):
        return reverse(item)
