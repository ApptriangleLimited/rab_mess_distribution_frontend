"""ZKTeco gate: RFID holders punch; MS today is accepted, others are not allowed."""

from __future__ import annotations

import threading
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from config import settings
from daily import project_cell
from models import Assignment, Member, SuppressedCarry

DHAKA = ZoneInfo("Asia/Dhaka")
STATUS_ACCEPTED = "accepted"
STATUS_NOT_ALLOWED = "not_allowed"
STATUS_RFID_NOT_FOUND = "rfid_not_found"

_device_lock = threading.Lock()
_state_lock = threading.Lock()
_state: dict = {
    "syncing": False,
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
}


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
    pin = device_pin(member.rab_id)
    if pin:
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


def _snapshot() -> dict:
    with _state_lock:
        return {
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
        }


def _set(**values) -> None:
    with _state_lock:
        _state.update(values)


def _today_maps(
    db: Session, day: date
) -> tuple[dict[str, Member], set[str], dict[str, Member]]:
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
        cell = project_cell(member, day, stored.get((member.id, day)), suppressed)
        if is_ms_today(member, cell.get("tag")):
            ms_ids.add(member.id)
    return known_by_key, ms_ids, rfid_by_pin


def _connect():
    from zk import ZK

    last: Exception | None = None
    modes = [True] if settings.zk_force_udp else [False, True]
    for force_udp in modes:
        zk = ZK(
            settings.zk_host,
            port=settings.zk_port,
            timeout=max(int(settings.zk_timeout or 10), 20),
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


def _row_status(member: Member | None, ms_ids: set[str]) -> str:
    if member is None:
        return STATUS_RFID_NOT_FOUND
    if member.id in ms_ids:
        return STATUS_ACCEPTED
    return STATUS_NOT_ALLOWED


def _punch_row(
    pin: str,
    punched: datetime,
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    device_names: dict[str, str],
    device_cards: dict[str, str],
) -> dict:
    member = known_by_key.get(pin)
    if member is None:
        card_key = device_cards.get(pin, "")
        if card_key:
            member = known_by_key.get(card_key)
    status = _row_status(member, ms_ids)
    return {
        "name": member.name if member is not None else device_names.get(pin, ""),
        "rab_id": member.rab_id if member is not None else pin,
        "rfid": member.rfid if member is not None else (device_cards.get(pin) or pin),
        "punched_at": punched.strftime("%Y-%m-%d %H:%M"),
        "allowed": status == STATUS_ACCEPTED,
        "status": status,
    }


def _refresh_cached_rows(
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    day: date,
) -> None:
    with _state_lock:
        kept = []
        for row in _state["rows"]:
            pin = device_pin(row.get("rab_id")) or str(row.get("rab_id") or "").strip()
            rfid = str(row.get("rfid") or "").strip()
            member = known_by_key.get(pin) or known_by_key.get(rfid_digits(rfid))
            if member is None and rfid:
                member = known_by_key.get(str(rfid_card(rfid)))
            status = _row_status(member, ms_ids)
            kept.append(
                {
                    "name": member.name if member is not None else row.get("name") or "",
                    "rab_id": member.rab_id if member is not None else row.get("rab_id") or pin,
                    "rfid": member.rfid if member is not None else row.get("rfid") or rfid,
                    "punched_at": row.get("punched_at") or "",
                    "allowed": status == STATUS_ACCEPTED,
                    "status": status,
                }
            )
    _set(rows=kept, date=day.isoformat())


def _read_rows(
    conn,
    known_by_key: dict[str, Member],
    ms_ids: set[str],
    day: date,
) -> None:
    record_count = None
    try:
        if conn.read_sizes():
            record_count = int(getattr(conn, "records", 0))
    except Exception:
        record_count = None

    with _state_lock:
        same_log = (
            record_count is not None
            and record_count == _state.get("record_count")
            and _state.get("rows_date") == day.isoformat()
        )
    if same_log:
        _refresh_cached_rows(known_by_key, ms_ids, day)
        return

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
    latest: dict[str, datetime] = {}
    for row in logs:
        pin = str(getattr(row, "user_id", "") or "").strip()
        if not pin:
            continue
        stamped = getattr(row, "timestamp", None)
        if not isinstance(stamped, datetime):
            continue
        punched = stamped.astimezone(DHAKA) if stamped.tzinfo else stamped
        if punched.date() != day:
            continue
        previous = latest.get(pin)
        if previous is None or punched > previous:
            latest[pin] = punched

    rows = []
    for pin, punched in latest.items():
        rows.append(_punch_row(pin, punched, known_by_key, ms_ids, device_names, device_cards))
    rows.sort(key=lambda item: item["punched_at"], reverse=True)
    _set(rows=rows, record_count=record_count, rows_date=day.isoformat(), date=day.isoformat())


def _open_and_run(db: Session, write: bool) -> None:
    if not settings.zk_enabled or not settings.zk_host:
        _set(
            reachable=False,
            host=settings.zk_host,
            port=settings.zk_port,
            error="ZK device is turned off",
            date=mess_today().isoformat(),
        )
        return
    day = mess_today()
    known_by_key, ms_ids, rfid_by_pin = _today_maps(db, day)
    conn = None
    try:
        conn = _connect()
        _read_rows(conn, known_by_key, ms_ids, day)
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
        _set(
            reachable=False,
            host=settings.zk_host,
            port=settings.zk_port,
            error=str(exc)[:300] or "ZK device did not answer",
            date=day.isoformat(),
        )
    finally:
        if conn is not None:
            try:
                conn.disconnect()
            except Exception:
                pass


def gate_snapshot() -> dict:
    return _snapshot()


def refresh_gate(db: Session) -> dict:
    """Read today's RFID check-ins. Skip the device when a sync is already using it."""
    with _state_lock:
        busy = bool(_state["syncing"])
    if busy or not _device_lock.acquire(blocking=False):
        return _snapshot()
    try:
        _open_and_run(db, write=False)
    finally:
        _device_lock.release()
    return _snapshot()


def _sync_job(session_factory) -> None:
    db = session_factory()
    try:
        with _device_lock:
            _open_and_run(db, write=True)
    finally:
        db.close()
        _set(syncing=False)


def start_sync(session_factory) -> bool:
    if not settings.zk_enabled or not settings.zk_host:
        return False
    with _state_lock:
        if _state["syncing"]:
            return False
        _state["syncing"] = True
        _state["host"] = settings.zk_host
        _state["port"] = settings.zk_port
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
        raise
    return True


def start_periodic_sync() -> None:
    """Keep the device aligned with RFID members, even when the admin page is closed."""
    with _state_lock:
        if _state.get("periodic"):
            return
        _state["periodic"] = True

    def _loop() -> None:
        import time

        from database import SessionLocal

        time.sleep(20)
        while True:
            try:
                start_sync(SessionLocal)
            except Exception:
                _set(syncing=False, error="ZK sync did not start")
            time.sleep(300)

    threading.Thread(target=_loop, name="zk-rfid-periodic", daemon=True).start()
