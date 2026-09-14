import os

import httpx
import pytest

BASE = os.getenv("API_LIVE_URL", "http://127.0.0.1:8000")


def _live() -> bool:
    try:
        httpx.get(f"{BASE}/health/live", timeout=1.5)
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _live(), reason="API not running")


def test_ready_and_login():
    live = httpx.get(f"{BASE}/health/live", timeout=5)
    assert live.status_code == 200
    ready = httpx.get(f"{BASE}/health/ready", timeout=5)
    assert ready.status_code == 200
    login = httpx.post(
        f"{BASE}/api/v1/auth/login",
        json={"email": "cc@mess.rab", "password": "ChangeMe!"},
        timeout=5,
    )
    assert login.status_code == 200
    body = login.json()
    assert body["ok"] is True
    token = body["data"]["access_token"]
    me = httpx.get(
        f"{BASE}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert me.status_code == 200
    assert me.json()["data"]["role"] == "cc"
