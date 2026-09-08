DAILY_TAGS: list[tuple[str, bool]] = [
    ("FR", True),
    ("CL", False),
    ("PL", False),
    ("WR", False),
    ("CD", False),
    ("WIT", False),
    ("MED", False),
    ("TRG", False),
    ("MS", True),
    ("MOL", True),
    ("CMH", True),
    ("RBH", True),
    ("BGH", True),
    ("AWL", True),
    ("OSL", True),
    ("RL", False),
    ("JL", False),
    ("PE", False),
    ("LNK", False),
    ("MFR", True),
]

RATE_ONLY = (("FUEL", 50), ("CLFR", 2500))
BUILTIN_CODES = [c for c, _ in DAILY_TAGS]
RATE_ONLY_CODES = [c for c, _ in RATE_ONLY]
PROTECTED = {c.lower() for c in BUILTIN_CODES + RATE_ONLY_CODES}

TAG_RE = r"^[A-Za-z0-9]{2,8}$"


def default_rate(tag: str, allowance: bool) -> float:
    if tag == "MS":
        return 180
    return 220 if allowance else 0


def is_protected(tag: str) -> bool:
    return tag.lower() in PROTECTED


def is_builtin(tag: str) -> bool:
    return tag.upper() in BUILTIN_CODES
