from tests.test_p2_roster import _auth, _member_body
from tests.test_p3_cockpit import _create_approved


def _paint(client, headers, member_id: str, date: str, tag: str):
    res = client.put(
        "/api/v1/assignments",
        headers=headers,
        json={"member_id": member_id, "date": date, "tag": tag},
    )
    assert res.status_code == 200, res.text
    return res


def test_fr_bill_adds_fuel_per_day(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    consume = _auth(client, "consume@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-6001", personal_id="p6001")
    for day in range(1, 11):
        _paint(client, daily, member["id"], f"2026-09-{day:02d}", "FR")

    bill = client.get("/api/v1/reports/consume/2026-09/tag/FR", headers=consume)
    assert bill.status_code == 200, bill.text
    data = bill.json()["data"]
    assert data["rate"] == 220.0
    assert data["fuel_rate"] == 50.0
    assert data["total_days"] == 10
    assert data["total_amount"] == 2200.0
    assert data["total_fuel"] == 500.0
    assert data["grand_total"] == 2700.0
    assert data["rows"][0]["grand_total"] == 2700.0


def test_clfr_is_monthly_not_times_cl_days(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    ration = _auth(client, "ration@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-6002", personal_id="p6002")
    for day in range(1, 6):
        _paint(client, daily, member["id"], f"2026-09-{day:02d}", "MS")
    for day in range(6, 9):
        _paint(client, daily, member["id"], f"2026-09-{day:02d}", "CL")

    closed = client.post("/api/v1/months/2026-09/close", headers=ration)
    assert closed.status_code == 200, closed.text
    report = client.get("/api/v1/reports/ration/2026-09", headers=ration)
    assert report.status_code == 200, report.text
    data = report.json()["data"]
    cl_lines = [line for line in data["unmapped"] if line["tag"] == "CL"]
    assert len(cl_lines) == 1
    assert cl_lines[0]["days"] == 3
    assert cl_lines[0]["rate"] == 2500.0
    assert cl_lines[0]["amount"] == 2500.0
    assert cl_lines[0]["amount"] != 2500.0 * 3


def test_closed_month_blocks_write_until_reopen(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    ration = _auth(client, "ration@mess.rab")
    admin = _auth(client, "admin@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-6003", personal_id="p6003")
    _paint(client, daily, member["id"], "2026-09-01", "MS")

    closed = client.post("/api/v1/months/2026-09/close", headers=ration)
    assert closed.status_code == 200, closed.text
    blocked = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-02", "tag": "CL"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "MONTH_CLOSED"

    ration_open = client.get("/api/v1/reports/ration/2026-08", headers=ration)
    assert ration_open.status_code == 409
    assert ration_open.json()["code"] == "MONTH_OPEN"

    reopened = client.post("/api/v1/months/2026-09/reopen", headers=admin)
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["data"]["closed"] is False
    again = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-02", "tag": "CL"},
    )
    assert again.status_code == 200, again.text


def test_manpower_excludes_guests(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(
        client,
        daily,
        rab_id="RAB-6004",
        personal_id="p6004",
        rank="ASI",
        wing="Ops Wg",
        name="Staff One",
    )
    guest = client.post(
        "/api/v1/members",
        headers=daily,
        json=_member_body(
            name="Visitor",
            member_type="guest",
            rab_id="GST-6",
            personal_id="g6004",
            rank="ASI",
            wing="Ops Wg",
            status="1",
            approval_status="approved",
        ),
    )
    assert guest.status_code == 201, guest.text
    _paint(client, daily, member["id"], "2026-09-08", "MS")

    report = client.get("/api/v1/reports/manpower?date=2026-09-08", headers=daily)
    assert report.status_code == 200, report.text
    data = report.json()["data"]
    assert data["hq"]["held"].get("auth_asi", 0) == 1
    ops = next(w for w in data["wings"] if w["wing"] == "Ops Wg")
    assert ops["held"].get("auth_asi", 0) == 1


def test_pritibhoj_and_civilian_documents(client) -> None:
    mess = _auth(client, "mess@mess.rab")
    daily = _auth(client, "daily@mess.rab")
    created = client.post(
        "/api/v1/pritibhoj",
        headers=mess,
        json={
            "title": "Eid feast",
            "occasion": "Eid-ul-Fitr",
            "date": "2026-03-31",
            "org": "RAB HQ",
            "main_rows": [{"wing": "অপারেশনস্ উইং", "dad": 4, "azadHall": 1, "others": 10, "civilian": 2}],
            "admin_rows": [],
        },
    )
    assert created.status_code == 201, created.text
    event = created.json()["data"]
    ops = event["main_rows"][0]
    assert ops["distribution"] == 3
    assert ops["total"] == 12
    assert ops["totalDistribution"] == ops["distribution"] + ops["distribution2"]

    civilian = _create_approved(
        client,
        daily,
        rab_id="CIV-NID-1999000111222",
        personal_id="1999000111222",
        member_type="civilian",
        dropdown_no="CARD-6006",
        name="Civ One",
    )
    upload = client.post(
        f"/api/v1/members/{civilian['id']}/documents",
        headers=daily,
        files={"file": ("nid.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert upload.status_code == 201, upload.text
    doc_id = upload.json()["data"]["id"]
    verified = client.patch(
        f"/api/v1/members/{civilian['id']}/documents/verify",
        headers=daily,
        json={"documents_verified": True},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["data"]["documents_verified"] is True

    staff = _create_approved(client, daily, rab_id="RAB-6005", personal_id="p6005")
    bad = client.patch(
        f"/api/v1/members/{staff['id']}/documents/verify",
        headers=daily,
        json={"documents_verified": True},
    )
    assert bad.status_code == 400

    removed = client.delete(f"/api/v1/members/{civilian['id']}/documents/{doc_id}", headers=daily)
    assert removed.status_code == 200
    assert removed.json()["data"]["id"] == doc_id
