from pathlib import Path

from app.config import get_settings
from app.services.backup import dump_sql, restore_sql
from app.services.qr_token import mint_register_token
from tests.test_p2_roster import _auth, _member_body
from tests.test_p3_cockpit import _create_approved


def test_last_admin_cannot_deactivate_self(client) -> None:
    admin = _auth(client, "admin@mess.rab")
    blocked = client.patch(
        "/api/v1/staff/st_admin",
        headers=admin,
        json={"active": False},
    )
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "LAST_ADMIN"

    created = client.post(
        "/api/v1/staff",
        headers=admin,
        json={
            "email": "admin2@mess.rab",
            "password": "ChangeMe!",
            "display_name": "Admin 2",
            "role": "admin",
        },
    )
    assert created.status_code == 201, created.text
    other_id = created.json()["data"]["id"]
    ok = client.patch(f"/api/v1/staff/{other_id}", headers=admin, json={"active": False})
    assert ok.status_code == 200, ok.text
    assert ok.json()["data"]["active"] is False


def test_register_qr_mint_and_staff_list(client) -> None:
    admin = _auth(client, "admin@mess.rab")
    minted = client.get("/api/v1/settings/register-qr", headers=admin)
    assert minted.status_code == 200, minted.text
    data = minted.json()["data"]
    assert {"token", "expires_at", "url", "ttl_seconds"} <= set(data)
    assert data["url"].startswith("/register?token=")
    listed = client.get("/api/v1/staff", headers=admin)
    assert listed.status_code == 200
    emails = {row["email"] for row in listed.json()["data"]["items"]}
    assert "admin@mess.rab" in emails


def test_register_token_optional_or_required(client) -> None:
    body = _member_body(rab_id="RAB-7001", personal_id="p7001")
    open_reg = client.post("/api/v1/public/register", json=body)
    assert open_reg.status_code == 201, open_reg.text

    settings = get_settings()
    settings.register_token_required = True
    try:
        denied = client.post(
            "/api/v1/public/register",
            json=_member_body(rab_id="RAB-7002", personal_id="p7002"),
        )
        assert denied.status_code == 403
        assert denied.json()["code"] == "QR_TOKEN_REQUIRED"
        token = mint_register_token()["token"]
        allowed = client.post(
            f"/api/v1/public/register?token={token}",
            json=_member_body(rab_id="RAB-7003", personal_id="p7003"),
        )
        assert allowed.status_code == 201, allowed.text
    finally:
        settings.register_token_required = False


def test_restore_dump_keeps_login_member_assignment(client, tmp_path: Path) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-7010", personal_id="p7010")
    painted = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "MS"},
    )
    assert painted.status_code == 200, painted.text

    dump = tmp_path / "mess.sql"
    dump_sql(dump)
    restore_sql(dump)

    login = client.post("/api/v1/auth/login", json={"email": "daily@mess.rab", "password": "ChangeMe!"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    got = client.get(f"/api/v1/members/{member['id']}", headers=headers)
    assert got.status_code == 200, got.text
    assert got.json()["data"]["rab_id"] == "RAB-7010"
    cells = client.get(f"/api/v1/assignments?date=2026-09-08&member_id={member['id']}", headers=headers)
    assert cells.status_code == 200, cells.text
    stored = [c for c in cells.json()["data"]["items"] if c["source"] == "stored"]
    assert stored
    assert stored[0]["tag"] == "MS"
