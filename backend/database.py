import os
from collections.abc import Generator
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()


def resolve_database_url() -> str:
    """Build a DSN that survives special characters in POSTGRES_PASSWORD."""
    password = os.getenv("POSTGRES_PASSWORD") or os.getenv("DATABASE_PASSWORD") or ""
    user = os.getenv("POSTGRES_USER", "mess")
    host = os.getenv("POSTGRES_HOST")
    port = os.getenv("POSTGRES_PORT", "5432")
    name = os.getenv("POSTGRES_DB", "rab_mess")
    explicit = os.getenv("DATABASE_URL", "").strip()
    if host and password:
        return (
            f"postgresql+psycopg://{quote_plus(user)}:{quote_plus(password)}"
            f"@{host}:{port}/{name}"
        )
    if explicit:
        return explicit
    return "postgresql+psycopg://mess:mess@127.0.0.1:5433/rab_mess"


DATABASE_URL = resolve_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
