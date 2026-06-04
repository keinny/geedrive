# api/schemas/cars.py
import re
from typing import Annotated,  Optional
from pydantic import BaseModel, Field, field_validator, BeforeValidator
from datetime import date, datetime
from uuid import UUID
from enum import Enum


# --- SANITIZATION & NORMALIZATION FUNCTIONS ---
def clean_vehicle_plate(v: str) -> str:
    if not isinstance(v, str):
        raise ValueError("Vehicle plate must be text string format")
    # Convert to uppercase, remove hyphens, and reduce multiple spaces to a single clean space
    cleaned = v.upper().replace("-", " ").strip()
    return re.sub(r"\s+", " ", cleaned)


# --- STRONGLY-TYPED PYDANTIC TYPES ---
# Reusable types validating against the precise Zambian patterns

ZambianVehiclePlate = Annotated[
    str,
    BeforeValidator(clean_vehicle_plate),
    # Accepts patterns with or without a middle space (e.g., 'BCA 1234' or 'BCA1234')
    Field(pattern=r"^[A-Z]{1,3}\s?\d{1,4}$", examples=["BCA 1234", "CAG 987"])
]


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
    plate_number: ZambianVehiclePlate
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
    def reject_reserved_plates(cls, v: str) -> str:
        if v.startswith("GRZ"):
            raise ValueError("Government vehicles cannot be registered")
        return v


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
