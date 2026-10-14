"""Wing family matching — keep defaults aligned with src/lib/constants.ts."""

from sqlalchemy.orm import Session

from models import CatalogState

ADMIN_SUB_WINGS = [
    "DG Office",
    "ADG (Ops) Office",
    "ADG (Admin) Office",
    "Dir Office",
    "Sup Br",
    "Per Br",
    "Gen Br",
    "Med Br",
    "Rec Br",
    "Fin Br",
    "Proc Br",
    "Proj Br",
    "Dev Br",
    "Wksp Br",
    "HQ Br",
]

HQ_SUB_WINGS = [
    "HQ Office",
    "SY Br",
    "Forces Mess",
    "Fd Mess",
    "MT Br",
    "New Temp Att",
    "HQ",
]

DEFAULT_WING_PARENT = {
    **{wing: "Admin" for wing in ADMIN_SUB_WINGS},
    **{wing: "HQ Br" for wing in HQ_SUB_WINGS},
}

WING_RENAMES = {
    "director (admin) office": "Dir Office",
    "new / temporary attached": "New Temp Att",
    "newly temporary attach": "New Temp Att",
    "new temporary attach": "New Temp Att",
    "new temporary attached": "New Temp Att",
    "headquarters office": "HQ Office",
    "headquarters branch": "HQ Br",
    "security branch": "SY Br",
    "security branch - iec cell": "SY Br",
    "iec cell": "SY Br",
    "record branch": "Rec Br",
    "field mess": "Fd Mess",
    "mt branch": "MT Br",
    "admin (new)": "Admin",
    "admin (old)": "Admin",
    "rfts": "Training School",
    "budget br": "Fin Br",
    "rat br": "HQ Br",
}


def canonical_wing_name(label: str) -> str:
    next_label = " ".join((label or "").split())
    if not next_label:
        return next_label
    return WING_RENAMES.get(next_label.lower(), next_label)


def _merge_parents(db: Session) -> dict[str, str]:
    parents = dict(DEFAULT_WING_PARENT)
    row = db.get(CatalogState, "default")
    if row and isinstance(row.payload, dict):
        raw = row.payload.get("wing_parent") or {}
        if isinstance(raw, dict):
            for child, parent in raw.items():
                child_s = str(child).strip()
                parent_s = str(parent).strip()
                if child_s and parent_s:
                    parents[child_s] = parent_s
    return parents


def wing_family_names(db: Session, wing: str) -> list[str]:
    """Selected wing plus every nested unit, including official Admin/HQ children."""
    root = canonical_wing_name((wing or "").strip())
    if not root:
        return []
    parents = _merge_parents(db)
    children: dict[str, list[str]] = {}
    labels: dict[str, str] = {root.lower(): root}
    for child, parent in parents.items():
        child_s = canonical_wing_name(str(child).strip())
        parent_s = canonical_wing_name(str(parent).strip())
        if not child_s or not parent_s:
            continue
        labels.setdefault(child_s.lower(), child_s)
        labels.setdefault(parent_s.lower(), parent_s)
        children.setdefault(parent_s.lower(), []).append(child_s)
    out: list[str] = []
    seen: set[str] = set()
    stack = [root.lower()]
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        out.append(labels.get(cur, cur))
        stack.extend(child.lower() for child in children.get(cur, []))
    family = {name.lower() for name in out}
    extras: list[str] = []
    for alias, official in WING_RENAMES.items():
        if official.lower() in family and alias not in family:
            extras.append(alias)
            family.add(alias)
    return out + extras


def wing_in_family(stored: str | None, family: list[str]) -> bool:
    want = {name.lower() for name in family}
    key = canonical_wing_name(stored or "").lower()
    return bool(key) and key in want
