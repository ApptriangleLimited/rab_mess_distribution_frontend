from datetime import date
from unittest.mock import patch

from app.config import get_settings
from tests.test_p2_roster import _auth, _member_body
from tests.test_p3_cockpit import _create_approved


def test_eaters_normal_ms_only_vs_boro_khana(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    ms = _create_approved(client, daily, rab_id="RAB-5001", personal_id="p5001", name="Alpha")
    fr = _create_approved(client, daily, rab_id="RAB-5002", personal_id="p5002", name="Bravo", default_tag="FR")
    cl = _create_approved(client, daily, rab_id="RAB-5003", personal_id="p5003", name="Charlie", default_tag="CL")
    guest = client.post(
        "/api/v1/members",
        headers=daily,
        json=_member_body(
            name="Visitor",
            member_type="guest",
            rab_id="GST-5",
            personal_id="g5001",
            status="1",
            approval_status="approved",
        ),
    )
    assert guest.status_code == 201, guest.text

    for member, tag in ((ms, "MS"), (fr, "FR"), (cl, "CL")):
        painted = client.put(
            "/api/v1/assignments",
            headers=daily,
            json={"member_id": member["id"], "date": "2026-09-08", "tag": tag},
        )
        assert painted.status_code == 200, painted.text

    eaters = client.get("/api/v1/mess/eaters?date=2026-09-08", headers=daily)
    assert eaters.status_code == 200, eaters.text
    data = eaters.json()["data"]
    assert data["boro_khana"] is False
    assert data["total"] == 1
    assert data["items"][0]["id"] == ms["id"]
    assert data["items"][0]["mess_reason"] == "MS"
    assert data["items"][0]["assignment_id"].startswith("a_")

    boro = client.put("/api/v1/boro-khana/2026-09-08", headers=daily, json={"on": True})
    assert boro.status_code == 200, boro.text
    eaters_bk = client.get("/api/v1/mess/eaters?date=2026-09-08", headers=daily)
    assert eaters_bk.status_code == 200, eaters_bk.text
    bk = eaters_bk.json()["data"]
    assert bk["boro_khana"] is True
    by_id = {row["id"]: row for row in bk["items"]}
    assert guest.json()["data"]["id"] not in by_id
    assert by_id[ms["id"]]["mess_reason"] == "MS"
    assert by_id[fr["id"]]["mess_reason"] == "FR"
    assert by_id[cl["id"]]["mess_reason"] == "BK"
    assert by_id[cl["id"]]["assignment_id"].startswith("a_")
    assert bk["total"] == 3
    names = [row["name"] for row in bk["items"]]
    assert names == sorted(names)


def test_ledger_ms_cd_and_preview_future(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    member = _create_approved(
        client,
        daily,
        rab_id="RAB-5010",
        personal_id="p5010",
        default_tag="MS",
    )
    painted = client.put(
        "/api/v1/assignments",
        headers=daily,
        json={"member_id": member["id"], "date": "2026-09-08", "tag": "CD"},
    )
    assert painted.status_code == 200, painted.text
    bk = client.put("/api/v1/boro-khana/2026-09-15", headers=daily, json={"on": True})
    assert bk.status_code == 200, bk.text

    with patch("app.services.mess.today_dhaka", return_value=date(2026, 9, 8)):
        preview = client.get(
            "/api/v1/mess/ledger?from=2026-09-08&to=2026-09-20",
            headers=daily,
        )
    assert preview.status_code == 200, preview.text
    data = preview.json()["data"]
    assert data["tag_codes"] == ["MS", "CD"]
    assert data["dates"][0] == "2026-09-08"
    assert len(data["rows"]) == 1
    row = data["rows"][0]
    assert row["days"][0] == "CD"
    assert row["days"][-1] == "MS"
    assert row["tag_counts"]["CD"] == 1
    assert row["tag_counts"]["MS"] == len(data["dates"]) - 1
    assert data["boro_khana_days"] == [{"date": "2026-09-15", "eater_count": 1}]

    with patch("app.services.mess.today_dhaka", return_value=date(2026, 9, 8)):
        hidden = client.get(
            "/api/v1/mess/ledger?from=2026-09-08&to=2026-09-20&preview_future=false",
            headers=daily,
        )
    assert hidden.status_code == 200, hidden.text
    hid = hidden.json()["data"]
    assert hid["tag_codes"] == ["MS", "CD"]
    hid_row = hid["rows"][0]
    assert hid_row["days"][0] == "CD"
    assert all(cell == "" for cell in hid_row["days"][1:])
    assert hid_row["total_days"] == 1
    assert hid_row["tag_counts"] == {"CD": 1}


def test_cannot_delete_lunch_or_shift_in_use(client) -> None:
    mess = _auth(client, "mess@mess.rab")
    lunch = client.delete("/api/v1/meal-shifts/lunch", headers=mess)
    assert lunch.status_code == 409
    assert lunch.json()["code"] == "BUILTIN"

    tea = client.post(
        "/api/v1/meal-shifts",
        headers=mess,
        json={"name": "Tea", "start_time": "15:00", "end_time": "16:00", "description": ""},
    )
    assert tea.status_code == 201, tea.text
    tea_id = tea.json()["data"]["id"]
    plan = client.post(
        "/api/v1/meal-plans",
        headers=mess,
        json={"date": "2026-09-08", "meals": [{"shift_id": tea_id, "count": 12}, {"shift_id": "lunch", "count": 80}]},
    )
    assert plan.status_code == 201, plan.text
    still_builtin = client.delete("/api/v1/meal-shifts/lunch", headers=mess)
    assert still_builtin.status_code == 409
    assert still_builtin.json()["code"] == "BUILTIN"
    in_use = client.delete(f"/api/v1/meal-shifts/{tea_id}", headers=mess)
    assert in_use.status_code == 409
    assert in_use.json()["code"] == "IN_USE"


def test_ingest_first_unique_then_duplicate(client) -> None:
    daily = _auth(client, "daily@mess.rab")
    mess = _auth(client, "mess@mess.rab")
    member = _create_approved(client, daily, rab_id="RAB-5020", personal_id="p5020", rfid="ZK5020")
    first = client.post(
        "/api/v1/meal-assigns/ingest",
        headers=mess,
        json={
            "member_id": member["id"],
            "shift_id": "lunch",
            "date": "2026-09-08",
            "check_in_time": "2026-09-08T06:41:00Z",
        },
    )
    assert first.status_code == 201, first.text
    assert first.json()["data"]["status"] == 1
    first_id = first.json()["data"]["id"]

    again = client.post(
        "/api/v1/meal-assigns/ingest",
        headers=mess,
        json={
            "rfid": "ZK5020",
            "shift_id": "lunch",
            "date": "2026-09-08",
            "check_in_time": "2026-09-08T06:41:00Z",
        },
    )
    assert again.status_code == 201, again.text
    assert again.json()["data"]["id"] == first_id
    assert again.json()["data"]["status"] == 1

    second = client.post(
        "/api/v1/meal-assigns/ingest",
        headers=mess,
        json={
            "zk_user_id": "ZK5020",
            "shift_id": "lunch",
            "date": "2026-09-08",
            "check_in_time": "2026-09-08T06:50:00Z",
        },
    )
    assert second.status_code == 201, second.text
    assert second.json()["data"]["status"] == 2
    assert second.json()["data"]["id"] != first_id


def test_zk_demo_flag_and_no_device_ping(client) -> None:
    staff = _auth(client, "mess@mess.rab")
    settings = get_settings()
    settings.zk_demo = False
    off = client.get("/api/v1/zk/demo/status", headers=staff)
    assert off.status_code == 503
    assert off.json()["code"] == "ZK_UNAVAILABLE"

    settings.zk_demo = True
    on = client.get("/api/v1/zk/demo/status", headers=staff)
    assert on.status_code == 200, on.text
    data = on.json()["data"]
    assert data["reachable"] is False
    assert data["port"] == 4370
    users = client.get("/api/v1/zk/demo/users", headers=staff)
    assert users.status_code == 200
    attendance = client.get("/api/v1/zk/demo/attendance?from=2026-09-01&to=2026-09-08", headers=staff)
    assert attendance.status_code == 200
    assert attendance.json()["data"]["items"] == []
    settings.zk_demo = False
