# api/auth.py

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from api.config import settings

security = HTTPBearer()


def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """
    Validates the shared admin Bearer token (plain API key, not a JWT).
    Rotate FLEET_API_KEY in the environment and redeploy to invalidate
    all existing sessions without a code change.
    """
    from api.main import _session_tokens
    token = credentials.credentials
    if token == settings.FLEET_API_KEY or token in _session_tokens:
        return token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing Fleet API Key.",
        headers={"WWW-Authenticate": "Bearer"},
        )
