def duty_tag_queue(tag: str) -> str:
    code = (tag or "").upper()
    if not code or code in {"MS", "MFR"}:
        return "immediate"
    if code in {"FR", "CD"}:
        return "ration"
    return "consume"


QUEUE_OWNERS = {
    "daily": frozenset({"daily", "admin"}),
    "ration": frozenset({"ration", "admin"}),
    "consume": frozenset({"consume", "admin"}),
}
