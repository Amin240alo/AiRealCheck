import os


def _env_is_true(name: str) -> bool:
    return (os.getenv(name, "") or "").strip().lower() in {"1", "true", "yes", "on"}


def _env_label() -> str:
    return (os.getenv("AIREALCHECK_ENV") or os.getenv("FLASK_ENV") or "").strip().lower()


def is_test() -> bool:
    label = _env_label()
    if label in {"test", "testing"}:
        return True
    return "PYTEST_CURRENT_TEST" in os.environ


def is_dev() -> bool:
    return _env_label() in {"dev", "development", "local"}


def is_debug() -> bool:
    return _env_is_true("AIREALCHECK_DEBUG") or _env_is_true("DEBUG") or _env_is_true("FLASK_DEBUG")


def is_production() -> bool:
    label = _env_label()
    if label in {"prod", "production"}:
        return True
    if is_test() or is_dev():
        return False
    if is_debug():
        return False
    return True
