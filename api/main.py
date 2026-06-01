# app/main.py

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.auth import verify_api_key
from app.config import settings
from app.database import get_supabase
from app.repositories.analytics_repo import AnalyticsRepository
from app.routers import cars, drivers, logs
from app import cache as app_cache

# Auth is applied at the router level (not globally on FastAPI()) so that
# the /health endpoint can remain unauthenticated for deployment platform
# liveness checks.
app = FastAPI(
    title="GeeDrive Motors Fleet Management API",
    version="2.0.0",
    description=(
        "REST API for the GeeDrive fleet management system. "
        "All endpoints except /health require a Bearer token."
    ),
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Fix: allow_credentials=True is incompatible with allow_origins=["*"].
# The browser rejects all credentialed cross-origin requests when wildcard
# origins are set. Use the specific production origin from settings.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGIN,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers — auth applied here, not globally ─────────────────────────────────
AUTH = [Depends(verify_api_key)]

app.include_router(cars.router,    dependencies=AUTH)
app.include_router(drivers.router, dependencies=AUTH)
app.include_router(logs.router,    dependencies=AUTH)


# ── Dashboard endpoint ────────────────────────────────────────────────────────

@app.get("/dashboard", tags=["Dashboard"], dependencies=AUTH)
def get_dashboard_summary(db=Depends(get_supabase)):
    """Aggregated fleet summary from view_dashboard_summary."""
    cached = app_cache.get("dashboard")
    if cached is not None:
        return cached
    repo = AnalyticsRepository(db)
    result = repo.get_dashboard()
    app_cache.set("dashboard", result)
    return result


# ── Health check ──────────────────────────────────────────────────────────────
# No auth — used by Render / Railway to verify the process started correctly.
# include_in_schema=False keeps it out of the public API docs.

@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


@app.get("/debug-cors")
def debug_cors():
    return {"allowed_origins": settings.ALLOWED_ORIGIN}


@app.get("/debug-key")
def debug_key():
    return {"key_length": len(settings.FLEET_API_KEY), "key_prefix": settings.FLEET_API_KEY[:8]}