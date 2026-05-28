import importlib

import app.config as config


def test_settings_loads_repo_root_env_file(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    monkeypatch.delenv("FLEET_API_KEY", raising=False)

    reloaded = importlib.reload(config)

    settings = reloaded.Settings()

    assert str(settings.SUPABASE_URL) == "https://gchxyljkchorylqaeymo.supabase.co/"
    assert settings.SUPABASE_SERVICE_KEY.startswith("sb_secret_")
    assert settings.FLEET_API_KEY.startswith("fa73e76a")