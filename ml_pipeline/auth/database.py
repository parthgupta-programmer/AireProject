"""
database.py
───────────
Database engine, session management, and table initialization.
Supports SQLite (default) and PostgreSQL via DATABASE_URL environment variable.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Store default sqlite database in ml_pipeline/data/
DEFAULT_DB_DIR = Path(__file__).parent.parent / "data"
DEFAULT_DB_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_SQLITE_PATH = DEFAULT_DB_DIR / "aire_users.db"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all registered database tables if they do not exist."""
    # Import models to ensure they are registered with Base metadata
    from ml_pipeline.auth import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
