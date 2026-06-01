# app/repositories/car_repo.py
#
# All SQL operations touching the cars and car_decommissions tables.
# Routers never call supabase directly — they call methods on this class.
# This makes routes unit-testable by injecting a mock repository.

from typing import Optional
from uuid import UUID
from supabase import Client

from app.schemas.cars import CarCreate, CarUpdate, DecommissionRequest


class CarRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    # ── Reads ─────────────────────────────────────────────────────────────────

    def get_by_plate(self, plate: str) -> Optional[dict]:
        """Returns the car row for a given plate number, or None."""
        res = (
            self._db.table("cars")
            .select("*")
            .eq("plate_number", plate.upper())
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_by_id(self, car_id: UUID) -> Optional[dict]:
        res = (
            self._db.table("cars")
            .select("status")
            .eq("id", str(car_id))
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_all(self) -> list[dict]:
        res = self._db.table("cars").select("*").order("plate_number").execute()
        return res.data

    def get_last_mileage(self, plate: str) -> Optional[float]:
        """
        Returns the most recent closing mileage for a car, or its initial_mileage
        if no logs exist yet.

        Fix: sorted by week_start_date DESC then created_at DESC — not by mileage
        value. Sorting by value would return the highest ever figure, which is wrong
        when a corrected log entry with a lower closing mileage exists.
        """
        car_res = (
            self._db.table("cars")
            .select("id, initial_mileage")
            .eq("plate_number", plate.upper())
            .limit(1)
            .execute()
        )
        if not car_res.data:
            return None

        car = car_res.data[0]
        log_res = (
            self._db.table("weekly_logs")
            .select("closing_mileage")
            .eq("car_id", car["id"])
            .order("week_start_date", desc=True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (
            log_res.data[0]["closing_mileage"]
            if log_res.data
            else car["initial_mileage"]
        )

    def get_analytics(self, plate: Optional[str] = None) -> list[dict]:
        query = self._db.table("view_car_analytics").select("*")
        if plate:
            query = query.eq("plate_number", plate.upper())
        return query.execute().data

    # ── Writes ────────────────────────────────────────────────────────────────

    def create(self, car: CarCreate) -> dict:
        """
        Inserts a new car row. model_dump(mode='json') serialises date objects
        to ISO strings and UUIDs to strings — required by the Supabase client.
        """
        res = (
            self._db.table("cars")
            .insert(car.model_dump(mode="json"))
            .execute()
        )
        return res.data[0]

    def get_full_by_id(self, car_id: UUID) -> Optional[dict]:
        """Returns full car row for a given ID, or None."""
        res = (
            self._db.table("cars")
            .select("*")
            .eq("id", str(car_id))
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update(self, car_id: UUID, patch: "CarUpdate") -> dict:
        """
        Applies only the non-None fields from CarUpdate.
        Returns the updated car row.
        """
        payload = {k: v for k, v in patch.model_dump(mode="json").items() if v is not None}
        res = (
            self._db.table("cars")
            .update(payload)
            .eq("id", str(car_id))
            .execute()
        )
        return res.data[0]

    def decommission(self, car_id: UUID, req: DecommissionRequest) -> dict:
        """
        Two-step operation:
          1. Update cars.status to 'decommissioned'
          2. Insert a car_decommissions record
        Both steps are performed sequentially. If step 2 fails, step 1 has
        already committed. For true atomicity this should be promoted to a
        Supabase RPC function in a future iteration.
        """
        self._db.table("cars").update({"status": "decommissioned"}).eq(
            "id", str(car_id)
        ).execute()

        payload = req.model_dump(mode="json")
        payload["car_id"] = str(car_id)
        res = self._db.table("car_decommissions").insert(payload).execute()
        return res.data[0]
