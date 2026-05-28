# app/config.py

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
    ALLOWED_ORIGIN: str = "http://localhost:5500"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("FLEET_API_KEY")
    @classmethod
    def api_key_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("FLEET_API_KEY must be at least 32 characters.")
        return v


# Single module-level instance — imported everywhere else.
settings = Settings()
