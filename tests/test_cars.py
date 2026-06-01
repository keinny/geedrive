# tests/test_cars.py
#
# Full test coverage for the /cars router.
# Uses app.dependency_overrides[get_car_repo] to bypass Supabase entirely.

import pytest
from contextlib import contextmanager
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import date

from app.main import app
from app.auth import verify_api_key
from app.routers.cars import get_car_repo
from app.repositories.car_repo import CarRepository


# ── Shared fixtures ───────────────────────────────────────────────────────────

app.dependency_overrides[verify_api_key] = lambda: "test-key"
client = TestClient(app)
HEADERS = {"Authorization": "Bearer test-key"}


@contextmanager
def real_auth():
    """Temporarily restore real auth to test 401 responses."""
    saved = app.dependency_overrides.pop(verify_api_key, None)
    try:
        yield
    finally:
        if saved is not None:
            app.dependency_overrides[verify_api_key] = saved


def make_car_row(**overrides) -> dict:
    base = {
        "id": str(uuid4()),
        "plate_number": "ABC 1234",
        "make": "Toyota",
        "model": "Hiace",
        "vehicle_type": "Minibus",
        "passenger_capacity": 14,
        "initial_mileage": 0.0,
        "last_serviced": None,
        "registration_date": "2024-01-01",
        "status": "active",
        "created_at": "2024-01-01T00:00:00+00:00",
    }
    return {**base, **overrides}


