# api/repositories/log_repo.py
#
# All SQL operations for the weekly_logs immutable ledger.

from supabase import Client
from api.schemas.logs import WeeklyLogCreate


class LogRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def get_car_status(self, car_id: str) -> str | None:
        """Returns the car's current status string, or None if not found."""
        res = (
            self._db.table("cars")
            .select("status")
            .eq("id", car_id)
            .limit(1)
            .execute()
        )
        return res.data[0]["status"] if res.data else None

    def get_driver_status(self, driver_id: str) -> str | None:
        res = (
            self._db.table("drivers")
            .select("status")
            .eq("id", driver_id)
            .limit(1)
            .execute()
        )
        return res.data[0]["status"] if res.data else None

    def create(self, log: WeeklyLogCreate) -> dict:
        """
        Inserts an immutable log row. Generated columns (total_mileage,
        net_revenue) are computed by the DB and returned in the response.

        Fix: model_dump(mode='json') serialises UUID → str and date → ISO
        string. Without this the Supabase client raises TypeError on UUID
        objects.
        """
        res = (
            self._db.table("weekly_logs")
            .insert(log.model_dump(mode="json"))
            .execute()
        )
        return res.data[0]
