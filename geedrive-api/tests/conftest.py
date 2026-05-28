# tests/conftest.py
#
# Must run before any app module is imported.
# Sets the three required env vars so pydantic-settings doesn't raise on
# Settings() instantiation during collection.

import os

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("FLEET_API_KEY", "test-fleet-api-key-that-is-long-enough-32chars")
