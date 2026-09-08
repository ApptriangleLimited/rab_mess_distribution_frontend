ABSENT_TAGS = frozenset(
    {
        "CL",
        "PL",
        "WR",
        "WIT",
        "MED",
        "TRG",
        "CMH",
        "RBH",
        "BGH",
        "AWL",
        "OSL",
        "MOL",
        "CD",
        "RL",
        "JL",
        "PE",
        "LNK",
    }
)

RANK_ALIASES = {
    "officer": ["officer", "ad", "director", "oc", "capt", "maj", "lt", "col"],
    "dad": ["dad", "jco", "wo", "swo", "scpo", "cpo", "warrant"],
    "rt": ["rt", "wrt", "others", "other", "misc", "recruit"],
    "asi": ["asi", "nco", "sgt", "po", "si", "havildar"],
    "aasi": ["aasi", "lnco", "l/cpl", "lcpl", "cpl", "ls", "lma"],
    "naik": ["naik", "nayek", "naiek", "nayak"],
    "constable": ["constable", "co", "or", "const", "ab", "od", "sepoy", "soldier"],
    "cook": ["cook"],
    "ance": ["ance", "nc(e)", "nce", "lp(e)", "lpe", "lp (e)"],
    "civill": ["civill", "civil", "civilian"],
    "attached": ["attached", "attach"],
}

ADMIN_AUTH_ROOTS = frozenset({"admin", "admin (new)", "admin (old)"})
BANNED_WINGS = frozenset({"alpha", "bravo", "charlie", "delta", "hq", "support"})
AUTHORIZED_ROOT_WINGS = (
    "Admin",
    "Ops Wg",
    "Int Wg",
    "Comm & MIS Wg",
    "Trg Wg",
    "L & M Wg",
    "Inv Wg",
    "Air Wg",
    "R & D Cell",
    "Training School",
)


def is_admin_authorized_root(wing: str) -> bool:
    return wing.strip().lower() in ADMIN_AUTH_ROOTS


def is_banned_wing(label: str) -> bool:
    return label.strip().lower() in BANNED_WINGS


def is_officer_category(label: str) -> bool:
    key = label.strip().lower()
    return key == "officer" or key.startswith("officer")


def authorized_wing_count(wings: dict | None, wing: str) -> int:
    mapping = wings or {}
    if is_admin_authorized_root(wing) or wing == "Admin":
        return sum(int(n or 0) for k, n in mapping.items() if is_admin_authorized_root(str(k)))
    return int(mapping.get(wing) or 0)


def category_id_for_rank(rank: str, categories: list[dict]) -> str | None:
    key = " ".join(rank.strip().lower().split())
    if not key:
        return None
    exact = next((c for c in categories if c["label"].strip().lower() == key), None)
    if exact:
        return exact["id"]
    for cat in categories:
        label_key = cat["label"].strip().lower()
        aliases = RANK_ALIASES.get(label_key, [label_key])
        if any(alias == key or alias in key or key in alias for alias in aliases):
            return cat["id"]
    return next((c["id"] for c in categories if c["label"].strip().lower() == "rt"), None)


def root_wing(wing: str, parents: dict[str, str]) -> str:
    if not wing.strip():
        return "—"
    current = wing.strip()
    seen = {current.lower()}
    while parents.get(current):
        parent = parents[current]
        if parent.lower() in seen:
            break
        seen.add(parent.lower())
        current = parent
    return current
