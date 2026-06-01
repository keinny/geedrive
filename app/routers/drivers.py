# app/routers/drivers.py

import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from supabase import Client
from typing import List, Optional
from uuid import UUID

from app.database import get_supabase
from app.repositories.driver_repo import DriverRepository
from app.schemas.drivers import DriverCreate, DriverUpdate, DriverResponse, TerminationRequest, DriverAnalyticsResponse

router = APIRouter(prefix="/drivers", tags=["Drivers"])

# 10 MB hard limit on document uploads — enforced before bytes are read.
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}


def get_driver_repo(db: Client = Depends(get_supabase)) -> DriverRepository:
    return DriverRepository(db)


@router.get("/check-nrc")
def check_nrc(nrc: str, repo: DriverRepository = Depends(get_driver_repo)):
    """
    Pre-submission NRC uniqueness check. Called by the frontend before the
    driver registration form is submitted to give immediate inline feedback.
    """
    return {"exists": repo.nrc_exists(nrc)}


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def register_driver(
    driver_data: str = Form(..., description="JSON-serialised DriverCreate payload"),
    nrc_file: UploadFile = File(...),
    license_file: UploadFile = File(...),
    repo: DriverRepository = Depends(get_driver_repo),
):
    """
    Multipart registration pipeline.

    Operation order (critical — see fix notes):
      1. Parse and validate driver_data through DriverCreate schema.
      2. Check NRC uniqueness.
      3. Read and validate both files (size + MIME type).
      4. Upload both files to storage.
      5. Insert driver row.
      6. Insert both driver_document rows.
      7. Return DriverResponse with embedded document metadata.

    If step 4 partially succeeds (one file uploads, the second fails),
    the uploaded file is deleted from storage before raising. The driver row
    is never written until both files are confirmed in storage, so there are
    no orphan driver records without documents.
    """

    # ── Step 1: Parse and validate through Pydantic ───────────────────────────
    # Fix: original inserted raw_json directly, bypassing all DriverCreate
    # validators (license_expiry, nrc normalisation, field length constraints).
    try:
        raw = json.loads(driver_data)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="driver_data is not valid JSON.",
        )

    try:
        validated_driver = DriverCreate(**raw)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    # ── Step 2: NRC uniqueness ────────────────────────────────────────────────
    if repo.nrc_exists(validated_driver.nrc_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"NRC {validated_driver.nrc_number} is already registered.",
        )

    # ── Step 3: Read and validate files ──────────────────────────────────────
    files: dict[str, tuple[bytes, str, str]] = {}  # doc_type → (bytes, filename, mime)

    for doc_type, upload in [("nrc", nrc_file), ("license", license_file)]:
        if upload.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"{doc_type} file must be JPEG, PNG, or PDF. "
                       f"Got: {upload.content_type}",
            )
        file_bytes = await upload.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{doc_type} file exceeds 10 MB limit.",
            )
        files[doc_type] = (file_bytes, upload.filename, upload.content_type)

    # ── Step 4: Upload both files to storage ──────────────────────────────────
    # Fix: driver row is NOT inserted until both uploads succeed.
    # If the second upload fails, the first is removed before raising.
    uploaded_paths: dict[str, str] = {}

    for doc_type, (file_bytes, filename, content_type) in files.items():
        try:
            # driver UUID is not available yet — use NRC as folder name at this
            # stage. Path is updated with the real driver UUID after insert.
            temp_path = repo.upload_document(
                driver_id=validated_driver.nrc_number,  # temporary namespace
                doc_type=doc_type,
                filename=filename,
                file_bytes=file_bytes,
                content_type=content_type,
            )
            uploaded_paths[doc_type] = temp_path
        except Exception as exc:
            # Roll back any files already uploaded this request.
            for path in uploaded_paths.values():
                repo.delete_document_from_storage(path)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Storage upload failed for {doc_type} document: {exc}",
            )

    # ── Step 5: Insert driver row ─────────────────────────────────────────────
    try:
        driver_row = repo.create(validated_driver)
    except Exception as exc:
        # Driver insert failed — clean up uploaded files.
        for path in uploaded_paths.values():
            repo.delete_document_from_storage(path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Driver record creation failed: {exc}",
        )

    driver_id = UUID(driver_row["id"])

    # ── Step 6: Insert driver_document rows ───────────────────────────────────
    document_rows = []
    for doc_type, storage_path in uploaded_paths.items():
        _, filename, content_type = files[doc_type]
        doc_row = repo.save_document(
            driver_id=driver_id,
            doc_type=doc_type,
            storage_path=storage_path,
            original_filename=filename,
            mime_type=content_type,
        )
        document_rows.append(doc_row)

    # ── Step 7: Build and return response with document metadata ──────────────
    # Fix: original returned only the driver row — frontend had no document IDs.
    driver_row["documents"] = document_rows
    return driver_row


@router.get("", response_model=List[DriverResponse])
def list_drivers(repo: DriverRepository = Depends(get_driver_repo)):
    drivers = repo.list_all()
    if not drivers:
        return []
    ids = [UUID(d["id"]) for d in drivers]
    docs_map = repo.get_documents_bulk(ids)
    for d in drivers:
        d["documents"] = docs_map.get(d["id"], [])
    return drivers


@router.get("/analytics", response_model=List[DriverAnalyticsResponse])
def get_driver_analytics(
    name: Optional[str] = None,
    repo: DriverRepository = Depends(get_driver_repo),
):
    return repo.get_analytics(name)


@router.get("/{driver_id}/{doc_type}/signed-url")
def get_document_signed_url(
    driver_id: UUID,
    doc_type: str,
    repo: DriverRepository = Depends(get_driver_repo),
):
    """Returns a 60-minute signed URL for a driver's NRC or license document."""
    if doc_type not in ("nrc", "license"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="doc_type must be 'nrc' or 'license'.",
        )

    storage_path = repo.get_latest_document_path(driver_id, doc_type)
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {doc_type} document found for this driver.",
        )

    try:
        url = repo.get_signed_url(storage_path)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return {"url": url, "expires_in": 3600}


@router.patch("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: UUID,
    patch: DriverUpdate,
    repo: DriverRepository = Depends(get_driver_repo),
):
    """
    Partially updates mutable driver fields.

    Mutable:   first_name, last_name, email, phone, license_number,
               license_expiry, next_of_kin_name, next_of_kin_relationship,
               next_of_kin_phone, next_of_kin_email
    Immutable: nrc_number, registration_date, status

    Only non-null fields are applied. A terminated driver cannot be updated.
    The response includes embedded document metadata for consistency.
    """
    driver = repo.get_by_id(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found.",
        )
    if driver["status"] == "terminated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a terminated driver.",
        )
    if not patch.model_dump(exclude_none=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updatable fields provided.",
        )
    updated = repo.update(driver_id, patch)
    updated["documents"] = repo.get_documents(driver_id)
    return updated


@router.patch("/{driver_id}/terminate", status_code=status.HTTP_200_OK)
def terminate_driver(
    driver_id: UUID,
    req: TerminationRequest,
    repo: DriverRepository = Depends(get_driver_repo),
):
    driver = repo.get_by_id(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver record not found.",
        )
    if driver["status"] == "terminated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver is already terminated.",
        )
    repo.terminate(driver_id, req)
    return {"status": "success", "message": "Driver profile terminated."}
