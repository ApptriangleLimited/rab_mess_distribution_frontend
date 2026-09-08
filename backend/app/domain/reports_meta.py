from decimal import Decimal

from app.domain.tags import DAILY_TAGS, RATE_ONLY_CODES

FUEL_FALLBACK = Decimal("50")
CLFR_FALLBACK = Decimal("2500")

RATION_REPORT_META = {
    "institute": "RAB HQ",
    "currency": "BDT",
    "transferType": "C",
    "entryDescription": "Fresh Money Bill",
    "paymentInfo": "Fresh Money",
    "refPrefix": "RAB HQ/Finance/S33/Pay",
}


def duty_tag_codes(extra: list[str] | None = None) -> list[str]:
    seen = set()
    out: list[str] = []
    for code, _allow in DAILY_TAGS:
        seen.add(code)
        out.append(code)
    for tag in extra or []:
        code = str(tag).upper()
        if not code or code in seen or code in RATE_ONLY_CODES:
            continue
        seen.add(code)
        out.append(code)
    return out
