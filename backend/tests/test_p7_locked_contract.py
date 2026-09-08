"""LOCKED clients in src/lib/api/*.ts — one hit each so USE_API=true does not drift."""

from app.config import get_settings
from tests.test_p2_roster import _auth, _member_body
from tests.test_p3_cockpit import _create_approved


def test_openapi_is_not_enveloped(client) -> None:
    res = client.get("/openapi.json")
    assert res.status_code == 200
    body = res.json()
    assert "ok" not in body
    assert body["openapi"].startswith("3.")
    assert "/api/v1/auth/login" in body["paths"]


def test_locked_auth_register_members(client) -> None:
    login = client.post("/api/v1/auth/login", json={"email": "cc@mess.rab", "password": "ChangeMe!"})
    assert login.status_code == 200
    data = login.json()["data"]
    assert set(data) >= {"access_token", "token_type", "expires_in", "staff"}
    assert set(data["staff"]) >= {"id", "email", "display_name", "role"}
    headers = {"Authorization": f"Bearer {data['access_token']}"}

    registered = client.post("/api/v1/public/register", json=_member_body(rab_id="RAB-7101", personal_id="p7101"))
    assert registered.status_code == 201
    pub = registered.json()["data"]
    assert set(pub) >= {"id", "name", "rab_id", "approval_status", "status"}

    created = client.post(
        "/api/v1/members",
        headers=headers,
        json=_member_body(rab_id="RAB-7102", personal_id="p7102", status="1", approval_status="approved"),
    )
    assert created.status_code == 201
    listed = client.get("/api/v1/members", headers=headers)
    assert listed.status_code == 200
    page = listed.json()["data"]
    assert {"items", "total", "page", "page_size"} <= set(page)

    out = client.post("/api/v1/auth/logout", headers=headers)
    assert out.status_code == 204


def test_locked_rates_and_senders(client) -> None:
    ration = _auth(client, "ration@mess.rab")
    rates = client.get("/api/v1/settings/rates", headers=ration)
    assert rates.status_code == 200
    items = rates.json()["data"]["items"]
    assert items
    assert {"tag", "amount_per_day", "is_builtin", "is_protected"} <= set(items[0])

    replaced = client.put(
        "/api/v1/settings/rates",
        headers=ration,
        json={"items": [{"tag": "MS", "amount_per_day": 180}]},
    )
    assert replaced.status_code == 200
    created = client.post(
        "/api/v1/settings/rates",
        headers=ration,
        json={"tag": "XX1", "amount_per_day": 1},
    )
    assert created.status_code == 201
    deleted = client.delete("/api/v1/settings/rates/XX1", headers=ration)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["tag"] == "XX1"

    senders = client.get("/api/v1/senders", headers=ration)
    assert senders.status_code == 200
    assert "items" in senders.json()["data"]
    row = client.post(
        "/api/v1/senders",
        headers=ration,
        json={
            "label": "Contract Pool",
            "bank_name": "Trust bank",
            "account_name": "Pool",
            "account_number": "1",
            "routing": "1",
            "mapped_tags": ["FR"],
            "active": True,
        },
    )
    assert row.status_code == 201
    sid = row.json()["data"]["id"]
    updated = client.put(
        f"/api/v1/senders/{sid}",
        headers=ration,
        json={**row.json()["data"], "label": "Contract Pool 2"},
    )
    assert updated.status_code == 200
    removed = client.delete(f"/api/v1/senders/{sid}", headers=ration)
    assert removed.status_code == 200


def test_locked_assignments_days_boro(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-7110", personal_id="p7110")
    painted = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "MS"},
    )
    assert painted.status_code == 200
    assert painted.json()["data"]["items"][0]["source"] == "stored"
    ranged = client.put(
        "/api/v1/assignments/range",
        headers=daily,
        json={"member_id": member["id"], "dates": ["2026-09-09"], "tag": "CL"},
    )
    assert ranged.status_code == 200
    listed = client.get("/api/v1/assignments?month=2026-09", headers=daily)
    assert listed.status_code == 200
    assert {"items", "from", "to"} <= set(listed.json()["data"])
    summary = client.get("/api/v1/assignments/summary?month=2026-09", headers=daily)
    assert summary.status_code == 200
    assert {"by_tag", "total_tagged_person_days", "member_count"} <= set(summary.json()["data"])
    cleared = client.delete(
        f"/api/v1/assignments?member_id={member['id']}&date=2026-09-10",
        headers=daily,
    )
    assert cleared.status_code == 200
    approved = client.post("/api/v1/days/2026-09-08/approve", headers=daily)
    assert approved.status_code == 200
    locks = client.get("/api/v1/days/locks?from=2026-09-01&to=2026-09-30", headers=daily)
    assert locks.status_code == 200
    assert "dates" in locks.json()["data"]
    bk = client.put("/api/v1/boro-khana/2026-09-15", headers=daily, json={"on": True})
    assert bk.status_code == 200
    dates = client.get("/api/v1/boro-khana?from=2026-09-01&to=2026-09-30", headers=daily)
    assert dates.status_code == 200
    assert "2026-09-15" in dates.json()["data"]["dates"]


def test_locked_mess_and_zk(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    eaters = client.get("/api/v1/mess/eaters?date=2026-09-08", headers=daily)
    assert eaters.status_code == 200
    assert {"date", "boro_khana", "items", "total"} <= set(eaters.json()["data"])
    ledger = client.get("/api/v1/mess/ledger?from=2026-09-01&to=2026-09-08", headers=daily)
    assert ledger.status_code == 200
    assert {"from", "to", "dates", "tag_codes", "rows"} <= set(ledger.json()["data"])

    settings = get_settings()
    settings.zk_demo = True
    try:
        status = client.get("/api/v1/zk/demo/status", headers=daily)
        assert status.status_code == 200
        assert {"reachable", "host", "port", "latency_ms"} <= set(status.json()["data"])
        users = client.get("/api/v1/zk/demo/users", headers=daily)
        assert users.status_code == 200
        assert "items" in users.json()["data"]
        att = client.get("/api/v1/zk/demo/attendance?from=2026-09-01&to=2026-09-08", headers=daily)
        assert att.status_code == 200
        assert "items" in att.json()["data"]
    finally:
        settings.zk_demo = False
