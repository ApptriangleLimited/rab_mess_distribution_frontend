def digits_only(value: str) -> str:
    return "".join(c for c in value if c.isdigit())


def normalize_bd_phone(value: str) -> str:
    digits = digits_only(value)
    if digits.startswith("880"):
        digits = f"0{digits[3:]}"
    return digits[:11]
