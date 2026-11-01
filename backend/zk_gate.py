"""ZKTeco gate: one accepted punch per meal shift; later punches are already accepted."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from config import settings
from daily import project_cell
from models import Assignment, MealShift, Member, SuppressedCarry

DHAKA = ZoneInfo("Asia/Dhaka")
STATUS_ACCEPTED = "accepted"
STATUS_NOT_ALLOWED = "not_allowed"
STATUS_RFID_NOT_FOUND = "rfid_not_found"
STATUS_ALREADY_ACCEPTED = "already_accepted"
WATCH_IDLE_SEC = 0.35
WATCH_RETRY_SEC = 1.0
DEFAULT_SHIFTS = [
    {"id": "breakfast", "name": "Breakfast", "start_time": "06:00", "end_time": "09:00"},
    {"id": "lunch", "name": "Lunch", "start_time": "12:00", "end_time": "15:00"},
    {"id": "dinner", "name": "Dinner", "start_time": "19:00", "end_time": "22:00"},
]

_device_lock = threading.Lock()
_state_lock = threading.Lock()
_pause_watch = threading.Event()
_state: dict = {
    "syncing": False,
    "watching": False,
    "periodic": False,
    "reachable": False,
    "host": "",
    "port": 4370,
    "error": "",
    "enrolled": 0,
    "removed": 0,
    "skipped": 0,
    "last_sync": None,
    "date": "",
    "rows": [],
    "record_count": None,
    "rows_date": "",
    "event_stamp": "",
    "shift_stamp": "",
    "adms_at": 0.0,
    "adms_sn": "",
}
ADMS_HOLD_SEC = 90
_adms_cmd_lock = threading.Lock()
_adms_cmd_seq = 0
_adms_cmds: list[dict] = []
_adms_log = logging.getLogger("zkteco.adms")
ADMS_CMD_PATH = Path(
    os.environ.get("ADMS_CMD_PATH", "/var/lib/rab-mess/files/adms_cmds.json")
)
ADMS_PUNCH_PATH = Path(
    os.environ.get("ADMS_PUNCH_PATH", "/var/lib/rab-mess/files/adms_punches.json")
)


def mess_today() -> date:
    return datetime.now(DHAKA).date()


def device_pin(rab_id: str | None) -> str:
    return "".join((rab_id or "").split())


def rfid_digits(raw: str | None) -> str:
    return "".join(ch for ch in (raw or "") if ch.isdigit())


def rfid_card(raw: str | None) -> int:
    digits = rfid_digits(raw)
    if not digits:
        return 0
    try:
        value = int(digits)
    except ValueError:
        return 0
    if value <= 0 or value > 0xFFFFFFFF:
        return 0
    return value


def lookup_keys(member: Member) -> list[str]:
    keys: list[str] = []
    for raw in (member.rab_id, getattr(member, "personal_id", "")):
        pin = device_pin(raw)
        if pin and pin not in keys:
            keys.append(pin)
    digits = rfid_digits(member.rfid)
    if digits:
        keys.append(digits)
        stripped = str(int(digits))
        if stripped not in keys:
            keys.append(stripped)
    return keys


def has_rfid(member: Member) -> bool:
    return rfid_card(member.rfid) > 0 and bool(device_pin(member.rab_id))


def device_name(name: str | None) -> str:
    text = " ".join((name or "").split()) or "Member"
    raw = text.encode("utf-8")[:24]
    while raw and (raw[-1] & 0xC0) == 0x80:
        raw = raw[:-1]
    return raw.decode("utf-8", errors="ignore") or "Member"


def is_ms_today(member: Member, tag: str | None) -> bool:
    return (
        str(member.status) == "1"
        and (member.approval_status or "") == "approved"
        and (tag or "").upper() == "MS"
        and has_rfid(member)
    )


def _to_min(hhmm: str) -> int | None:
    parts = (hhmm or "").strip().split(":")
    if len(parts) < 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None
    return hours * 60 + minutes


def _intervals(start: str, end: str) -> list[tuple[int, int]]:
    start_min = _to_min(start)
    end_min = _to_min(end)
    if start_min is None or end_min is None or start_min == end_min:
        return []
    if end_min > start_min:
        return [(start_min, end_min)]
    return [(start_min, 24 * 60), (0, end_min)]


def _in_window(mins: int, start: str, end: str) -> bool:
    return any(start_min <= mins < end_min for start_min, end_min in _intervals(start, end))


def _aware(stamped: datetime) -> datetime:
    return stamped.astimezone(DHAKA) if stamped.tzinfo else stamped.replace(tzinfo=DHAKA)


def _snapshot() -> dict:
    with _state_lock:
        state = {
            "reachable": bool(_state["reachable"]),
            "host": _state["host"] or settings.zk_host,
            "port": int(_state["port"] or settings.zk_port),
            "error": _state["error"] or "",
            "syncing": bool(_state["syncing"]),
            "enrolled": int(_state["enrolled"] or 0),
            "removed": int(_state["removed"] or 0),
            "skipped": int(_state["skipped"] or 0),
            "last_sync": _state["last_sync"],
            "date": _state["date"] or mess_today().isoformat(),
            "rows": list(_state["rows"]),
            "adms": bool(_state.get("adms_sn")) and (
                time.monotonic() - float(_state.get("adms_at") or 0)
            ) < ADMS_HOLD_SEC,
            "serial": str(_state.get("adms_sn") or ""),
        }
    state["adms_queue"] = len(pending_adms_commands())
    board = _load_punch_board()
    if board.get("rows") and board.get("date") == state["date"]:
        disk_latest = max((str(row.get("punched_at") or "") for row in board["rows"]), default="")
        mem_latest = max((str(row.get("punched_at") or "") for row in state["rows"]), default="")
        if disk_latest >= mem_latest:
            state["rows"] = list(board["rows"])
    return state


def _set(**values) -> None:
    with _state_lock:
        _state.update(values)


def adms_fresh() -> bool:
    with _state_lock:
        seen = float(_state.get("adms_at") or 0)
    return seen > 0 and (time.monotonic() - seen) < ADMS_HOLD_SEC


def _mark_offline(message: str) -> None:
    if adms_fresh():
        return
    _set(
        reachable=False,
        host=settings.zk_host,
        port=settings.zk_port,
        error=(message or "ZK device did not answer")[:300],
        date=mess_today().isoformat(),
    )


def _lock_adms_file(handle) -> None:
    try:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    except (ImportError, OSError):
        pass


def _read_adms_store(handle) -> dict:
    handle.seek(0)
    raw = handle.read()
    if not raw.strip():
        return {"seq": 0, "cmds": []}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"seq": 0, "cmds": []}
    if not isinstance(data, dict):
        return {"seq": 0, "cmds": []}
    cmds = data.get("cmds")
    if not isinstance(cmds, list):
        cmds = []
    return {"seq": int(data.get("seq") or 0), "cmds": cmds}


def _write_adms_store(handle, data: dict) -> None:
    handle.seek(0)
    handle.truncate()
    json.dump(data, handle)
    handle.flush()
    os.fsync(handle.fileno())


def _open_adms_store():
    ADMS_CMD_PATH.parent.mkdir(parents=True, exist_ok=True)
    return open(ADMS_CMD_PATH, "a+", encoding="utf-8")


def _load_punch_board() -> dict:
    try:
        if not ADMS_PUNCH_PATH.exists():
            return {"date": "", "rows": []}
        data = json.loads(ADMS_PUNCH_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"date": "", "rows": []}
    if not isinstance(data, dict):
        return {"date": "", "rows": []}
    rows = data.get("rows")
    return {
        "date": str(data.get("date") or ""),
        "rows": list(rows) if isinstance(rows, list) else [],
    }


def _save_punch_board(day: str, rows: list[dict]) -> None:
    ADMS_PUNCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    ADMS_PUNCH_PATH.write_text(
        json.dumps({"date": day, "rows": rows}),
        encoding="utf-8",
    )


def pending_adms_commands() -> list[dict]:
    with _adms_cmd_lock:
        try:
            with _open_adms_store() as handle:
                _lock_adms_file(handle)
                return list(_read_adms_store(handle)["cmds"])
        except OSError:
            return []


def enroll_pin(member: Member) -> str:
    return device_pin(getattr(member, "personal_id", "") or "") or device_pin(member.rab_id)


def queue_adms_userinfo(member: Member, pin: str | None = None) -> str:
    """Queue a Security PUSH user write. The device picks it up on GET /iclock/getrequest."""
    pin = device_pin(pin or enroll_pin(member))
    card = rfid_card(member.rfid)
    if not pin or card <= 0:
        raise ValueError("Member needs an SRB ID and RFID")
    name = device_name(member.name)
    with _adms_cmd_lock:
        with _open_adms_store() as handle:
            _lock_adms_file(handle)
            data = _read_adms_store(handle)
            data["seq"] = int(data.get("seq") or 0) + 1
            cmd_id = data["seq"]
            line = (
                f"C:{cmd_id}:DATA UPDATE user Pin={pin}\tName={name}\t"
                f"Privilege=0\tPassword=\tCardNo={card}\tGroup=1\t"
                f"StartTime=0\tEndTime=0"
            )
            data["cmds"].append({"id": cmd_id, "line": line})
            _write_adms_store(handle, data)
    _adms_log.info("ADMS queued cmd=%r", line)
    return line


def sync_member_to_device(member: Member) -> str:
    """Queue an RFID write after Daily saves a card. Safe to call from API handlers."""
    if str(member.status) != "1" or (member.approval_status or "") != "approved":
        return ""
    try:
        return queue_adms_userinfo(member)
    except (ValueError, OSError) as exc:
        _adms_log.warning("ADMS skip member=%s err=%s", getattr(member, "id", ""), exc)
        return ""


def pop_adms_command() -> str:
    with _adms_cmd_lock:
        try:
            with _open_adms_store() as handle:
                _lock_adms_file(handle)
                data = _read_adms_store(handle)
                if not data["cmds"]:
                    return ""
                item = data["cmds"].pop(0)
                _write_adms_store(handle, data)
        except OSError:
            return ""
    line = str(item.get("line") or "")
    if line:
        _adms_log.info("ADMS popped cmd=%r", line)
    return line


def note_adms(serial: str, info: dict | None = None) -> None:
    """The terminal dialed this API over ADMS. That is the live session."""
    values: dict = {
        "reachable": True,
        "host": settings.zk_host,
        "port": settings.zk_port,
        "error": "",
        "date": mess_today().isoformat(),
        "adms_at": time.monotonic(),
    }
    if serial:
        values["adms_sn"] = serial
    if info:
        name = str(info.get("DeviceName") or info.get("~DeviceName") or "").strip()
        if name:
            values["adms_name"] = name
    _set(**values)


def ingest_adms_attendance(db: Session, records: list[tuple[str, datetime]]) -> int:
    day = mess_today()
    known_by_key, ms_ids, _, shifts = _today_maps(db, day)
    accepted = 0
    for pin, punched in records:
        if punched.date() != day:
            continue
        _append_live_punch(pin, punched, known_by_key, ms_ids, shifts, {}, {})
        accepted += 1
    _set(
        reachable=True,
        error="",
        adms_at=time.monotonic(),
        date=day.isoformat(),
    )
    return accepted


def _load_shifts(db: Session) -> list[dict]:
    rows = []
    for row in db.query(MealShift).populate_existing().all():
        rows.append(
            {
                "id": str(row.id or "").strip(),
                "name": str(row.name or "").strip(),
                "start_time": str(row.start_time or "").strip(),
                "end_time": str(row.end_time or "").strip(),
            }
        )
    rows.sort(key=lambda item: item["start_time"])
    loaded = [row for row in rows if row["id"] and _intervals(row["start_time"], row["end_time"])]
    return loaded or list(DEFAULT_SHIFTS)


def _match_shift(punched: datetime, shifts: list[dict]) -> dict | None:
    mins = punched.hour * 60 + punched.minute
    for shift in shifts:
        if _in_window(mins, shift["start_time"], shift["end_time"]):
            return shift
    return None


def _today_maps(
    db: Session, day: date
) -> tuple[dict[str, Member], set[str], dict[str, Member], list[dict]]:
    members = db.query(Member).all()
    ids = [member.id for member in members]
    stored: dict[tuple[str, date], Assignment] = {}
    suppressed: set[tuple[str, date]] = set()
    if ids:
        for row in db.query(Assignment).filter(
            Assignment.user_id.in_(ids),
            Assignment.date == day,
        ):
            stored[(row.user_id, day)] = row
        for row in db.query(SuppressedCarry).filter(
            SuppressedCarry.user_id.in_(ids),
            SuppressedCarry.date == day,
        ):
            suppressed.add((row.user_id, day))
    known_by_key: dict[str, Member] = {}
    ms_ids: set[str] = set()
    rfid_by_pin: dict[str, Member] = {}
    for member in members:
        if not has_rfid(member):
            continue
        pin = device_pin(member.rab_id)
        rfid_by_pin[pin] = member
        for key in lookup_keys(member):
            known_by_key.setdefault(key, member)
        cell = project_cell(
            member,
            day,
            stored.get((member.id, day)),
            suppressed,
        )
        if is_ms_today(member, cell.get("tag")):
            ms_ids.add(member.id)
    return known_by_key, ms_ids, rfid_by_pin, _load_shifts(db)


def _connect(timeout: int | None = None):
    from zk import ZK

    last: Exception | None = None
    wait = int(timeout if timeout is not None else settings.zk_timeout or 10)
    modes = [True] if settings.zk_force_udp else [False, True]
    for force_udp in modes:
        zk = ZK(
            settings.zk_host,
            port=settings.zk_port,
            timeout=max(wait, 2),
            password=int(settings.zk_password or 0),
            force_udp=force_udp,
            ommit_ping=True,
        )
        try:
            return zk.connect()
        except Exception as exc:
            last = exc
    if last is not None:
        raise last
    raise RuntimeError("ZK device did not answer")


def _device_users(conn) -> list:
    users = conn.get_users() or []
    return list(users)


def _apply_rfid(conn, rfid_by_pin: dict[str, Member]) -> None:
    users = _device_users(conn)
    by_pin = {}
    used_uids: set[int] = set()
    for user in users:
        pin = str(getattr(user, "user_id", "") or "").strip()
        uid = int(getattr(user, "uid", 0) or 0)
        if uid:
            used_uids.add(uid)
        if pin:
            by_pin[pin] = user

    def alloc_uid() -> int:
        uid = 1
        while uid in used_uids:
            uid += 1
            if uid > 30000:
                raise RuntimeError("ZK device user list is full")
        used_uids.add(uid)
        return uid

    skipped = 0
    enrolled = 0
    for pin, member in rfid_by_pin.items():
        wanted_name = device_name(member.name)
        wanted_card = rfid_card(member.rfid)
        current = by_pin.get(pin)
        current_name = str(getattr(current, "name", "") or "").strip() if current else ""
        current_card = int(getattr(current, "card", 0) or 0) if current is not None else -1
        if current is not None and current_name == wanted_name and current_card == wanted_card:
            enrolled += 1
            continue
        uid = int(getattr(current, "uid", 0) or 0) if current is not None else alloc_uid()
        try:
            conn.set_user(
                uid=uid,
                name=wanted_name,
                privilege=0,
                password=pin[:8],
                group_id="",
                user_id=pin,
                card=wanted_card,
            )
            enrolled += 1
        except Exception:
            skipped += 1

    _set(enrolled=enrolled, removed=0, skipped=skipped)


def _lookup_member(
    pin: str,
    known_by_key: dict[str, Member],
    device_cards: dict[str, str],
) -> Member | None:
    member = known_by_key.get(pin)
    if member is not None:
        return member
    card_key = device_cards.get(pin, "")
    if card_key:
        return known_by_key.get(card_key)
    return None


def _classify(
    member: Member | None,
    punched: datetime,
    ms_ids: set[str],
    shifts: list[dict],
    accepted_keys: set[tuple[str, str]],
) -> tuple[str, dict | None]:
    shift = _match_shift(punched, shifts)
    if member is None:
        return STATUS_RFID_NOT_FOUND, shift
    if member.id not in ms_ids or shift is None:
        return STATUS_NOT_ALLOWED, shift
    key = (member.id, shift["id"])
    if key in accepted_keys:
        return STATUS_ALREADY_ACCEPTED, shift
    accepted_keys.add(key)
    return STATUS_ACCEPTED, shift


def _punch_row(
    pin: str,
    punched: datetime,
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    accepted_keys: set[tuple[str, str]],
    device_names: dict[str, str],
    device_cards: dict[str, str],
) -> dict:
    member = _lookup_member(pin, known_by_key, device_cards)
    status, shift = _classify(member, punched, ms_ids, shifts, accepted_keys)
    return {
        "name": member.name if member is not None else device_names.get(pin, ""),
        "rab_id": member.rab_id if member is not None else pin,
        "rfid": member.rfid if member is not None else (device_cards.get(pin) or pin),
        "punched_at": punched.strftime("%Y-%m-%d %H:%M:%S"),
        "allowed": status == STATUS_ACCEPTED,
        "status": status,
        "shift_id": shift["id"] if shift else "",
        "shift_name": shift["name"] if shift else "",
    }


def _collect_events(logs, day: date) -> list[tuple[str, datetime]]:
    seen: set[tuple[str, str]] = set()
    events: list[tuple[str, datetime]] = []
    for row in logs:
        pin = str(getattr(row, "user_id", "") or "").strip()
        if not pin:
            continue
        stamped = getattr(row, "timestamp", None)
        if not isinstance(stamped, datetime):
            continue
        punched = _aware(stamped)
        if punched.date() != day:
            continue
        stamp = punched.strftime("%Y-%m-%d %H:%M:%S")
        key = (pin, stamp)
        if key in seen:
            continue
        seen.add(key)
        events.append((pin, punched))
    events.sort(key=lambda item: item[1])
    return events


def _build_rows(
    events: list[tuple[str, datetime]],
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    device_names: dict[str, str],
    device_cards: dict[str, str],
) -> list[dict]:
    accepted_keys: set[tuple[str, str]] = set()
    rows = [
        _punch_row(
            pin,
            punched,
            known_by_key,
            ms_ids,
            shifts,
            accepted_keys,
            device_names,
            device_cards,
        )
        for pin, punched in events
    ]
    rows.reverse()
    return rows


def _shift_stamp(shifts: list[dict]) -> str:
    return "|".join(
        f"{item.get('id')}:{item.get('start_time')}-{item.get('end_time')}"
        for item in shifts
    )


def _parse_punched_at(raw: str) -> datetime | None:
    text = str(raw or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=DHAKA)
        except ValueError:
            continue
    return None


def _reclassify_cached(
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    day: date,
    device_names: dict[str, str] | None = None,
    device_cards: dict[str, str] | None = None,
) -> None:
    names = device_names or {}
    cards = device_cards or {}
    with _state_lock:
        existing = list(_state["rows"])
    events: list[tuple[str, datetime]] = []
    for row in reversed(existing):
        when = _parse_punched_at(str(row.get("punched_at") or ""))
        if when is None or when.date() != day:
            continue
        pin = device_pin(row.get("rab_id")) or str(row.get("rab_id") or "").strip()
        if pin:
            events.append((pin, when))
            if row.get("name") and pin not in names:
                names[pin] = str(row.get("name") or "")
            if row.get("rfid") and pin not in cards:
                cards[pin] = rfid_digits(str(row.get("rfid") or ""))
    events.sort(key=lambda item: item[1])
    rows = _build_rows(events, known_by_key, ms_ids, shifts, names, cards)
    _set(rows=rows, date=day.isoformat(), rows_date=day.isoformat(), shift_stamp=_shift_stamp(shifts))


def _apply_current_shifts(
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    day: date,
) -> bool:
    stamp = _shift_stamp(shifts)
    with _state_lock:
        changed = stamp != str(_state.get("shift_stamp") or "")
    if not changed:
        return False
    _reclassify_cached(known_by_key, ms_ids, shifts, day)
    return True


def _event_stamp(events: list[tuple[str, datetime]]) -> str:
    if not events:
        return ""
    last = events[-1]
    return f"{len(events)}|{last[0]}|{last[1].strftime('%Y-%m-%d %H:%M:%S')}"


def _read_rows(
    conn,
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    day: date,
    force: bool = False,
) -> bool:
    record_count = None
    try:
        if conn.read_sizes():
            record_count = int(getattr(conn, "records", 0))
    except Exception:
        record_count = None

    with _state_lock:
        same_log = (
            not force
            and record_count is not None
            and record_count == _state.get("record_count")
            and _state.get("rows_date") == day.isoformat()
        )
    if same_log:
        return False

    logs = conn.get_attendance() or []
    device_names: dict[str, str] = {}
    device_cards: dict[str, str] = {}
    try:
        for user in _device_users(conn):
            pin = str(getattr(user, "user_id", "") or "").strip()
            if not pin:
                continue
            device_names[pin] = str(getattr(user, "name", "") or "").strip()
            card = int(getattr(user, "card", 0) or 0)
            if card:
                device_cards[pin] = str(card)
    except Exception:
        device_names = {}
        device_cards = {}
    events = _collect_events(logs, day)
    rows = _build_rows(events, known_by_key, ms_ids, shifts, device_names, device_cards)
    _set(
        rows=rows,
        record_count=record_count,
        rows_date=day.isoformat(),
        date=day.isoformat(),
        event_stamp=_event_stamp(events),
        shift_stamp=_shift_stamp(shifts),
    )
    return True


def _append_live_punch(
    pin: str,
    punched: datetime,
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    shifts: list[dict],
    device_names: dict[str, str],
    device_cards: dict[str, str],
) -> None:
    day = punched.date()
    if day != mess_today():
        return
    stamp = punched.strftime("%Y-%m-%d %H:%M:%S")
    with _state_lock:
        existing = list(_state["rows"])
        if any(
            (device_pin(row.get("rab_id")) or str(row.get("rab_id") or "")) == pin
            and str(row.get("punched_at") or "") == stamp
            for row in existing
        ):
            return
        events: list[tuple[str, datetime]] = []
        for row in reversed(existing):
            when = _parse_punched_at(str(row.get("punched_at") or ""))
            if when is None:
                continue
            events.append((device_pin(row.get("rab_id")) or str(row.get("rab_id") or ""), when))
        events.append((pin, punched))
        events.sort(key=lambda item: item[1])
        rows = _build_rows(events, known_by_key, ms_ids, shifts, device_names, device_cards)
        count = _state.get("record_count")
        _state.update(
            {
                "rows": rows,
                "date": day.isoformat(),
                "rows_date": day.isoformat(),
                "event_stamp": _event_stamp(events),
                "record_count": (int(count) + 1) if isinstance(count, int) else count,
            }
        )
    _save_punch_board(day.isoformat(), rows)


def _open_and_run(db: Session, write: bool) -> None:
    if not settings.zk_enabled or not settings.zk_host:
        _mark_offline("ZK device is turned off")
        return
    day = mess_today()
    known_by_key, ms_ids, rfid_by_pin, shifts = _today_maps(db, day)
    conn = None
    try:
        conn = _connect()
        _read_rows(conn, known_by_key, ms_ids, shifts, day, force=True)
        _set(
            reachable=True,
            host=settings.zk_host,
            port=settings.zk_port,
            error="",
            date=day.isoformat(),
            enrolled=len(rfid_by_pin),
        )
        if write:
            try:
                conn.disable_device()
            except Exception:
                pass
            try:
                _apply_rfid(conn, rfid_by_pin)
            finally:
                try:
                    conn.enable_device()
                except Exception:
                    pass
            _set(last_sync=datetime.now(DHAKA).strftime("%Y-%m-%d %H:%M"))
    except Exception as exc:
        _mark_offline(str(exc) or "ZK device did not answer")
    finally:
        if conn is not None:
            try:
                conn.disconnect()
            except Exception:
                pass


def _watch_once(db: Session) -> None:
    day = mess_today()
    known_by_key, ms_ids, rfid_by_pin, shifts = _today_maps(db, day)
    conn = None
    try:
        conn = _connect(timeout=3)
        _read_rows(conn, known_by_key, ms_ids, shifts, day, force=True)
        _set(
            reachable=True,
            host=settings.zk_host,
            port=settings.zk_port,
            error="",
            date=day.isoformat(),
            enrolled=len(rfid_by_pin),
        )
        device_names: dict[str, str] = {}
        device_cards: dict[str, str] = {}
        try:
            for user in _device_users(conn):
                pin = str(getattr(user, "user_id", "") or "").strip()
                if not pin:
                    continue
                device_names[pin] = str(getattr(user, "name", "") or "").strip()
                card = int(getattr(user, "card", 0) or 0)
                if card:
                    device_cards[pin] = str(card)
        except Exception:
            device_names = {}
            device_cards = {}

        used_live = False
        maps_at = time.monotonic()
        try:
            for attendance in conn.live_capture():
                if _pause_watch.is_set():
                    break
                if time.monotonic() - maps_at >= 1:
                    db.expire_all()
                    known_by_key, ms_ids, rfid_by_pin, shifts = _today_maps(db, mess_today())
                    maps_at = time.monotonic()
                    _apply_current_shifts(known_by_key, ms_ids, shifts, mess_today())
                if attendance is None:
                    _read_rows(conn, known_by_key, ms_ids, shifts, mess_today())
                    continue
                used_live = True
                pin = str(getattr(attendance, "user_id", "") or "").strip()
                stamped = getattr(attendance, "timestamp", None)
                if not pin or not isinstance(stamped, datetime):
                    continue
                _append_live_punch(
                    pin,
                    _aware(stamped),
                    known_by_key,
                    ms_ids,
                    shifts,
                    device_names,
                    device_cards,
                )
        except Exception:
            used_live = False

        if used_live or _pause_watch.is_set():
            return

        maps_at = 0.0
        while not _pause_watch.is_set():
            if time.monotonic() - maps_at >= 1:
                db.expire_all()
                known_by_key, ms_ids, rfid_by_pin, shifts = _today_maps(db, mess_today())
                maps_at = time.monotonic()
                _apply_current_shifts(known_by_key, ms_ids, shifts, mess_today())
            _read_rows(conn, known_by_key, ms_ids, shifts, mess_today())
            _set(reachable=True, error="", enrolled=len(rfid_by_pin))
            time.sleep(WATCH_IDLE_SEC)
    except Exception as exc:
        _mark_offline(str(exc) or "ZK device did not answer")
    finally:
        if conn is not None:
            try:
                conn.end_live_capture = True
            except Exception:
                pass
            try:
                conn.disconnect()
            except Exception:
                pass


def _watch_loop(session_factory) -> None:
    while True:
        if not settings.zk_enabled or not settings.zk_host:
            _mark_offline("ZK device is turned off")
            time.sleep(WATCH_RETRY_SEC)
            continue
        if adms_fresh():
            time.sleep(2)
            continue
        if _pause_watch.is_set() or bool(_state.get("syncing")):
            time.sleep(0.15)
            continue
        if not _device_lock.acquire(blocking=False):
            time.sleep(0.15)
            continue
        db = session_factory()
        try:
            _watch_once(db)
        finally:
            db.close()
            _device_lock.release()
        time.sleep(WATCH_RETRY_SEC if not _pause_watch.is_set() else 0.15)


def gate_snapshot() -> dict:
    return _snapshot()


def apply_saved_shifts(session_factory=None) -> dict:
    """Re-score cached punches when Settings shift windows change."""
    if session_factory is None:
        from database import SessionLocal

        session_factory = SessionLocal
    db = session_factory()
    try:
        day = mess_today()
        shifts = _load_shifts(db)
        stamp = _shift_stamp(shifts)
        with _state_lock:
            unchanged = stamp == str(_state.get("shift_stamp") or "")
        if unchanged:
            return _snapshot()
        known_by_key, ms_ids, _, shifts = _today_maps(db, day)
        _apply_current_shifts(known_by_key, ms_ids, shifts, day)
    finally:
        db.close()
    return _snapshot()


def refresh_gate(db: Session) -> dict:
    """Return the latest cached punches. The watch thread talks to the device."""
    from database import SessionLocal

    start_live_watch(SessionLocal)
    apply_saved_shifts(SessionLocal)
    return _snapshot()


def _sync_job(session_factory) -> None:
    _pause_watch.set()
    db = session_factory()
    try:
        with _device_lock:
            _open_and_run(db, write=True)
    finally:
        db.close()
        _set(syncing=False)
        _pause_watch.clear()


def start_sync(session_factory) -> bool:
    if not settings.zk_enabled or not settings.zk_host:
        return False
    with _state_lock:
        if _state["syncing"]:
            return False
        _state["syncing"] = True
        _state["host"] = settings.zk_host
        _state["port"] = settings.zk_port
    _pause_watch.set()
    thread = threading.Thread(
        target=_sync_job,
        args=(session_factory,),
        name="zk-rfid-sync",
        daemon=True,
    )
    try:
        thread.start()
    except Exception:
        _set(syncing=False)
        _pause_watch.clear()
        raise
    return True


def start_live_watch(session_factory=None) -> None:
    if session_factory is None:
        from database import SessionLocal

        session_factory = SessionLocal
    with _state_lock:
        if _state.get("watching"):
            return
        _state["watching"] = True
        _state["host"] = settings.zk_host
        _state["port"] = settings.zk_port
    threading.Thread(
        target=_watch_loop,
        args=(session_factory,),
        name="zk-live-watch",
        daemon=True,
    ).start()


def start_periodic_sync() -> None:
    """Keep the device aligned with RFID members, even when the admin page is closed."""
    start_live_watch()
    with _state_lock:
        if _state.get("periodic"):
            return
        _state["periodic"] = True

    def _loop() -> None:
        from database import SessionLocal

        time.sleep(8)
        while True:
            try:
                start_sync(SessionLocal)
            except Exception:
                _set(syncing=False)
                _pause_watch.clear()
            time.sleep(300)

    threading.Thread(target=_loop, name="zk-rfid-periodic", daemon=True).start()
