import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session

DB_PATH = os.path.join("data", "app.db")


def _ensure_data_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


_ensure_data_dir()
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))


def get_session():
    return SessionLocal()


def init_db(Base):
    Base.metadata.create_all(bind=engine)
    _ensure_user_admin_column()


def _ensure_user_admin_column():
    """Ensure is_admin exists on users for older databases."""
    try:
        with engine.begin() as conn:
            cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)"))]
            if "is_admin" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
    except Exception:
        # If adding fails (e.g., during first-time setup), ignore to not break startup.
        pass
