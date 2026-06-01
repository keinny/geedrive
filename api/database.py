# api/database.py
#
# Single shared Supabase client instance.
# get_supabase() is used as a FastAPI dependency via Depends(get_supabase).
# The client is created once at import time (lru_cache) — not on every request.

from functools import lru_cache
from supabase import create_client, Client
from api.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Returns the module-level Supabase client. lru_cache ensures create_client
    (which initialises an HTTP session and parses the service key JWT) is only
    called once for the lifetime of the process.
    """
    return create_client(str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_KEY)
