"""Hazz Camp ADMS terminal. Punches and card commands stay off the main device."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path

from config import settings
from zk_gate import (
    _build_rows,
    _today_maps,
    access_authorize_command,
    access_delete_command,
    access_user_command,
    card_on_device,
    machine_pin,
    mess_today,
)

HAZZ_PUNCH_PATH = Path(
    os.environ.get("HAZZ_PUNCH_PATH", "/var/lib/rab-mess/files/hazz_punches.json")
)
HAZZ_CMD_PATH = Path(
    os.environ.get("HAZZ_CMD_PATH", "/var/lib/rab-mess/files/hazz_cmds.json")
)
HAZZ_SEEN_PATH = Path(
    os.environ.get("HAZZ_SEEN_PATH", "/var/lib/rab-mess/files/hazz_adms.json")
)
HAZZ_SEED_PATH = Path(
    os.environ.get("HAZZ_SEED_PATH", "/var/lib/rab-mess/files/hazz_cards_seeded.txt")
)
FRESH_SEC = 90

_lock = threading.Lock()
_rows: list[dict] = []
_date = ""


def is_hazz_serial(serial: str) -> bool:
    serial = (serial or "").strip()
    main = (settings.adms_main_serial or "").strip()
    return bool(serial) and serial != main


def note_hazz_adms(serial: str) -> None:
    if not serial:
        return
    HAZZ_SEEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    HAZZ_SEEN_PATH.write_text(
        json.dumps({"serial": serial, "seen": time.time()}),
        encoding="utf-8",
    )


def _seen() -> dict:
    try:
        data = json.loads(HAZZ_SEEN_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _load_board() -> dict:
    try:
        data = json.loads(HAZZ_PUNCH_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"date": "", "rows": []}
    if not isinstance(data, dict):
        return {"date": "", "rows": []}
    rows = data.get("rows")
    return {
        "date": str(data.get("date") or ""),
        "rows": list(rows) if isinstance(rows, list) else [],
    }


def _save_board(day: str, rows: list[dict]) -> None:
    from zk_gate import _archive_punch_day, _merge_archived_punches, _punch_stamp_day

    today_rows = [
        row
        for row in rows
        if isinstance(row, dict) and _punch_stamp_day(row) == day
    ]
    HAZZ_PUNCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    HAZZ_PUNCH_PATH.write_text(
        json.dumps({"date": day, "rows": today_rows}),
        encoding="utf-8",
    )
    _archive_punch_day(HAZZ_PUNCH_HISTORY, day, today_rows)
    stray: dict[str, list[dict]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        punch_day = _punch_stamp_day(row)
        if punch_day and punch_day != day:
            stray.setdefault(punch_day, []).append(row)
    for punch_day, extra in stray.items():
        _merge_archived_punches(HAZZ_PUNCH_HISTORY, punch_day, extra)


HAZZ_PUNCH_HISTORY = HAZZ_PUNCH_PATH.with_name("hazz_punch_history.json")


def hazz_snapshot() -> dict:
    seen = _seen()
    fresh = time.time() - float(seen.get("seen") or 0) < FRESH_SEC
    day = mess_today().isoformat()
    with _lock:
        rows = list(_rows)
        mem_date = _date
    board = _load_board()
    if board.get("date") == day and board.get("rows"):
        disk_latest = max((str(row.get("punched_at") or "") for row in board["rows"]), default="")
        mem_latest = max((str(row.get("punched_at") or "") for row in rows), default="")
        if mem_date != day or disk_latest >= mem_latest:
            rows = list(board["rows"])
    from zk_gate import _punch_stamp_day

    rows = [
        row
        for row in rows
        if isinstance(row, dict) and _punch_stamp_day(row) == day
    ]
    return {
        "reachable": fresh,
        "host": str(seen.get("serial") or ""),
        "port": 8088,
        "error": "",
        "syncing": False,
        "enrolled": 0,
        "removed": 0,
        "skipped": 0,
        "last_sync": None,
        "date": day,
        "rows": rows,
    }


def _append_punch(pin: str, punched: datetime, known_by_key, ms_ids, shifts) -> None:
    global _date
    day = punched.date()
    if day != mess_today():
        return
    stamp = punched.strftime("%Y-%m-%d %H:%M:%S")
    with _lock:
        if _date == day.isoformat():
            existing = list(_rows)
        else:
            board = _load_board()
            existing = board["rows"] if board.get("date") == day.isoformat() else []
        if any(
            str(row.get("rab_id") or "") == pin and str(row.get("punched_at") or "") == stamp
            for row in existing
        ):
            return
        events: list[tuple[str, datetime]] = []
        for row in existing:
            text = str(row.get("punched_at") or "")
            try:
                when = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
            if when.date() != day:
                continue
            events.append((str(row.get("rab_id") or ""), when))
        events.append((pin, punched.replace(tzinfo=None)))
        events.sort(key=lambda item: item[1])
        rows = _build_rows(events, known_by_key, ms_ids, shifts, {}, {})
        _rows[:] = rows
        _date = day.isoformat()
    _save_board(day.isoformat(), rows)


def ingest_hazz_attendance(db, records: list[tuple[str, datetime]]) -> int:
    day = mess_today()
    known_by_key, ms_ids, _, shifts = _today_maps(db, day)
    kept = 0
    for pin, punched in records:
        if punched.date() != day:
            continue
        _append_punch(pin, punched, known_by_key, ms_ids, shifts)
        kept += 1
    return kept


def _read_cmds() -> dict:
    try:
        data = json.loads(HAZZ_CMD_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    cmds = data.get("cmds")
    data["cmds"] = list(cmds) if isinstance(cmds, list) else []
    data["seq"] = int(data.get("seq") or 0)
    return data


def _write_cmds(data: dict) -> None:
    HAZZ_CMD_PATH.parent.mkdir(parents=True, exist_ok=True)
    HAZZ_CMD_PATH.write_text(json.dumps(data), encoding="utf-8")


def queue_hazz_userinfo(member) -> str:
    """One card update for a later edit. The first full list is sent when the device asks."""
    if not HAZZ_SEED_PATH.exists():
        return ""
    pin = machine_pin(member)
    card = card_on_device(member.rfid)
    if not pin or card <= 0:
        return ""
    with _lock:
        data = _read_cmds()
        data["seq"] += 1
        data["cmds"].append({"id": data["seq"], "line": access_delete_command(data["seq"], pin)})
        data["seq"] += 1
        line = access_user_command(data["seq"], pin, member.name, card)
        data["cmds"].append({"id": data["seq"], "line": line})
        data["seq"] += 1
        data["cmds"].append({"id": data["seq"], "line": access_authorize_command(data["seq"], pin)})
        _write_cmds(data)
    return line


def ensure_hazz_cards(db) -> None:
    serial = str(_seen().get("serial") or "").strip()
    if not serial:
        return
    try:
        seeded = HAZZ_SEED_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        seeded = ""
    if seeded == serial:
        return
    from models import Member

    cmds = []
    seq = 0
    for member in db.query(Member).all():
        pin = machine_pin(member)
        card = card_on_device(getattr(member, "rfid", ""))
        if not pin or card <= 0:
            continue
        seq += 1
        cmds.append({"id": seq, "line": access_delete_command(seq, pin)})
        seq += 1
        cmds.append(
            {
                "id": seq,
                "line": access_user_command(seq, pin, getattr(member, "name", ""), card),
            }
        )
        seq += 1
        cmds.append({"id": seq, "line": access_authorize_command(seq, pin)})
    with _lock:
        _write_cmds({"seq": seq, "cmds": cmds})
        HAZZ_SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
        HAZZ_SEED_PATH.write_text(serial, encoding="utf-8")


def pop_hazz_command() -> str:
    with _lock:
        data = _read_cmds()
        if not data["cmds"]:
            return ""
        item = data["cmds"].pop(0)
        _write_cmds(data)
    return str(item.get("line") or "")


def drop_hazz_acked(body: str) -> None:
    import re

    if "Return=0" not in body.replace(" ", ""):
        return
    ids = {int(item) for item in re.findall(r"ID=(\d+)", body)}
    if not ids:
        return
    with _lock:
        data = _read_cmds()
        data["cmds"] = [row for row in data["cmds"] if int(row.get("id") or 0) not in ids]
        _write_cmds(data)


def start_hazz_watch(session_factory=None) -> None:
    """Hazz Camp dials in over ADMS. Do not open a TCP session to port 4370."""
    return None
