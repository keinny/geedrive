# api/repositories/analytics_repo.py
#
# Read-only queries against the four analytical views.
# Views do all aggregation — this layer just calls them.

from supabase import Client


class AnalyticsRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def get_dashboard(self) -> dict:
        """
        Queries view_dashboard_summary. Returns an empty dict rather than
        raising if the view has no rows (e.g. on a freshly provisioned DB).
        Fix: original used .single() which throws PostgRESTError on zero rows.
        """
        res = self._db.table("view_dashboard_summary").select("*").execute()
        return res.data[0] if res.data else {}
