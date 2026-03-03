import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from Backend.runtime import is_production, is_test, is_dev


def _normalize_database_url(raw_url: str) -> str:
    raw = (raw_url or "").strip()
    if not raw:
        return ""
    if raw.startswith("postgres://"):
        return "postgresql+psycopg2://" + raw[len("postgres://") :]
    return raw


def _sqlite_fallback_url():
    db_path = os.path.join("data", "app.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return f"sqlite:///{db_path}"


_RAW_DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
_DATABASE_URL = _normalize_database_url(_RAW_DATABASE_URL)
_USING_SQLITE = False


def _assert_postgres_config():
    if not _RAW_DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is required in production and must point to PostgreSQL."
        )
    if not _RAW_DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+psycopg2://")):
        raise RuntimeError(
            "DATABASE_URL must be a PostgreSQL URL in production (postgres:// or postgresql://)."
        )


if is_production():
    _assert_postgres_config()

if _DATABASE_URL:
    engine = create_engine(_DATABASE_URL, pool_pre_ping=True)
else:
    _USING_SQLITE = True
    if not (is_test() or is_dev() or not is_production()):
        raise RuntimeError("SQLite fallback is disabled in production.")
    engine = create_engine(
        _sqlite_fallback_url(),
        connect_args={"check_same_thread": False},
    )

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))


def get_session():
    return SessionLocal()


def init_db(Base):
    Base.metadata.create_all(bind=engine)


def using_sqlite():
    return _USING_SQLITE
