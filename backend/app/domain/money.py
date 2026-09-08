from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from app.errors import AppError, FieldError

TWOP = Decimal("0.01")


def as_money(value, *, field: str = "amount_per_day") -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(TWOP, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid amount",
            [FieldError(field, "invalid", "Must be a number")],
        ) from exc
    if amount < 0:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Amount cannot be negative",
            [FieldError(field, "invalid", "Must be >= 0")],
        )
    return amount


def money_json(value: Decimal) -> float:
    return float(value.quantize(TWOP, rounding=ROUND_HALF_UP))


def money_days(days: int, rate: Decimal) -> Decimal:
    return (Decimal(days) * rate).quantize(TWOP, rounding=ROUND_HALF_UP)


def to_money(value) -> Decimal:
    try:
        return Decimal(str(value)).quantize(TWOP, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")
