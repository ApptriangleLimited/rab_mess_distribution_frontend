"""Hazz Camp terminal. Its punches never mix with the main device screen."""

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
    _collect_events,
    _device_users,
    _today_maps,
    mess_today,
)

HAZZ_PUNCH_PATH = Path(
    os.environ.get("HAZZ_PUNCH_PATH", "/var/lib/rab-mess/files/hazz_punches.json")
)
POLL_SEC = 1.0

_lock = threading.Lock()
_state: dict = {
    "reachable": False,
    "host": "",
    "port": 4370,
    "error": "",
    "syncing": False,
    "enrolled": 0,
    "removed": 0,
    "skipped": 0,
    "last_sync": None,
    "date": "",
    "rows": [],
    "rows_date": "",
    "record_count": None,
    "watching": False,
}


def _enabled() -> bool:
    return bool(settings.zk_hazz_enabled and settings.zk_hazz_host)


def _load_board() -> dict:
    try:
        if not HAZZ_PUNCH_PATH.exists():
            return {"date": "", "rows": []}
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
    HAZZ_PUNCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    HAZZ_PUNCH_PATH.write_text(
        json.dumps({"date": day, "rows": rows}),
        encoding="utf-8",
    )


def hazz_snapshot() -> dict:
    with _lock:
        state = {
            "reachable": bool(_state["reachable"]),
            "host": _state["host"] or settings.zk_hazz_host,
            "port": int(_state["port"] or settings.zk_hazz_port),
            "error": _state["error"] or "",
            "syncing": False,
            "enrolled": int(_state["enrolled"] or 0),
            "removed": 0,
            "skipped": 0,
            "last_sync": _state["last_sync"],
            "date": _state["date"] or mess_today().isoformat(),
            "rows": list(_state["rows"]),
        }
    board = _load_board()
    if board.get("rows") and board.get("date") == state["date"]:
        disk_latest = max((str(row.get("punched_at") or "") for row in board["rows"]), default="")
        mem_latest = max((str(row.get("punched_at") or "") for row in state["rows"]), default="")
        if disk_latest >= mem_latest:
            state["rows"] = list(board["rows"])
    if not _enabled() and not state["error"]:
        state["reachable"] = False
        state["error"] = "Hazz Camp device is turned off"
    return state


def _connect():
    from zk import ZK

    last: Exception | None = None
    wait = max(int(settings.zk_timeout or 8), 2)
    for force_udp in (False, True):
        zk = ZK(
            settings.zk_hazz_host,
            port=settings.zk_hazz_port,
            timeout=wait,
            password=int(settings.zk_hazz_password or 0),
            force_udp=force_udp,
            ommit_ping=True,
        )
        try:
            return zk.connect()
        except Exception as exc:
            last = exc
    if last is not None:
        raise last
    raise RuntimeError("Hazz Camp device did not answer")


def _names_and_cards(conn) -> tuple[dict[str, str], dict[str, str]]:
    names: dict[str, str] = {}
    cards: dict[str, str] = {}
    try:
        for user in _device_users(conn):
            pin = str(getattr(user, "user_id", "") or "").strip()
            if not pin:
                continue
            names[pin] = str(getattr(user, "name", "") or "").strip()
            card = int(getattr(user, "card", 0) or 0)
            if card:
                cards[pin] = str(card)
    except Exception:
        return {}, {}
    return names, cards


def _poll(db) -> None:
    day = mess_today()
    known_by_key, ms_ids, _rfid_by_pin, shifts = _today_maps(db, day)
    conn = None
    try:
        conn = _connect()
        record_count = None
        try:
            if conn.read_sizes():
                record_count = int(getattr(conn, "records", 0))
        except Exception:
            record_count = None
        with _lock:
            same_log = (
                record_count is not None
                and record_count == _state.get("record_count")
                and _state.get("rows_date") == day.isoformat()
            )
        if not same_log:
            logs = conn.get_attendance() or []
            names, cards = _names_and_cards(conn)
            events = _collect_events(logs, day)
            rows = _build_rows(events, known_by_key, ms_ids, shifts, names, cards)
            with _lock:
                _state.update(
                    {
                        "rows": rows,
                        "record_count": record_count,
                        "rows_date": day.isoformat(),
                        "date": day.isoformat(),
                    }
                )
            _save_board(day.isoformat(), rows)
        with _lock:
            _state.update(
                {
                    "reachable": True,
                    "host": settings.zk_hazz_host,
                    "port": settings.zk_hazz_port,
                    "error": "",
                    "date": day.isoformat(),
                    "last_sync": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M"),
                }
            )
    finally:
        if conn is not None:
            try:
                conn.disconnect()
            except Exception:
                pass


def _loop(session_factory) -> None:
    while True:
        if not _enabled():
            with _lock:
                _state.update(
                    {
                        "reachable": False,
                        "host": settings.zk_hazz_host,
                        "port": settings.zk_hazz_port,
                        "error": "Hazz Camp device is turned off",
                    }
                )
            time.sleep(5)
            continue
        db = session_factory()
        try:
            _poll(db)
        except Exception as exc:
            with _lock:
                _state.update(
                    {
                        "reachable": False,
                        "host": settings.zk_hazz_host,
                        "port": settings.zk_hazz_port,
                        "error": str(exc) or "Hazz Camp device did not answer",
                    }
                )
        finally:
            db.close()
        time.sleep(POLL_SEC)


def start_hazz_watch(session_factory=None) -> None:
    if not _enabled():
        return
    if session_factory is None:
        from database import SessionLocal

        session_factory = SessionLocal
    with _lock:
        if _state.get("watching"):
            return
        _state["watching"] = True
        _state["host"] = settings.zk_hazz_host
        _state["port"] = settings.zk_hazz_port
    threading.Thread(
        target=_loop,
        args=(session_factory,),
        name="zk-hazz-watch",
        daemon=True,
    ).start()
