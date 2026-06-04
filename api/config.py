# api/config.py
from typing import List
from pydantic import HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # SUPABASE_URL typed as HttpUrl so a malformed value fails at startup,
    # not silently at the first DB call.
    SUPABASE_URL: HttpUrl
    SUPABASE_SERVICE_KEY: str
    FLEET_API_KEY: str

    # CORS: set to your GitHub Pages / Netlify domain in production.
    # e.g. "https://your-org.github.io"
    # ALLOWED_ORIGIN: str = "http://localhost:5500"
    ALLOWED_ORIGIN: List[str] = [
        "http://localhost:5500",
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://geedrive.onrender.com",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("FLEET_API_KEY")
    @classmethod
    def api_key_min_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 32:
            raise ValueError("FLEET_API_KEY must be at least 32 characters.")
        return v

    @field_validator("ALLOWED_ORIGIN", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


# Single module-level instance — imported everywhere else.
settings = Settings()
