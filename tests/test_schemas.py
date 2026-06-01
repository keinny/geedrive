# tests/test_schemas.py
#
# Pure Pydantic unit tests — no HTTP layer, no mocks, no DB.
# These run in ~milliseconds and verify the schema layer in isolation.

import pytest
from datetime import date, timedelta
from uuid import uuid4

from api.schemas.cars import CarCreate, CarUpdate
from api.schemas.drivers import DriverCreate, DriverUpdate
from api.schemas.logs import WeeklyLogCreate

FUTURE = (date.today() + timedelta(days=365)).isoformat()
PAST   = (date.today() - timedelta(days=1)).isoformat()
TODAY  = date.today().isoformat()


# ── CarCreate ─────────────────────────────────────────────────────────────────

class TestCarCreate:
    def valid(self, **overrides):
        base = {
            "plate_number": "abc 1234",
            "make": "Toyota",
            "model": "Hiace",
            "vehicle_type": "Minibus",
            "passenger_capacity": 14,
            "registration_date": "2024-01-01",
        }
        return {**base, **overrides}

    def test_plate_normalised_to_uppercase(self):
        c = CarCreate(**self.valid(plate_number="xyz 9999"))
        assert c.plate_number == "XYZ 9999"

    def test_plate_strips_whitespace(self):
        c = CarCreate(**self.valid(plate_number="  abc 1234  "))
        assert c.plate_number == "ABC 1234"

    def test_zero_capacity_rejected(self):
        with pytest.raises(Exception):
            CarCreate(**self.valid(passenger_capacity=0))

    def test_negative_capacity_rejected(self):
        with pytest.raises(Exception):
            CarCreate(**self.valid(passenger_capacity=-1))

    def test_negative_initial_mileage_rejected(self):
        with pytest.raises(Exception):
            CarCreate(**self.valid(initial_mileage=-1.0))

    def test_default_initial_mileage_is_zero(self):
        c = CarCreate(**self.valid())
        assert c.initial_mileage == 0.0

    def test_optional_last_serviced_defaults_none(self):
        c = CarCreate(**self.valid())
        assert c.last_serviced is None
        
    def test_invalid_vehicle_type_rejected(self):
        with pytest.raises(Exception):
            CarCreate(**self.valid(vehicle_type="Rocket Ship"))

    def test_all_valid_vehicle_types_accepted(self):
        for vtype in ("Sedan", "Hatchback", "SUV", "Truck", "Coupe", "Minivan", "Station Wagon", "Minibus"):
            c = CarCreate(**self.valid(vehicle_type=vtype))
            assert c.vehicle_type.value == vtype


# ── CarUpdate ─────────────────────────────────────────────────────────────────

class TestCarUpdate:
    def test_empty_update_is_valid(self):
        u = CarUpdate()
        assert u.model_dump(exclude_none=True) == {}

    def test_partial_update_only_has_provided_fields(self):
        u = CarUpdate(model="Coaster")
        d = u.model_dump(exclude_none=True)
        assert d == {"model": "Coaster"}

    def test_zero_capacity_rejected(self):
        with pytest.raises(Exception):
            CarUpdate(passenger_capacity=0)

    def test_negative_capacity_rejected(self):
        with pytest.raises(Exception):
            CarUpdate(passenger_capacity=-5)

    def test_last_serviced_date_accepted(self):
        u = CarUpdate(last_serviced=date.today())
        assert u.last_serviced == date.today()

    def test_immutable_fields_absent(self):
        """Ensure plate_number etc are not fields on CarUpdate at all."""
        import inspect
        fields = CarUpdate.model_fields.keys()
        for immutable in ("plate_number", "initial_mileage", "registration_date", "status"):
            assert immutable not in fields, f"{immutable} should not be in CarUpdate"


# ── DriverCreate ──────────────────────────────────────────────────────────────

