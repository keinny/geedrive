# app/repositories/driver_repo.py
#
# All SQL and storage operations for drivers, driver_documents,
# and driver_terminations. Routers never call supabase directly.

from typing import Optional
from uuid import UUID
from supabase import Client

from app.schemas.drivers import DriverCreate, DriverUpdate, TerminationRequest


class DriverRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    # ── NRC helpers ───────────────────────────────────────────────────────────

    def nrc_exists(self, nrc: str) -> bool:
        """Index-backed existence check via the nrc_exists() DB function."""
        res = self._db.rpc("nrc_exists", {"p_nrc": nrc.strip().upper()}).execute()
        return bool(res.data)

    # ── Reads ─────────────────────────────────────────────────────────────────

    def get_by_id(self, driver_id: UUID) -> Optional[dict]:
        res = (
            self._db.table("drivers")
            .select("id, status")
            .eq("id", str(driver_id))
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_all(self) -> list[dict]:
        res = (
            self._db.table("drivers")
            .select("*")
            .order("last_name")
            .execute()
        )
        return res.data

    def get_documents(self, driver_id: UUID) -> list[dict]:
        res = (
            self._db.table("driver_documents")
            .select("id, document_type, original_filename, mime_type, uploaded_at")
            .eq("driver_id", str(driver_id))
            .order("uploaded_at", desc=False)
            .execute()
        )
        return res.data

    def get_analytics(self, name: Optional[str] = None) -> list[dict]:
        query = self._db.table("view_driver_analytics").select("*")
        if name:
            query = query.ilike("full_name", f"%{name.strip()}%")
        return query.execute().data

    def get_latest_document_path(self, driver_id: UUID, doc_type: str) -> Optional[str]:
        res = (
            self._db.table("driver_documents")
            .select("storage_path")
            .eq("driver_id", str(driver_id))
            .eq("document_type", doc_type)
            .order("uploaded_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0]["storage_path"] if res.data else None

    # ── Writes ────────────────────────────────────────────────────────────────

    def create(self, driver: DriverCreate) -> dict:
        """
        Inserts driver row only. Documents are inserted separately via
        save_document() after storage upload succeeds.
        """
        res = (
            self._db.table("drivers")
            .insert(driver.model_dump(mode="json"))
            .execute()
        )
        return res.data[0]

    def save_document(
        self,
        driver_id: UUID,
        doc_type: str,
        storage_path: str,
        original_filename: str,
        mime_type: str,
    ) -> dict:
        res = (
            self._db.table("driver_documents")
            .insert(
                {
                    "driver_id": str(driver_id),
                    "document_type": doc_type,
                    "storage_path": storage_path,
                    "original_filename": original_filename,
                    "mime_type": mime_type,
                }
            )
            .execute()
        )
        return res.data[0]

    def get_full_by_id(self, driver_id: UUID) -> Optional[dict]:
        """Returns the full driver row including all fields, or None."""
        res = (
            self._db.table("drivers")
            .select("*")
            .eq("id", str(driver_id))
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update(self, driver_id: UUID, patch: "DriverUpdate") -> dict:
        """
        Applies only the non-None fields from DriverUpdate.
        Returns the updated driver row.
        """
        payload = {k: v for k, v in patch.model_dump(mode="json").items() if v is not None}
        res = (
            self._db.table("drivers")
            .update(payload)
            .eq("id", str(driver_id))
            .execute()
        )
        return res.data[0]

    def terminate(self, driver_id: UUID, req: TerminationRequest) -> None:
        """
        Two-step: update status then insert termination record.
        See CarRepository.decommission() for the same atomicity note.
        """
        self._db.table("drivers").update({"status": "terminated"}).eq(
            "id", str(driver_id)
        ).execute()

        payload = req.model_dump(mode="json")
        payload["driver_id"] = str(driver_id)
        self._db.table("driver_terminations").insert(payload).execute()

    # ── Storage ───────────────────────────────────────────────────────────────

    BUCKET = "driver-documents"

    def upload_document(
        self,
        driver_id: UUID,
        doc_type: str,
        filename: str,
        file_bytes: bytes,
        content_type: str,
    ) -> str:
        """
        Uploads binary file to Supabase Storage.
        Returns the storage path on success.
        Raises on any storage error — caller handles cleanup.
        """
        path = f"{str(driver_id)}/{doc_type}_{filename}"
        try:
            response = self._db.storage.from_(self.BUCKET).upload(
                path=path,
                file=file_bytes,
                file_options={"content-type": content_type},
            )
            if hasattr(response, "error") and response.error:
                raise ValueError(f"Storage upload failed: {response.error}")
        except Exception as exc:
            raise ValueError(f"Storage upload failed: {exc}") from exc
        return path

    def delete_document_from_storage(self, storage_path: str) -> None:
        """Used for cleanup rollback if a post-upload step fails."""
        try:
            self._db.storage.from_(self.BUCKET).remove([storage_path])
        except Exception:
            # Log but don't raise — this is a best-effort cleanup.
            pass

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generates a time-bound signed URL for a private storage object.
        Fix: handles both 'signedUrl' and 'signedURL' key names across
        Supabase Python SDK versions.
        Raises ValueError if the SDK returns neither key.
        """
        result = self._db.storage.from_(self.BUCKET).create_signed_url(
            path=storage_path,
            expires_in=expires_in,
        )
        url = result.get("signedUrl") or result.get("signedURL")
        if not url:
            raise ValueError(
                f"Storage service did not return a signed URL. "
                f"Response keys: {list(result.keys())}"
            )
        return url
