# api/schemas/drivers.py

from pydantic import BaseModel, Field, EmailStr, field_validator
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID


# ── Document sub-schema ───────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    """Included in DriverResponse so the frontend knows documents uploaded
    successfully without requiring a second GET request."""
    id: UUID
    document_type: str          # 'nrc' | 'license'
    original_filename: str
    mime_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


# ── Driver schemas ────────────────────────────────────────────────────────────

class DriverBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(..., max_length=30)
    nrc_number: str = Field(..., max_length=50)
    license_number: str = Field(..., max_length=50)
    license_expiry: date
    next_of_kin_name: str = Field(..., max_length=200)
    next_of_kin_relationship: str = Field(..., max_length=50)
    next_of_kin_phone: str = Field(..., max_length=30)
    next_of_kin_email: Optional[EmailStr] = None
    registration_date: date


class DriverCreate(DriverBase):
    @field_validator("nrc_number")
    @classmethod
    def normalize_nrc(cls, v: str) -> str:
        """Strip whitespace and uppercase so duplicate detection is consistent.
        e.g. '123456/78/9', ' 123456/78/9', '123456/78/9 ' all resolve to the
        same value before the uniqueness check runs."""
        return v.strip().upper()

    @field_validator("license_expiry")
    @classmethod
    def validate_future_expiry(cls, v: date) -> date:
        # Fix: use < not <= so a licence expiring today is still accepted.
        # A licence is valid until end of the expiry day.
        if v < date.today():
            raise ValueError("License expiry date is in the past.")
        return v


class DriverResponse(DriverBase):
    """Returned after registration. Includes document metadata so the frontend
    can surface document links without a second request."""
    id: UUID
    status: str
    created_at: datetime
    documents: List[DocumentResponse] = []

    model_config = {"from_attributes": True}


class DriverUpdate(BaseModel):
    """
    Fields the caller is allowed to update on an existing driver.

    All fields are Optional — only non-None values are patched.
    Immutable fields (nrc_number, registration_date, status) are absent.
    """
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    license_number: Optional[str] = Field(default=None, max_length=50)
    license_expiry: Optional[date] = None
    next_of_kin_name: Optional[str] = Field(default=None, max_length=200)
    next_of_kin_relationship: Optional[str] = Field(default=None, max_length=50)
    next_of_kin_phone: Optional[str] = Field(default=None, max_length=30)
    next_of_kin_email: Optional[EmailStr] = None

    @field_validator("license_expiry", mode="before")
    @classmethod
    def validate_future_expiry(cls, v) -> date:
        if v is None:
            return v
        d = v if isinstance(v, date) else date.fromisoformat(str(v))
        if d < date.today():
            raise ValueError("License expiry date is in the past.")
        return d


# ── Termination ───────────────────────────────────────────────────────────────

class TerminationRequest(BaseModel):
    termination_date: date
    reason: str = Field(..., min_length=3)


# ── Analytics ─────────────────────────────────────────────────────────────────

class DriverAnalyticsResponse(BaseModel):
    driver_id: UUID
    full_name: str
    nrc_number: str
    status: str
    license_expiry: date
    trip_count: int
    total_revenue: float
    avg_revenue: float
    total_shortage: float
    shortages_count: int
    expense_ratio: float
    performance_score: float

    model_config = {"from_attributes": True}
