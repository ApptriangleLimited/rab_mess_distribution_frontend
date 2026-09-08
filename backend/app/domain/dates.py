from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().tz)


def today_dhaka() -> date:
    return datetime.now(tz()).date()


def yesterday_dhaka() -> date:
    return today_dhaka() - timedelta(days=1)


def next_date(value: date) -> date:
    return value + timedelta(days=1)


def month_bounds(month: str) -> tuple[date, date]:
    try:
        year_s, month_s = month.strip().split("-")
        year, mon = int(year_s), int(month_s)
        start = date(year, mon, 1)
    except ValueError as exc:
        from app.errors import AppError

        raise AppError(400, "VALIDATION_ERROR", "Invalid month") from exc
    if mon == 12:
        end = date(year, 12, 31)
    else:
        end = date(year, mon + 1, 1) - timedelta(days=1)
    return start, end


def date_range(start: date, end: date) -> list[date]:
    if end < start:
        return []
    days: list[date] = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def date_str(value: date | None) -> str | None:
    return value.isoformat() if value else None


def iso_z(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