class TestDriverCreate:
    def valid(self, **overrides):
        base = {
            "first_name": "John",
            "last_name": "Banda",
            "email": "john@example.com",
            "phone": "+260971000001",
            "nrc_number": "123456/78/1",
            "license_number": "DR12345",
            "license_expiry": FUTURE,
            "next_of_kin_name": "Mary Banda",
            "next_of_kin_relationship": "Spouse",
            "next_of_kin_phone": "+260971000002",
            "registration_date": "2024-01-01",
        }
        return {**base, **overrides}

    def test_nrc_normalised_to_uppercase(self):
        d = DriverCreate(**self.valid(nrc_number="123456/78/1"))
        assert d.nrc_number == "123456/78/1"

    def test_nrc_strips_whitespace(self):
        d = DriverCreate(**self.valid(nrc_number="  123456/78/1  "))
        assert d.nrc_number == "123456/78/1"

    def test_expired_license_rejected(self):
        with pytest.raises(Exception):
            DriverCreate(**self.valid(license_expiry=PAST))

    def test_license_expiry_today_accepted(self):
        d = DriverCreate(**self.valid(license_expiry=TODAY))
        assert d.license_expiry == date.today()

    def test_license_expiry_future_accepted(self):
        d = DriverCreate(**self.valid(license_expiry=FUTURE))
        assert d.license_expiry > date.today()

    def test_invalid_email_rejected(self):
        with pytest.raises(Exception):
            DriverCreate(**self.valid(email="not-an-email"))

    def test_optional_next_of_kin_email_defaults_none(self):
        d = DriverCreate(**self.valid())
        assert d.next_of_kin_email is None


# ── DriverUpdate ──────────────────────────────────────────────────────────────

class TestDriverUpdate:
    def test_empty_update_is_valid(self):
        u = DriverUpdate()
        assert u.model_dump(exclude_none=True) == {}

    def test_partial_update_contains_only_provided_fields(self):
        u = DriverUpdate(phone="+260971999999")
        d = u.model_dump(exclude_none=True)
        assert d == {"phone": "+260971999999"}

    def test_expired_license_rejected(self):
        with pytest.raises(Exception):
            DriverUpdate(license_expiry=PAST)

    def test_future_license_accepted(self):
        u = DriverUpdate(license_expiry=FUTURE)
        assert u.license_expiry > date.today()

    def test_invalid_email_rejected(self):
        with pytest.raises(Exception):
            DriverUpdate(email="not-an-email")

    def test_immutable_fields_absent(self):
        fields = DriverUpdate.model_fields.keys()
        for immutable in ("nrc_number", "registration_date", "status"):
            assert immutable not in fields, f"{immutable} should not be in DriverUpdate"

    def test_multi_field_update(self):
        u = DriverUpdate(phone="+260971999999", email="new@example.com")
        d = u.model_dump(exclude_none=True)
        assert "phone" in d
        assert "email" in d
        assert len(d) == 2


# ── WeeklyLogCreate ───────────────────────────────────────────────────────────

class TestWeeklyLogCreate:
    def valid(self, **overrides):
        base = {
            "car_id": str(uuid4()),
            "driver_id": str(uuid4()),
            "week_start_date": "2025-01-06",
            "year": 2025,
            "start_mileage": 1000.0,
            "closing_mileage": 1450.0,
        }
        return {**base, **overrides}

    def test_valid_log_creates_successfully(self):
        log = WeeklyLogCreate(**self.valid())
        assert log.closing_mileage > log.start_mileage

    def test_closing_equal_to_start_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(start_mileage=1000.0, closing_mileage=1000.0))

    def test_closing_less_than_start_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(start_mileage=1500.0, closing_mileage=1000.0))

    def test_year_mismatch_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(year=2024, week_start_date="2025-01-06"))

    def test_year_matches_date_accepted(self):
        log = WeeklyLogCreate(**self.valid(year=2025, week_start_date="2025-06-01"))
        assert log.year == 2025

    def test_negative_revenue_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(total_revenue=-1.0))

    def test_negative_shortage_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(shortage=-1.0))

    def test_negative_expense_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(expense_on_car=-1.0))

    def test_negative_spares_cost_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(spares_cost=-1.0))

    def test_defaults_for_optional_fields(self):
        log = WeeklyLogCreate(**self.valid())
        assert log.total_revenue == 0.0
        assert log.shortage == 0.0
        assert log.expense_on_car == 0.0
        assert log.spares_cost == 0.0
        assert log.spares_bought is None
        assert log.comments is None

    def test_year_below_minimum_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(year=2019, week_start_date="2019-01-01"))

    def test_year_above_maximum_rejected(self):
        with pytest.raises(Exception):
            WeeklyLogCreate(**self.valid(year=2101, week_start_date="2101-01-01"))
