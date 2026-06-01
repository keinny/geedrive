# api/routers/cars.py

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from typing import List, Optional
from uuid import UUID

from api.database import get_supabase
from api.repositories.car_repo import CarRepository
from api.schemas.cars import CarCreate, CarUpdate, CarResponse, DecommissionRequest, CarAnalyticsResponse

router = APIRouter(prefix="/cars", tags=["Cars"])


def get_car_repo(db: Client = Depends(get_supabase)) -> CarRepository:
    """Dependency that injects a CarRepository bound to the shared DB client."""
    return CarRepository(db)


@router.post("", response_model=CarResponse, status_code=status.HTTP_201_CREATED)
def register_car(
    car: CarCreate,
    repo: CarRepository = Depends(get_car_repo),
):
    """Register a new vehicle. Plate number is normalised to uppercase by the schema."""
    if repo.get_by_plate(car.plate_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A car with plate {car.plate_number} is already registered.",
        )
    return repo.create(car)


@router.get("", response_model=List[CarResponse])
def list_cars(repo: CarRepository = Depends(get_car_repo)):
    return repo.list_all()


@router.get("/analytics", response_model=List[CarAnalyticsResponse])
def get_car_analytics(
    plate: Optional[str] = None,
    repo: CarRepository = Depends(get_car_repo),
):
    """Returns view_car_analytics. Optionally filtered by plate number."""
    return repo.get_analytics(plate)


@router.get("/{plate_number}/last-mileage")
def get_last_mileage(
    plate_number: str,
    repo: CarRepository = Depends(get_car_repo),
):
    """
    Returns the most recent closing mileage for a car.
    Used by the frontend to pre-populate the start_mileage field on the weekly
    log form. Sorted by week_start_date DESC — not by mileage value.
    """
    mileage = repo.get_last_mileage(plate_number)
    if mileage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No car found with plate {plate_number.upper()}.",
        )
    return {"last_mileage": mileage}


@router.patch("/{car_id}", response_model=CarResponse)
def update_car(
    car_id: UUID,
    patch: CarUpdate,
    repo: CarRepository = Depends(get_car_repo),
):
    """
    Partially updates mutable car fields.

    Mutable:   model, passenger_capacity, last_serviced
    Immutable: plate_number, initial_mileage, registration_date, status

    Only fields explicitly provided (non-null) are applied.
    Attempting to update a non-existent or decommissioned car returns 404/409.
    """
    car = repo.get_by_id(car_id)
    if not car:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car record not found.",
        )
    if car["status"] == "decommissioned":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a decommissioned vehicle.",
        )
    if not patch.model_dump(exclude_none=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updatable fields provided.",
        )
    updated = repo.update(car_id, patch)
    return updated


@router.patch("/{car_id}/decommission", status_code=status.HTTP_200_OK)
def decommission_car(
    car_id: UUID,
    req: DecommissionRequest,
    repo: CarRepository = Depends(get_car_repo),
):
    car = repo.get_by_id(car_id)
    if not car:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car record not found.",
        )
    if car["status"] == "decommissioned":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Car is already decommissioned.",
        )
    repo.decommission(car_id, req)
    return {"status": "success", "message": "Car successfully decommissioned."}
