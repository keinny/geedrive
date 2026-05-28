# app/schemas/logs.py

from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime
from typing import Optional
from uuid import UUID


class WeeklyLogCreate(BaseModel):
    car_id: UUID
    driver_id: UUID
    week_start_date: date
    year: int = Field(..., ge=2020, le=2100)
    start_mileage: float = Field(..., ge=0)
    closing_mileage: float = Field(..., ge=0)
    total_revenue: float = Field(default=0.0, ge=0)
    shortage: float = Field(default=0.0, ge=0)
    expense_on_car: float = Field(default=0.0, ge=0)
    spares_bought: Optional[str] = None
    spares_cost: float = Field(default=0.0, ge=0)
    comments: Optional[str] = None

    @model_validator(mode="after")
    def validate_log(self) -> "WeeklyLogCreate":
        # Mileage progression — mirrors the DB CHECK constraint as a fast
        # application-layer rejection before the round-trip to Supabase.
        if self.closing_mileage <= self.start_mileage:
            raise ValueError(
                "Closing mileage must be strictly greater than start mileage."
            )
        # Year consistency — prevents silent bad data where year=2024 is sent
        # with a week_start_date in 2025. The year column exists for fast
        # year-partitioned queries so it must always match the date.
        if self.year != self.week_start_date.year:
            raise ValueError(
                "year field must match the calendar year of week_start_date."
            )
        return self


# WeeklyLogResponse does NOT inherit from WeeklyLogCreate.
# total_mileage and net_revenue are GENERATED columns computed by the DB —
# they are read-only and should not appear as input fields on the create schema.
class WeeklyLogResponse(BaseModel):
    id: UUID
    car_id: UUID
    driver_id: UUID
    week_start_date: date
    year: int
    start_mileage: float
    closing_mileage: float
    total_mileage: float        # DB GENERATED ALWAYS
    total_revenue: float
    shortage: float
    expense_on_car: float
    net_revenue: float          # DB GENERATED ALWAYS
    spares_bought: Optional[str]
    spares_cost: float
    comments: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
