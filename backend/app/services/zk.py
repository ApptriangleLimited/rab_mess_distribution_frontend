from datetime import date, datetime

from app.config import get_settings
from app.constants import CACHE_ZK_ATTENDANCE, CACHE_ZK_STATUS, CACHE_ZK_USERS
from app.domain.dates import parse_date
from app.errors import AppError
from app.models.member import Member
from app.services.cache import cache_get
from app.services.kitchen import parse_iso_dt


def require_zk_demo() -> None:
    if not get_settings().zk_demo:
        raise AppError(503, "ZK_UNAVAILABLE", "ZK demo is off")


def default_status() -> dict:
    settings = get_settings()
    return {
        "reachable": False,
        "host": settings.zk_host,
        "port": int(settings.zk_port),
        "latency_ms": 0,
        "error": "device absent",
    }


def demo_status() -> dict:
    require_zk_demo()
    cached = cache_get(CACHE_ZK_STATUS)
    if isinstance(cached, dict):
        return {
            "reachable": bool(cached.get("reachable")),
            "host": cached.get("host") or get_settings().zk_host,
            "port": int(cached.get("port") or get_settings().zk_port),
            "latency_ms": int(cached.get("latency_ms") or 0),
            "error": cached.get("error"),
        }
    return default_status()


def _users_from_members(db) -> list[dict]:
    items = []
    for member in db.query(Member).filter(Member.rfid != "").order_by(Member.name).all():
        items.append(
            {
                "user_id": member.rfid or member.id,
                "name": member.name,
                "privilege": 0,
                "group_id": "0",
                "card": member.rfid,
            }
        )
    return items


def demo_users(db) -> dict:
    require_zk_demo()
    cached = cache_get(CACHE_ZK_USERS)
    if isinstance(cached, list):
        items = cached
    else:
        items = _users_from_members(db)
    return {"items": items, "total": len(items)}


def _parse_bound(value: str | None, *, end: bool) -> datetime | date | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    day = parse_date(text) if len(text) == 10 else None
    if day is not None:
        return day
    return parse_iso_dt(text)


def _punched_in_range(punched_at: str, start, end) -> bool:
    instant = parse_iso_dt(punched_at)
    if instant is None:
        return False
    if isinstance(start, date) and not isinstance(start, datetime):
        if instant.date() < start:
            return False
    elif start is not None and instant < start:
        return False
    if isinstance(end, date) and not isinstance(end, datetime):
        if instant.date() > end:
            return False
    elif end is not None and instant > end:
        return False
    return True


def demo_attendance(
    *,
    start: str | None,
    end: str | None,
    limit: int | None,
) -> dict:
    require_zk_demo()
    cap = limit if isinstance(limit, int) and 1 <= limit <= 1000 else 200
    cached = cache_get(CACHE_ZK_ATTENDANCE)
    items = cached if isinstance(cached, list) else []
    lo = _parse_bound(start, end=False)
    hi = _parse_bound(end, end=True)
    if lo is not None or hi is not None:
        items = [row for row in items if isinstance(row, dict) and _punched_in_range(str(row.get("punched_at") or ""), lo, hi)]
    total = len(items)
    return {
        "items": items[:cap],
        "total": total,
        "limit": cap,
        "from": start,
        "to": end,
    }
