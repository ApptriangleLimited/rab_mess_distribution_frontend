from app.constants import CACHE_CATALOG_KEY
from app.redis_client import get_redis


def _login(client, email: str = "cc@mess.rab", password: str = "ChangeMe!"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _auth(client, email: str = "cc@mess.rab") -> dict:
    token = _login(client, email).json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _member_body(**overrides) -> dict:
    body = {
        "name": "Md. Rahim",
        "rab_id": "RAB-10421",
        "personal_id": "1985123456789",
        "rfid": "AABBCC",
        "rank": "ASI",
        "wing": "Ops Wg",
        "force": "Army",
        "member_type": "permanent",
        "dropdown_no": "",
        "phone": "+8801712345678",
        "blood_group": "B+",
        "bank_name": "Trust bank",
        "account_name": "Md. Rahim",
        "account_number": "110-200-300",
        "routing": "020260025",
        "branch": "Gulshan",
        "branch_location": "Dhaka",
        "joining_date": "2024-01-15",
        "out_date": None,
        "default_tag": "MS",
        "documents": [{"name": "nid.pdf", "size": 120440, "url": None}],
        "emergency_contacts": [{"name": "Karim", "relation": "Brother", "phone": "01711111111"}],
    }
    body.update(overrides)
    return body


def test_public_register_forces_pending_inactive(client) -> None:
    res = client.post(
        "/api/v1/public/register",
        json=_member_body(status="1", approval_status="approved"),
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["approval_status"] == "pending"
    assert data["status"] == "0"
    assert data["rab_id"] == "RAB-10421"
    assert data["name"] == "Md. Rahim"
    assert data["id"].startswith("u_")


def test_duplicate_rab_id_conflict(client) -> None:
    first = client.post("/api/v1/public/register", json=_member_body())
    assert first.status_code == 201, first.text
    again = client.post(
        "/api/v1/public/register",
        json=_member_body(personal_id="1999000111222", name="Other"),
    )
    assert again.status_code == 409
    body = again.json()
    assert body["code"] == "CONFLICT"
    fields = [e["field"] for e in body["errors"]]
    assert "rab_id" in fields


def test_list_filters(client) -> None:
    headers = _auth(client)
    client.post(
        "/api/v1/members",
        headers=headers,
        json=_member_body(
            rab_id="RAB-1",
            personal_id="p1",
            status="1",
            approval_status="accepted",
            wing="Ops Wg",
            rank="ASI",
            joining_date="2024-01-15",
        ),
    )
    client.post(
        "/api/v1/members",
        headers=headers,
        json=_member_body(
            rab_id="RAB-2",
            personal_id="p2",
            name="Other Person",
            status="0",
            approval_status="pending",
            wing="Int Wg",
            rank="DAD",
            joining_date="2025-06-01",
        ),
    )

    by_q = client.get("/api/v1/members?q=Rahim", headers=headers)
    assert by_q.status_code == 200
    assert by_q.json()["data"]["total"] == 1
    assert by_q.json()["data"]["items"][0]["name"] == "Md. Rahim"
    assert by_q.json()["data"]["items"][0]["phone"] == "01712345678"
    assert by_q.json()["data"]["items"][0]["account_number"] == "110200300"

    by_status = client.get("/api/v1/members?status=0", headers=headers)
    assert by_status.json()["data"]["total"] == 1
    assert by_status.json()["data"]["items"][0]["rab_id"] == "RAB-2"

    by_approval = client.get("/api/v1/members?approval=approved", headers=headers)
    assert by_approval.json()["data"]["total"] == 1
    assert by_approval.json()["data"]["items"][0]["approval_status"] == "approved"

    by_wing = client.get("/api/v1/members?wing=Int Wg", headers=headers)
    assert by_wing.json()["data"]["total"] == 1

    by_rank = client.get("/api/v1/members?rank=ASI", headers=headers)
    assert by_rank.json()["data"]["total"] == 1

    by_date = client.get("/api/v1/members?date_from=2025-06-01&date_to=2025-06-01", headers=headers)
    assert by_date.json()["data"]["total"] == 1
    assert by_date.json()["data"]["items"][0]["rab_id"] == "RAB-2"

    page = client.get("/api/v1/members?page=1&page_size=10", headers=headers)
    assert page.json()["data"]["page"] == 1
    assert page.json()["data"]["page_size"] == 10
    assert page.json()["data"]["total"] == 2


def test_put_rates_keeps_fuel_clfr(client) -> None:
    headers = _auth(client, "ration@mess.rab")
    before = client.get("/api/v1/settings/rates", headers=headers)
    assert before.status_code == 200
    tags = {r["tag"] for r in before.json()["data"]["items"]}
    assert {"FUEL", "CLFR", "MS"} <= tags

    res = client.put(
        "/api/v1/settings/rates",
        headers=headers,
        json={"items": [{"tag": "MS", "amount_per_day": 200}]},
    )
    assert res.status_code == 200, res.text
    items = {r["tag"]: r for r in res.json()["data"]["items"]}
    assert items["MS"]["amount_per_day"] == 200.0
    assert "FUEL" in items
    assert "CLFR" in items
    assert items["FUEL"]["amount_per_day"] == 50.0
    assert items["CLFR"]["amount_per_day"] == 2500.0
    assert items["MS"]["is_builtin"] is True
    assert items["FUEL"]["is_protected"] is True


def test_delete_protected_rate(client) -> None:
    headers = _auth(client, "ration@mess.rab")
    res = client.delete("/api/v1/settings/rates/MS", headers=headers)
    assert res.status_code == 409
    assert res.json()["code"] == "PROTECTED_RATE"
    fuel = client.delete("/api/v1/settings/rates/CLFR", headers=headers)
    assert fuel.status_code == 409
    assert fuel.json()["code"] == "PROTECTED_RATE"


def test_catalog_rank_add_busts_cache(client) -> None:
    headers = _auth(client, "ration@mess.rab")
    first = client.get("/api/v1/settings/catalog", headers=headers)
    assert first.status_code == 200, first.text
    assert "ASI" in first.json()["data"]["ranks"]
    assert "Trust bank" in first.json()["data"]["member_banks"]
    redis = get_redis()
    assert redis.get(CACHE_CATALOG_KEY)

    added = client.post(
        "/api/v1/settings/ranks",
        headers=headers,
        json={"label": "ExtraRank", "elaborate": "Extra"},
    )
    assert added.status_code == 201, added.text
    assert redis.get(CACHE_CATALOG_KEY) is None

    again = client.get("/api/v1/settings/catalog", headers=headers)
    assert "ExtraRank" in again.json()["data"]["ranks"]
    assert redis.get(CACHE_CATALOG_KEY)


def test_senders_crud(client) -> None:
    headers = _auth(client, "ration@mess.rab")
    listed = client.get("/api/v1/senders", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["data"]["items"]) >= 2

    created = client.post(
        "/api/v1/senders",
        headers=headers,
        json={
            "label": "Ops Pool",
            "bank_name": "Sonali Bank",
            "account_name": "RAB Ops",
            "account_number": "11-22",
            "routing": "99-00",
            "branch": "HQ",
            "branch_location": "Dhaka",
            "mapped_tags": ["cd", "trg"],
            "active": True,
        },
    )
    assert created.status_code == 201, created.text
    row = created.json()["data"]
    assert row["account_number"] == "1122"
    assert row["mapped_tags"] == ["CD", "TRG"]

    updated = client.put(
        f"/api/v1/senders/{row['id']}",
        headers=headers,
        json={**row, "label": "Ops Pool 2", "mapped_tags": ["CD"]},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["label"] == "Ops Pool 2"

    deleted = client.delete(f"/api/v1/senders/{row['id']}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["id"] == row["id"]


def test_civilian_and_guest(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    civ = client.post(
        "/api/v1/members",
        headers=headers,
        json=_member_body(
            member_type="civilian",
            rab_id="",
            dropdown_no="CARD-9",
            personal_id="1234567890",
            status="1",
            approval_status="approved",
        ),
    )
    assert civ.status_code == 201, civ.text
    assert civ.json()["data"]["rab_id"] == "CIV-CARD-9"
    assert civ.json()["data"]["approval_status"] == "approved"
    assert civ.json()["data"]["status"] == "1"

    guest = client.post(
        "/api/v1/members",
        headers=headers,
        json={
            "name": "Visitor",
            "member_type": "guest",
            "bank_name": "Trust bank",
            "rank": "ASI",
            "documents": [{"name": "x.pdf", "size": 1}],
        },
    )
    assert guest.status_code == 201, guest.text
    data = guest.json()["data"]
    assert data["rank"] == ""
    assert data["documents"] == []
    assert data["bank_name"] == ""
    assert data["rab_id"]


def test_get_put_member(client) -> None:
    headers = _auth(client)
    created = client.post("/api/v1/members", headers=headers, json=_member_body())
    member_id = created.json()["data"]["id"]
    got = client.get(f"/api/v1/members/{member_id}", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["inactive_spans"] == []
    assert got.json()["data"]["jl_end_date"] == ""

    body = _member_body(status="0", name="Md. Rahim Updated")
    put = client.put(f"/api/v1/members/{member_id}", headers=headers, json=body)
    assert put.status_code == 200, put.text
    assert put.json()["data"]["status"] == "0"
    assert put.json()["data"]["name"] == "Md. Rahim Updated"
    assert put.json()["data"]["inactive_spans"]
    assert put.json()["data"]["inactive_spans"][0]["to"] is None


def test_mess_cannot_write_members(client) -> None:
    headers = _auth(client, "mess@mess.rab")
    res = client.post("/api/v1/members", headers=headers, json=_member_body())
    assert res.status_code == 403
    assert res.json()["code"] == "FORBIDDEN"