def make_analytics_row(**overrides) -> dict:
    base = {
        "car_id": str(uuid4()),
        "plate_number": "ABC 1234",
        "make": "Toyota",
        "model": "Hiace",
        "vehicle_type": "Minibus",
        "status": "active",
        "last_serviced": None,
        "trip_count": 10,
        "total_mileage": 5000.0,
        "total_revenue": 25000.0,
        "total_spares": 500.0,
        "total_expenses": 1200.0,
        "net_profit": 23300.0,
        "current_mileage": 5000.0,
        "odometer": 5000.0,
        "health_score": 85.0,
        "needs_service": False,
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def reset_overrides():
    """Ensure per-test overrides are cleared after each test."""
    yield
    if get_car_repo in app.dependency_overrides:
        del app.dependency_overrides[get_car_repo]


def mock_repo(**method_returns) -> MagicMock:
    repo = MagicMock(spec=CarRepository)
    for method, value in method_returns.items():
        getattr(repo, method).return_value = value
    return repo


def inject(repo: MagicMock):
    app.dependency_overrides[get_car_repo] = lambda: repo


# ── POST /cars — Register ─────────────────────────────────────────────────────

class TestRegisterCar:
    def test_success_returns_201(self):
        row = make_car_row()
        inject(mock_repo(get_by_plate=None, create=row))

        res = client.post("/cars", json={
            "plate_number": "abc 1234",
            "make": "Toyota",
            "model": "Hiace",
            "vehicle_type": "Minibus",
            "passenger_capacity": 14,
            "registration_date": "2024-01-01",
        }, headers=HEADERS)

        assert res.status_code == 201
        assert res.json()["plate_number"] == "ABC 1234"

    def test_plate_normalised_to_uppercase_before_duplicate_check(self):
        inject(mock_repo(get_by_plate=None, create=make_car_row(plate_number="XYZ 9999")))

        client.post("/cars", json={
            "plate_number": "xyz 9999",
            "make": "Toyota",
            "model": "Minibus",
            "vehicle_type": "Minibus",
            "passenger_capacity": 18,
            "registration_date": "2024-06-01",
        }, headers=HEADERS)

        repo = app.dependency_overrides[get_car_repo]()
        repo.get_by_plate.assert_called_once_with("XYZ 9999")

    def test_duplicate_plate_returns_409(self):
        inject(mock_repo(get_by_plate=make_car_row()))

        res = client.post("/cars", json={
            "plate_number": "ABC 1234",
            "make": "Toyota",
            "model": "Toyota Hiace",
            "vehicle_type": "Minibus",
            "passenger_capacity": 14,
            "registration_date": "2024-01-01",
        }, headers=HEADERS)

        assert res.status_code == 409

    def test_zero_capacity_rejected_422(self):
        res = client.post("/cars", json={
            "plate_number": "NEW 0001",
            "model": "Ghost Bus",
            "passenger_capacity": 0,
            "registration_date": "2024-01-01",
        }, headers=HEADERS)
        assert res.status_code == 422

    def test_negative_capacity_rejected_422(self):
        res = client.post("/cars", json={
            "plate_number": "NEW 0002",
            "model": "Anti Bus",
            "passenger_capacity": -5,
            "registration_date": "2024-01-01",
        }, headers=HEADERS)
        assert res.status_code == 422

    def test_missing_required_fields_rejected_422(self):
        res = client.post("/cars", json={"plate_number": "XYZ 0000"}, headers=HEADERS)
        assert res.status_code == 422

    def test_unauthenticated_request_rejected_401(self):
        with real_auth():
            res = client.post("/cars", json={
                "plate_number": "ABC 1234",
                "model": "Toyota Hiace",
                "passenger_capacity": 14,
                "registration_date": "2024-01-01",
            })
        assert res.status_code == 401


# ── GET /cars — List ──────────────────────────────────────────────────────────

class TestListCars:
    def test_returns_list_of_cars(self):
        rows = [make_car_row(plate_number="A 0001"), make_car_row(plate_number="B 0002")]
        inject(mock_repo(list_all=rows))

        res = client.get("/cars", headers=HEADERS)
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_empty_fleet_returns_empty_list(self):
        inject(mock_repo(list_all=[]))
        res = client.get("/cars", headers=HEADERS)
        assert res.json() == []

    def test_unauthenticated_returns_401(self):
        with real_auth():
            res = client.get("/cars")
        assert res.status_code == 401


# ── GET /cars/{plate}/last-mileage ────────────────────────────────────────────

class TestGetLastMileage:
    def test_returns_initial_mileage_when_no_logs(self):
        inject(mock_repo(get_last_mileage=0.0))
        res = client.get("/cars/ABC%201234/last-mileage", headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["last_mileage"] == 0.0

    def test_returns_latest_closing_mileage(self):
        inject(mock_repo(get_last_mileage=1450.0))
        res = client.get("/cars/ABC%201234/last-mileage", headers=HEADERS)
        assert res.json()["last_mileage"] == 1450.0

    def test_unknown_plate_returns_404(self):
        inject(mock_repo(get_last_mileage=None))
        res = client.get("/cars/GHOST%209999/last-mileage", headers=HEADERS)
        assert res.status_code == 404


# ── GET /cars/analytics ───────────────────────────────────────────────────────

class TestCarAnalytics:
    def test_returns_all_analytics(self):
        rows = [make_analytics_row(), make_analytics_row(plate_number="DEF 5678")]
        inject(mock_repo(get_analytics=rows))

        res = client.get("/cars/analytics", headers=HEADERS)
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_filter_by_plate_url_decoded(self):
        """FastAPI decodes %20 → space before passing to the dependency."""
        repo = mock_repo(get_analytics=[make_analytics_row()])
        inject(repo)

        res = client.get("/cars/analytics?plate=ABC%201234", headers=HEADERS)
        assert res.status_code == 200
        # URL-decoded value is passed to the repo, not the raw %20 form.
        repo = app.dependency_overrides[get_car_repo]()
        repo.get_analytics.assert_called_once_with("ABC 1234")

    def test_empty_result_returns_empty_list(self):
        inject(mock_repo(get_analytics=[]))
        res = client.get("/cars/analytics", headers=HEADERS)
        assert res.json() == []


# ── PATCH /cars/{id} — Update ─────────────────────────────────────────────────

class TestUpdateCar:
    def test_update_model_succeeds(self):
        car_id = uuid4()
        updated = make_car_row(id=str(car_id), model="Toyota Coaster")
        inject(mock_repo(get_by_id={"status": "active"}, update=updated))

        res = client.patch(f"/cars/{car_id}", json={"model": "Toyota Coaster"}, headers=HEADERS)

        assert res.status_code == 200
        assert res.json()["model"] == "Toyota Coaster"

    def test_update_last_serviced_succeeds(self):
        car_id = uuid4()
        updated = make_car_row(id=str(car_id), last_serviced="2025-03-15")
        inject(mock_repo(get_by_id={"status": "active"}, update=updated))

        res = client.patch(f"/cars/{car_id}", json={"last_serviced": "2025-03-15"}, headers=HEADERS)

        assert res.status_code == 200
        assert res.json()["last_serviced"] == "2025-03-15"

    def test_update_passenger_capacity_succeeds(self):
        car_id = uuid4()
        updated = make_car_row(id=str(car_id), passenger_capacity=18)
        inject(mock_repo(get_by_id={"status": "active"}, update=updated))

        res = client.patch(f"/cars/{car_id}", json={"passenger_capacity": 18}, headers=HEADERS)
        assert res.status_code == 200

    def test_update_only_sends_provided_fields(self):
        """Repo.update receives a CarUpdate with only the supplied field set."""
        car_id = uuid4()
        updated = make_car_row(id=str(car_id), model="New Model")
        repo = mock_repo(get_by_id={"status": "active"}, update=updated)
        inject(repo)

        client.patch(f"/cars/{car_id}", json={"model": "New Model"}, headers=HEADERS)

        patch_obj = repo.update.call_args[0][1]
        dumped = patch_obj.model_dump(exclude_none=True)
        assert "model" in dumped
        assert "passenger_capacity" not in dumped
        assert "last_serviced" not in dumped

    def test_car_not_found_returns_404(self):
        inject(mock_repo(get_by_id=None))
        res = client.patch(f"/cars/{uuid4()}", json={"model": "X"}, headers=HEADERS)
        assert res.status_code == 404

    def test_decommissioned_car_returns_409(self):
        inject(mock_repo(get_by_id={"status": "decommissioned"}))
        res = client.patch(f"/cars/{uuid4()}", json={"model": "X"}, headers=HEADERS)
        assert res.status_code == 409

    def test_empty_body_returns_400(self):
        inject(mock_repo(get_by_id={"status": "active"}))
        res = client.patch(f"/cars/{uuid4()}", json={}, headers=HEADERS)
        assert res.status_code == 400

    def test_zero_capacity_in_update_rejected_422(self):
        res = client.patch(f"/cars/{uuid4()}", json={"passenger_capacity": 0}, headers=HEADERS)
        assert res.status_code == 422

    def test_unauthenticated_returns_401(self):
        with real_auth():
            res = client.patch(f"/cars/{uuid4()}", json={"model": "X"})
        assert res.status_code == 401


# ── PATCH /cars/{id}/decommission ─────────────────────────────────────────────

class TestDecommissionCar:
    PAYLOAD = {
        "decommission_date": "2025-01-01",
        "reason": "End of life",
        "final_mileage": 250000.0,
        "total_revenue_at_decommission": 85000.00,
    }

    def test_active_car_decommissioned_successfully(self):
        inject(mock_repo(get_by_id={"status": "active"}, decommission={}))
        res = client.patch(f"/cars/{uuid4()}/decommission", json=self.PAYLOAD, headers=HEADERS)
        assert res.status_code == 200

    def test_already_decommissioned_returns_409(self):
        inject(mock_repo(get_by_id={"status": "decommissioned"}))
        res = client.patch(f"/cars/{uuid4()}/decommission", json=self.PAYLOAD, headers=HEADERS)
        assert res.status_code == 409

    def test_not_found_returns_404(self):
        inject(mock_repo(get_by_id=None))
        res = client.patch(f"/cars/{uuid4()}/decommission", json=self.PAYLOAD, headers=HEADERS)
        assert res.status_code == 404

    def test_short_reason_rejected_422(self):
        res = client.patch(f"/cars/{uuid4()}/decommission",
                           json={**self.PAYLOAD, "reason": "No"}, headers=HEADERS)
        assert res.status_code == 422

    def test_negative_final_mileage_rejected_422(self):
        res = client.patch(f"/cars/{uuid4()}/decommission",
                           json={**self.PAYLOAD, "final_mileage": -1.0}, headers=HEADERS)
        assert res.status_code == 422
