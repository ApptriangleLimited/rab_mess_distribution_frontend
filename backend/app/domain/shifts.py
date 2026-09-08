import re

TIME_RE = re.compile(r"^\d{2}:\d{2}$")
BUILTIN_SHIFT_IDS = ("breakfast", "lunch", "dinner")
BUILTIN_SHIFT_NAMES = {
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "dinner": "Dinner",
}
BUILTIN_SHIFTS = (
    ("breakfast", "Breakfast", "06:00", "09:00", "Breakfast"),
    ("lunch", "Lunch", "12:00", "15:00", "Lunch"),
    ("dinner", "Dinner", "19:00", "22:00", "Dinner"),
)
LEDGER_TAGS = ("MS", "CD")


def is_builtin_shift(shift_id: str) -> bool:
    return shift_id in BUILTIN_SHIFT_IDS


def normalize_time(value: str | None) -> str:
    text = (value or "").strip()
    match = re.match(r"^(\d{2}):(\d{2})", text)
    if not match:
        from app.errors import AppError

        raise AppError(400, "BAD_TIME", "Time must be HH:MM")
    return f"{match.group(1)}:{match.group(2)}"


def to_min(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def time_intervals(start: str, end: str) -> list[tuple[int, int]]:
    start_min = to_min(start)
    end_min = to_min(end)
    if start_min == end_min:
        return []
    if end_min > start_min:
        return [(start_min, end_min)]
    return [(start_min, 24 * 60), (0, end_min)]


def assert_window(start: str, end: str) -> None:
    from app.errors import AppError

    if not TIME_RE.match(start) or not TIME_RE.match(end):
        raise AppError(400, "BAD_TIME", "Time must be HH:MM")
    for value in (start, end):
        hours, minutes = (int(p) for p in value.split(":"))
        if hours > 23 or minutes > 59:
            raise AppError(400, "BAD_TIME", "Time must be HH:MM")
    if not time_intervals(start, end):
        raise AppError(400, "BAD_TIME", "Shift cannot be zero length")


def windows_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    for start_a, end_a in time_intervals(a_start, a_end):
        for start_b, end_b in time_intervals(b_start, b_end):
            if start_a < end_b and start_b < end_a:
                return True
    return False


def normalize_name(value: str | None) -> str:
    return " ".join((value or "").split())


def plan_id_for(day) -> str:
    return f"mp_{day.isoformat().replace('-', '')}"


def member_sort_key(member) -> tuple:
    parts = re.split(r"(\d+)", member.rab_id or "")
    rab_key = tuple(int(part) if part.isdigit() else part.lower() for part in parts)
    return (rab_key, (member.rank or "").lower(), (member.name or "").lower())
