"""
URL patterns for Rules Engine API.
"""

from django.urls import path

from .views import (
    RuleListCreateView,
    RuleDetailView,
    RuleToggleView,
    RuleReorderView,
    LinkRulesView,
    QRCodeRulesView,
    RuleGroupListCreateView,
    RuleGroupDetailView,
    TestRulesView,
    RuleStatsView,
)

app_name = "rules"

urlpatterns = [
    # Rules CRUD
    path("", RuleListCreateView.as_view(), name="list-create"),
    path("<uuid:pk>/", RuleDetailView.as_view(), name="detail"),
    path("<uuid:pk>/toggle/", RuleToggleView.as_view(), name="toggle"),
    path("reorder/", RuleReorderView.as_view(), name="reorder"),

    # Rules by resource
    path("link/<uuid:link_id>/", LinkRulesView.as_view(), name="link-rules"),
    path("qr-code/<uuid:qr_code_id>/", QRCodeRulesView.as_view(), name="qr-code-rules"),

    # Rule Groups
    path("groups/", RuleGroupListCreateView.as_view(), name="groups-list-create"),
    path("groups/<uuid:pk>/", RuleGroupDetailView.as_view(), name="groups-detail"),

    # Testing and stats
    path("test/", TestRulesView.as_view(), name="test"),
    path("stats/", RuleStatsView.as_view(), name="stats"),
]
