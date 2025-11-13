import os
from sqlalchemy import create_engine
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

