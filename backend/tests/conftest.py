import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.db import reset_engine
from app.main import app
from app.models import Base
from app.redis_client import set_redis
from tests.fakes import FakeRedis


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    reset_engine(engine)
    Base.metadata.create_all(engine)
    set_redis(FakeRedis())
    with TestClient(app) as test_client:
        yield test_client
    reset_engine(None)
    set_redis(None)
