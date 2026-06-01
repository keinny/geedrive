# api/routers/logs.py

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from api.database import get_supabase
from api.repositories.log_repo import LogRepository
from api.schemas.logs import WeeklyLogCreate, WeeklyLogResponse
from api import cache as app_cache

router = APIRouter(prefix="/logs", tags=["Weekly Ledger Logs"])


def get_log_repo(db: Client = Depends(get_supabase)) -> LogRepository:
    return LogRepository(db)


@router.post("", response_model=WeeklyLogResponse, status_code=status.HTTP_201_CREATED)
def submit_weekly_log(
    log: WeeklyLogCreate,
    repo: LogRepository = Depends(get_log_repo),
):
    """
    Appends an immutable row to the weekly_logs ledger.

    Business rule: both the car and driver must be active at submission time.
    The DB foreign keys prevent referencing non-existent records, but they do
    not enforce the active status constraint — that is checked here.
    """
    car_status = repo.get_car_status(str(log.car_id))
    if car_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found.",
        )
    if car_status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot log a trip for a decommissioned vehicle.",
        )

    driver_status = repo.get_driver_status(str(log.driver_id))
    if driver_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found.",
        )
    if driver_status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot log a trip for a terminated driver.",
        )
    
    app_cache.invalidate_prefix("car_analytics:")  # deletes all car analytics cache entries
    app_cache.invalidate("dashboard")              # returns and deletes the dashboard cache entry

    return repo.create(log)
