# app/schemas/cars.py

from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class VehicleType(str, Enum):
    sedan = "Sedan"
    hatchback = "Hatchback"
    suv = "SUV"
    truck = "Truck"
    coupe = "Coupe"
    minivan = "Minivan"
    station_wagon = "Station Wagon"
    minibus = "Minibus"
    bus = "Bus"


class CarBase(BaseModel):
    plate_number: str = Field(..., max_length=20)
    make: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    vehicle_type: VehicleType
    passenger_capacity: int = Field(..., gt=0)
    initial_mileage: float = Field(default=0.0, ge=0.0)
    last_serviced: Optional[date] = None
    registration_date: date


class CarCreate(CarBase):
    @field_validator("plate_number")
    @classmethod
    def normalize_plate(cls, v: str) -> str:
        """Normalise to uppercase and strip whitespace before DB insert."""
        return v.strip().upper()


# CarResponse is intentionally NOT a subclass of CarCreate.
# The DB returns status and created_at which are not part of the creation payload.
class CarResponse(CarBase):
    id: UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CarUpdate(BaseModel):
    """
    Fields the caller is allowed to change on an existing car.

    All fields are Optional — only non-None values are applied (partial PATCH).
    Immutable fields (plate_number, initial_mileage, registration_date, status)
    are intentionally absent from this schema so they can never be supplied.
    """
    make: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    vehicle_type: Optional[VehicleType] = None
    passenger_capacity: Optional[int] = Field(default=None, gt=0)
    last_serviced: Optional[date] = None


class DecommissionRequest(BaseModel):
    decommission_date: date
    reason: str = Field(..., min_length=3)
    final_mileage: float = Field(..., ge=0)
    total_revenue_at_decommission: float = Field(..., ge=0)


class CarAnalyticsResponse(BaseModel):
    car_id: UUID
    plate_number: str
    make: str
    model: str
    vehicle_type: VehicleType
    status: str
    last_serviced: Optional[date]
    trip_count: int
    total_mileage: float
    total_revenue: float
    total_spares: float
    total_expenses: float
    net_profit: float
    current_mileage: float
    odometer: float
    health_score: float
    needs_service: bool

    model_config = {"from_attributes": True}
