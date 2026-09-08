from datetime import date

from app.jobs.jl import run_jl_inactivate
from tests.test_p2_roster import _auth, _member_body
from tests.test_p3_cockpit import _create_approved


def test_duty_replace_pending_and_queue_mismatch(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-4001", personal_id="p4001")
    first = client.post(
        "/api/v1/tag-requests/duty",
        headers=daily,
        json={
            "user_id": member["id"],
            "to_tag": "FR",
            "from_date": "2026-09-08",
            "to_date": "2026-09-10",
            "queue": "ration",
        },
    )
    assert first.status_code == 201, first.text
    first_id = first.json()["data"]["id"]
    second = client.post(
        "/api/v1/tag-requests/duty",
        headers=daily,
        json={
            "user_id": member["id"],
            "to_tag": "CD",
            "from_date": "2026-09-08",
            "to_date": "2026-09-12",
            "queue": "ration",
        },
    )
    assert second.status_code == 201, second.text
    assert second.json()["data"]["id"] == first_id
    assert second.json()["data"]["to_tag"] == "CD"
    assert second.json()["data"]["to_date"] == "2026-09-12"
    counts = client.get("/api/v1/tag-requests/counts", headers=daily)
    assert counts.json()["data"]["ration"] == 1

    bad = client.post(
        "/api/v1/tag-requests/duty",
        headers=daily,
        json={
            "user_id": member["id"],
            "to_tag": "FR",
            "from_date": "2026-09-08",
            "to_date": "2026-09-08",
            "queue": "consume",
        },
    )
    assert bad.status_code == 400
    assert bad.json()["code"] == "VALIDATION_ERROR"


def test_double_apply_one_updated_one_not_pending(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    consume = _auth(client, "consume@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-4002", personal_id="p4002")
    created = client.post(
        "/api/v1/tag-requests/duty",
        headers=daily,
        json={
            "user_id": member["id"],
            "to_tag": "CL",
            "from_date": "2026-09-08",
            "to_date": "2026-09-09",
            "queue": "consume",
        },
    )
    assert created.status_code == 201, created.text
    rid = created.json()["data"]["id"]
    first = client.post(f"/api/v1/tag-requests/{rid}/apply", headers=consume)
    assert first.status_code == 200, first.text
    assert first.json()["data"]["request"]["status"] == "updated"
    assert first.json()["data"]["updated"] == 2
    assert all(c["tag"] == "CL" for c in first.json()["data"]["items"])

    second = client.post(f"/api/v1/tag-requests/{rid}/apply", headers=consume)
    assert second.status_code == 409
    assert second.json()["code"] == "NOT_PENDING"


def test_cc_daily_request_apply(client) -> None:
    cc = _auth(client)
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-4003", personal_id="p4003")
    created = client.post(
        "/api/v1/tag-requests",
        headers=cc,
        json={
            "user_id": member["id"],
            "to_tag": "CL",
            "from_date": "2026-09-08",
            "to_date": "2026-09-08",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["data"]["queue"] == "daily"
    applied = client.post(
        f"/api/v1/tag-requests/{created.json()['data']['id']}/apply",
        headers=daily,
    )
    assert applied.status_code == 200, applied.text
    cells = client.get(
        f"/api/v1/assignments?date=2026-09-08&member_id={member['id']}",
        headers=daily,
    )
    assert cells.json()["data"]["items"][0]["tag"] == "CL"


def test_state_report_frozen_after_submit(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    admin = _auth(client, "admin@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-4004", personal_id="p4004")
    client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "MS"},
    )
    draft = client.get("/api/v1/state-reports/draft?date=2026-09-08", headers=daily)
    assert draft.status_code == 200, draft.text
    live = draft.json()["data"]
    assert live["totals"]["active"] == 1
    assert live["totals"]["by_tag"]["MS"] == 1
    assert live["totals"]["mess_eaters"] == 1
    assert live["members"][0]["tag"] == "MS"

    submitted = client.post("/api/v1/state-reports", headers=daily, json={"date": "2026-09-08"})
    assert submitted.status_code == 201, submitted.text
    report_id = submitted.json()["data"]["id"]
    assert submitted.json()["data"]["status"] == "pending"
    assert submitted.json()["data"]["totals"]["by_tag"]["MS"] == 1

    client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CL"},
    )
    stored = client.get(f"/api/v1/state-reports/{report_id}", headers=daily)
    assert stored.json()["data"]["members"][0]["tag"] == "MS"
    assert stored.json()["data"]["totals"]["by_tag"]["MS"] == 1

    approved = client.post(f"/api/v1/state-reports/{report_id}/approve", headers=admin)
    assert approved.status_code == 200
    assert approved.json()["data"]["status"] == "approved"
    again = client.post(f"/api/v1/state-reports/{report_id}/approve", headers=admin)
    assert again.status_code == 409
    assert again.json()["code"] == "NOT_PENDING"


def test_jl_job_inactivates_after_last_jl(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-4005", personal_id="p4005")
    painted = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "JL"},
    )
    assert painted.status_code == 200, painted.text
    before = client.get(f"/api/v1/members/{member['id']}", headers=daily)
    assert before.json()["data"]["status"] == "1"
    assert before.json()["data"]["jl_end_date"] == "2026-09-08"

    flipped = run_jl_inactivate(as_of=date(2026, 9, 9))
    assert flipped >= 1
    after = client.get(f"/api/v1/members/{member['id']}", headers=daily)
    assert after.json()["data"]["status"] == "0"
