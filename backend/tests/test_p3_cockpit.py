import threading

from tests.test_p2_roster import _auth, _member_body


def _create_approved(client, headers, **overrides) -> dict:
    body = _member_body(status="1", approval_status="approved")
    body.update(overrides)
    res = client.post("/api/v1/members", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def test_projection_sources_and_excludes_guest(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    member = _create_approved(
        client,
        headers,
        rab_id="RAB-3001",
        personal_id="p3001",
        joining_date="2026-09-05",
        default_tag="MS",
    )
    guest = client.post(
        "/api/v1/members",
        headers=headers,
        json=_member_body(
            name="Visitor",
            member_type="guest",
            rab_id="GST-1",
            status="1",
            approval_status="approved",
        ),
    )
    assert guest.status_code == 201, guest.text

    painted = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
    )
    assert painted.status_code == 200, painted.text
    assert painted.json()["data"]["items"][0]["source"] == "stored"
    assert painted.json()["data"]["items"][0]["tag"] == "CL"

    cleared = client.delete(
        f"/api/v1/assignments?member_id={member['id']}&date=2026-09-09",
        headers=headers,
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["data"]["items"][0]["source"] == "suppressed"

    month = client.get("/api/v1/assignments?month=2026-09", headers=headers)
    assert month.status_code == 200, month.text
    items = month.json()["data"]["items"]
    ids = {c["member_id"] for c in items}
    assert guest.json()["data"]["id"] not in ids
    by_date = {c["date"]: c for c in items if c["member_id"] == member["id"]}
    assert by_date["2026-09-01"]["source"] == "empty"
    assert by_date["2026-09-01"]["tag"] is None
    assert by_date["2026-09-08"]["source"] == "stored"
    assert by_date["2026-09-08"]["tag"] == "CL"
    assert by_date["2026-09-09"]["source"] == "suppressed"
    assert by_date["2026-09-09"]["tag"] is None
    assert by_date["2026-09-10"]["source"] == "carry"
    assert by_date["2026-09-10"]["tag"] == "MS"

    summary = client.get("/api/v1/assignments/summary?month=2026-09", headers=headers)
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["by_tag"]["CL"] == 1
    assert data["by_tag"]["MS"] >= 1
    assert data["member_count"] == 1


def test_mfr_locked_rejects_cl(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    member = _create_approved(
        client,
        headers,
        rab_id="RAB-3002",
        personal_id="p3002",
        default_tag="MFR",
    )
    res = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "MFR_LOCKED"

    fr = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "FR"},
    )
    assert fr.status_code == 200, fr.text
    got = client.get(f"/api/v1/members/{member['id']}", headers=headers)
    assert got.json()["data"]["default_tag"] == "FR"


def test_inactive_and_before_join(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    future = _create_approved(
        client,
        headers,
        rab_id="RAB-3003",
        personal_id="p3003",
        joining_date="2026-12-01",
    )
    before = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": future["id"], "date": "2026-09-08", "tag": "MS"},
    )
    assert before.status_code == 409
    assert before.json()["code"] == "INACTIVE_DATE"

    inactive = _create_approved(
        client,
        headers,
        rab_id="RAB-3004",
        personal_id="p3004",
        status="0",
    )
    res = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": inactive["id"], "date": "2026-09-08", "tag": "MS"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "INACTIVE_DATE"


def test_approve_day_idempotent_and_locks(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    member = _create_approved(client, headers, rab_id="RAB-3005", personal_id="p3005")
    first = client.post("/api/v1/days/2026-09-08/approve", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["data"]["locked"] is True
    assert first.json()["data"]["filled"] >= 1

    second = client.post("/api/v1/days/2026-09-08/approve", headers=headers)
    assert second.status_code == 200
    assert second.json()["data"] == {"date": "2026-09-08", "filled": 0, "locked": True}

    locks = client.get("/api/v1/days/locks?from=2026-09-01&to=2026-09-30", headers=headers)
    assert "2026-09-08" in locks.json()["data"]["dates"]

    painted = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
    )
    assert painted.status_code == 200
    locks_after = client.get("/api/v1/days/locks?from=2026-09-01&to=2026-09-30", headers=headers)
    assert "2026-09-08" not in locks_after.json()["data"]["dates"]


def test_boro_khana_toggle(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    on = client.put("/api/v1/boro-khana/2026-09-15", headers=headers, json={"on": True})
    assert on.status_code == 200
    assert on.json()["data"] == {"date": "2026-09-15", "on": True}
    listed = client.get("/api/v1/boro-khana?from=2026-09-01&to=2026-09-30", headers=headers)
    assert "2026-09-15" in listed.json()["data"]["dates"]
    off = client.put("/api/v1/boro-khana/2026-09-15", headers=headers, json={"on": False})
    assert off.json()["data"]["on"] is False


def test_range_skips_unassignable(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    member = _create_approved(
        client,
        headers,
        rab_id="RAB-3006",
        personal_id="p3006",
        joining_date="2026-09-08",
    )
    res = client.put(
        "/api/v1/assignments/range",
        headers=headers,
        json={
            "member_id": member["id"],
            "dates": ["2026-09-01", "2026-09-08", "2026-09-09"],
            "tag": "TRG",
            "trg_tone": "black",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["updated"] == 2
    assert all(c["tag"] == "TRG" for c in data["items"])
    assert data["items"][0]["trg_tone"] == "black"


def test_member_lifecycle(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    pending = client.post(
        "/api/v1/members",
        headers=_auth(client),
        json=_member_body(rab_id="RAB-3007", personal_id="p3007", approval_status="pending"),
    )
    member_id = pending.json()["data"]["id"]
    approved = client.post(
        f"/api/v1/members/{member_id}/approve",
        headers=headers,
        json={"default_tag": "MS", "today_tag": "MS"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["data"]["member"]["approval_status"] == "approved"
    assert approved.json()["data"]["member"]["status"] == "1"
    assert approved.json()["data"]["assignment"]["tag"] == "MS"

    queued = client.post(
        f"/api/v1/members/{member_id}/approve",
        headers=headers,
        json={"today_tag": "CL"},
    )
    assert queued.status_code == 200, queued.text
    assert queued.json()["data"]["tag_request"]["queue"] == "consume"
    assert queued.json()["data"]["tag_request"]["to_tag"] == "CL"

    rejected = client.post(
        f"/api/v1/members/{member_id}/reject",
        headers=headers,
    )
    assert rejected.json()["data"]["approval_status"] == "rejected"

    ended = client.post(f"/api/v1/members/{member_id}/end", headers=headers)
    assert ended.json()["data"]["approval_status"] == "ended"
    assert ended.json()["data"]["status"] == "0"

    bank = client.patch(
        f"/api/v1/members/{member_id}/bank",
        headers=_auth(client, "ration@mess.rab"),
        json={
            "bank_name": "sonali bank",
            "account_name": "Rahim",
            "account_number": "11-22",
            "routing": "33-44",
            "branch": "HQ",
            "branch_location": "Dhaka",
        },
    )
    assert bank.status_code == 200, bank.text
    assert bank.json()["data"]["bank_name"] == "Sonali Bank"
    assert bank.json()["data"]["account_number"] == "1122"


def test_approve_and_paint_same_date_final_state_valid(client) -> None:
    headers = _auth(client, "daily@mess.rab")
    member = _create_approved(client, headers, rab_id="RAB-3099", personal_id="p3099")

    def approve() -> None:
        try:
            client.post("/api/v1/days/2026-09-08/approve", headers=headers)
        except Exception:
            return

    def paint() -> None:
        try:
            client.put(
                "/api/v1/assignments",
                headers=headers,
                json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
            )
        except Exception:
            return

    t1 = threading.Thread(target=approve)
    t2 = threading.Thread(target=paint)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    cells = client.get(
        f"/api/v1/assignments?date=2026-09-08&member_id={member['id']}",
        headers=headers,
    ).json()["data"]["items"]
    assert len(cells) == 1
    cell = cells[0]
    locks = client.get(
        "/api/v1/days/locks?from=2026-09-08&to=2026-09-08",
        headers=headers,
    ).json()["data"]["dates"]
    locked = "2026-09-08" in locks
    if locked:
        assert cell["tag"] in {"MS", "CL"}
        assert cell["source"] in {"stored", "carry"}
        return
    if cell["source"] == "stored":
        assert cell["tag"] == "CL"
        return
    repaired = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
    )
    assert repaired.status_code == 200, repaired.text
    assert repaired.json()["data"]["items"][0]["tag"] == "CL"
