# api/cache.py
#
# Lightweight in-memory TTL cache for expensive analytics views.
# Lives in the worker process; data is per-process (fine for single-worker
# deploys and acceptable for multi-worker since stale reads are bounded by TTL).
# Invalidated explicitly after weekly log writes and car decommissions.

import time
from typing import Any, Optional

_store: dict[str, tuple[float, int, Any]] = {}
DEFAULT_TTL = 300  # 5 minutes


def get(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    ts, ttl, value = entry
    if time.time() - ts > ttl:
        del _store[key]
        return None
    return value


def set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:  # noqa: A001
    _store[key] = (time.time(), ttl, value)


def invalidate(key: str) -> None:
    _store.pop(key, None)


def invalidate_prefix(prefix: str) -> None:
    keys = [k for k in _store if k.startswith(prefix)]
    for k in keys:
        del _store[k]


def clear() -> None:
    _store.clear()
