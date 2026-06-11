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

    # log_repo.py
    def list_entries(self) -> list[dict]:
        res = (
            self._db.table("weekly_logs")
            .select(
                "id, created_at, week_start_date, year, "
                "start_mileage, closing_mileage, total_mileage, "
                "total_revenue, expense_on_car, shortage, "
                "spares_bought, spares_cost, net_revenue, comments, "
                "drivers(first_name, last_name), "
                "cars(make, model, plate_number)"
            )
            .order("created_at", desc=True)
            .execute()
        )

        rows: list[dict] = []
        for row in res.data or []:
            driver = row.get("drivers") or {}
            car = row.get("cars") or {}
            driver_name = " ".join(
                part for part in [driver.get("first_name"), driver.get("last_name")] if part
            ).strip()
            car_name = " ".join(
                part for part in [car.get("make"), car.get("model")] if part
            ).strip()
            rows.append({
                "id":              row["id"],
                "created_at":      row["created_at"],
                "driver_name":     driver_name or "Unknown driver",
                "car":             car_name or "Unknown vehicle",
                "plate_number":    car.get("plate_number") or "N/A",
                "week_start_date": row.get("week_start_date"),
                "year":            row.get("year"),
                "start_mileage":   row.get("start_mileage"),
                "closing_mileage": row.get("closing_mileage"),
                "total_mileage":   row.get("total_mileage"),
                "total_revenue":   row.get("total_revenue"),
                "expense_on_car":  row.get("expense_on_car"),
                "shortage":        row.get("shortage"),
                "spares_bought":   row.get("spares_bought"),
                "spares_cost":     row.get("spares_cost"),
                "net_revenue":     row.get("net_revenue"),
                "comments":        row.get("comments"),
            })
        return rows
