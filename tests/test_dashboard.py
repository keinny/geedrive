# tests/test_dashboard.py
#
# Tests for the /dashboard and /health endpoints.

from contextlib import contextmanager
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import pytest

from api.main import app, get_dashboard_summary
from api.auth import verify_api_key
from api import cache as app_cache
from api.database import get_supabase
from api.repositories.analytics_repo import AnalyticsRepository


app.dependency_overrides[verify_api_key] = lambda: "test-key"
client = TestClient(app)
HEADERS = {"Authorization": "Bearer test-key"}


@pytest.fixture(autouse=True)
def reset_cache():
    app_cache.clear()
    yield
    app_cache.clear()


@contextmanager
def real_auth():
    saved = app.dependency_overrides.pop(verify_api_key, None)
    try:
        yield
    finally:
        if saved is not None:
            app.dependency_overrides[verify_api_key] = saved


DASHBOARD_DATA = {
    "total_active_cars": 12,
    "total_active_drivers": 18,
    "cars_needing_service": 2,
    "expired_licenses": 1,
    "total_revenue_ytd": 450000.0,
    "total_net_profit_ytd": 380000.0,
}


class TestDashboard:
    def test_returns_dashboard_data(self):
        mock_repo = MagicMock(spec=AnalyticsRepository)
        mock_repo.get_dashboard.return_value = DASHBOARD_DATA

        mock_db = MagicMock()
        app.dependency_overrides[get_supabase] = lambda: mock_db

        with patch("api.main.AnalyticsRepository", return_value=mock_repo):
            res = client.get("/dashboard", headers=HEADERS)

        del app.dependency_overrides[get_supabase]
        assert res.status_code == 200

    def test_empty_db_returns_empty_dict(self):
        mock_repo = MagicMock(spec=AnalyticsRepository)
        mock_repo.get_dashboard.return_value = {}

        mock_db = MagicMock()
        app.dependency_overrides[get_supabase] = lambda: mock_db

        with patch("api.main.AnalyticsRepository", return_value=mock_repo):
            res = client.get("/dashboard", headers=HEADERS)

        del app.dependency_overrides[get_supabase]
        assert res.status_code == 200
        assert res.json() == {}

    def test_unauthenticated_returns_401(self):
        with real_auth():
            res = client.get("/dashboard")
        assert res.status_code == 401


class TestHealthEndpoint:
    def test_health_returns_200_without_auth(self):
        """Health endpoint must be reachable without a token."""
        res = client.get("/health")
        assert res.status_code == 200

    def test_health_response_shape(self):
        res = client.get("/health")
        body = res.json()
        assert "status" in body
        assert body["status"] == "ok"
