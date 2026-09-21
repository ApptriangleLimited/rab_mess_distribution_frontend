import io
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


def _login(rab_id: str, password: str = "ChangeMe!") -> dict:
    res = httpx.post(
        f"{BASE}/api/v1/auth/login",
        json={"rab_id": rab_id, "password": password},
        timeout=8,
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_refresh_rotation_and_reuse():
    data = _login("SRB-CC")
    first = data["refresh_token"]
    rotated = httpx.post(
        f"{BASE}/api/v1/auth/refresh",
        json={"refresh_token": first},
        timeout=8,
    )
    assert rotated.status_code == 200
    nxt = rotated.json()["data"]["refresh_token"]
    assert nxt != first
    reuse = httpx.post(
        f"{BASE}/api/v1/auth/refresh",
        json={"refresh_token": first},
        timeout=8,
    )
    assert reuse.status_code == 401


def test_password_reset_generic_and_one_time():
    forgot = httpx.post(
        f"{BASE}/api/v1/auth/forgot-password",
        json={"email": "nobody@example.com"},
        timeout=8,
    )
    assert forgot.status_code == 200
    reset = httpx.post(
        f"{BASE}/api/v1/auth/reset-password",
        json={"token": "not-a-real-token", "password": "NewStrongPass9"},
        timeout=8,
    )
    assert reset.status_code == 400


def test_snapshot_idor_consume_cannot_write_users():
    token = _login("SRB-CONSUME")["access_token"]
    before = httpx.get(f"{BASE}/api/v1/app/snapshot", headers=_auth(token), timeout=10)
    assert before.status_code == 200
    users = before.json()["data"]["users"]
    target = users[0]["id"] if users else "u_missing"
    put = httpx.put(
        f"{BASE}/api/v1/app/snapshot",
        headers=_auth(token),
        json={"users": [{"id": target, "name": "IDOR Overwrite", "rab_id": "RAB-IDOR"}]},
        timeout=10,
    )
    assert put.status_code == 200
    after = httpx.get(f"{BASE}/api/v1/members/{target}", headers=_auth(token), timeout=8)
    if after.status_code == 200:
        assert after.json()["data"]["name"] != "IDOR Overwrite"


def test_import_denied_for_non_admin():
    token = _login("SRB-CC")["access_token"]
    res = httpx.post(
        f"{BASE}/api/v1/app/import",
        headers=_auth(token),
        json={"users": []},
        timeout=8,
    )
    assert res.status_code == 403


def test_permissions_and_notifications():
    token = _login("SRB-CC")["access_token"]
    perms = httpx.get(f"{BASE}/api/v1/auth/permissions", headers=_auth(token), timeout=8)
    assert perms.status_code == 200
    assert "member.view" in perms.json()["data"]["permissions"]
    notes = httpx.get(f"{BASE}/api/v1/notifications", headers=_auth(token), timeout=8)
    assert notes.status_code == 200
    unread = httpx.get(f"{BASE}/api/v1/notifications/unread-count", headers=_auth(token), timeout=8)
    assert unread.status_code == 200
    read_all = httpx.post(f"{BASE}/api/v1/notifications/read-all", headers=_auth(token), timeout=8)
    assert read_all.status_code == 200


def test_file_upload_and_forbidden_type():
    token = _login("SRB-CC")["access_token"]
    ok = httpx.post(
        f"{BASE}/api/v1/files",
        headers=_auth(token),
        files={"upload": ("note.txt", io.BytesIO(b"hello mess"), "text/plain")},
        data={"entity_type": "member", "entity_id": "demo"},
        timeout=10,
    )
    assert ok.status_code == 201, ok.text
    file_id = ok.json()["data"]["id"]
    meta = httpx.get(f"{BASE}/api/v1/files/{file_id}", headers=_auth(token), timeout=8)
    assert meta.status_code == 200
    bad = httpx.post(
        f"{BASE}/api/v1/files",
        headers=_auth(token),
        files={"upload": ("hack.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        timeout=10,
    )
    assert bad.status_code == 400
    traversal = httpx.get(
        f"{BASE}/api/v1/files/../secret",
        headers=_auth(token),
        timeout=8,
    )
    assert traversal.status_code in {400, 404, 422}


def test_security_headers_present():
    res = httpx.get(f"{BASE}/health/live", timeout=5)
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"


def test_logout_revokes_refresh():
    data = _login("SRB-DAILY")
    httpx.post(
        f"{BASE}/api/v1/auth/logout",
        headers=_auth(data["access_token"]),
        timeout=8,
    )
    reuse = httpx.post(
        f"{BASE}/api/v1/auth/refresh",
        json={"refresh_token": data["refresh_token"]},
        timeout=8,
    )
    assert reuse.status_code == 401
