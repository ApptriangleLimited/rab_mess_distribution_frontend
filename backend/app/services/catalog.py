from collections import defaultdict

from sqlalchemy.orm import Session

from app.constants import CACHE_CATALOG_KEY, CACHE_CATALOG_TTL
from app.domain.catalog_seed import (
    BANNED_WINGS,
    CORE_BANKS,
    CORE_FORCES,
    CORE_RANKS,
    CORE_WINGS,
    DEFAULT_AUTHORIZED,
    DEFAULT_WING_PARENT,
    FORCE_DEFAULT_RANKS,
    FORCE_RANK_LABELS,
    FORCES,
    MEMBER_BANKS,
    RANK_LABELS,
    RANKS,
    WING_LABELS,
    WINGS,
    ADMIN_SUB_WINGS,
    HQ_SUB_WINGS,
)
from app.domain.query import iexact
from app.errors import AppError, FieldError
from app.models.member import Member
from app.models.settings import (
    AuthorizedStrength,
    OrgForce,
    OrgForceRank,
    OrgMemberBank,
    OrgRank,
    OrgRankEquivalent,
    OrgRankForceWing,
    OrgWing,
)
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.cache import bust_settings_cache, cache_get, cache_set

ALL_WING_LABELS = [*WINGS, *ADMIN_SUB_WINGS, *HQ_SUB_WINGS]


def seed_catalog(db: Session) -> int:
    created = 0
    if not db.query(OrgRank).count():
        for i, label in enumerate(RANKS):
            db.add(
                OrgRank(
                    label=label,
                    sort_order=i,
                    elaborate=RANK_LABELS.get(label, ""),
                    builtin=True,
                )
            )
            created += 1
    if not db.query(OrgWing).count():
        for i, label in enumerate(ALL_WING_LABELS):
            db.add(
                OrgWing(
                    label=label,
                    parent=DEFAULT_WING_PARENT.get(label),
                    elaborate=WING_LABELS.get(label, ""),
                    sort_order=i,
                    builtin=True,
                )
            )
            created += 1
    if not db.query(OrgForce).count():
        for i, label in enumerate(FORCES):
            db.add(OrgForce(label=label, sort_order=i, builtin=True))
            created += 1
    if not db.query(OrgForceRank).count():
        for force, ranks in FORCE_DEFAULT_RANKS.items():
            for i, rank in enumerate(ranks):
                db.add(
                    OrgForceRank(
                        force=force,
                        rank=rank,
                        is_extra=False,
                        is_removed=False,
                        elaborate=FORCE_RANK_LABELS.get(force, {}).get(rank, ""),
                        sort_order=i,
                    )
                )
                created += 1
    if not db.query(OrgMemberBank).count():
        for i, label in enumerate(MEMBER_BANKS):
            db.add(OrgMemberBank(label=label, builtin=True, sort_order=i))
            created += 1
    if not db.query(AuthorizedStrength).count():
        for i, row in enumerate(DEFAULT_AUTHORIZED):
            db.add(
                AuthorizedStrength(
                    id=row["id"],
                    label=row["label"],
                    sort_order=i,
                    wings=row.get("wings") or {},
                    held_wings=row.get("held_wings") or {},
                )
            )
            created += 1
    return created


def _force_rank_maps(db: Session) -> tuple[dict, dict, dict, dict]:
    force_ranks: dict[str, list[str]] = defaultdict(list)
    extras: dict[str, list[str]] = defaultdict(list)
    removed: dict[str, list[str]] = defaultdict(list)
    labels: dict[str, dict[str, str]] = defaultdict(dict)
    rows = db.query(OrgForceRank).order_by(OrgForceRank.sort_order, OrgForceRank.id).all()
    for row in rows:
        if row.elaborate:
            labels[row.force][row.rank] = row.elaborate
        if row.is_removed:
            removed[row.force].append(row.rank)
            continue
        if row.is_extra:
            extras[row.force].append(row.rank)
        force_ranks[row.force].append(row.rank)
    return force_ranks, extras, removed, labels


def build_catalog(db: Session, *, use_cache: bool = True) -> dict:
    if use_cache:
        cached = cache_get(CACHE_CATALOG_KEY)
        if cached is not None:
            return cached
    ranks = db.query(OrgRank).order_by(OrgRank.sort_order, OrgRank.label).all()
    wings = db.query(OrgWing).order_by(OrgWing.sort_order, OrgWing.label).all()
    forces = db.query(OrgForce).order_by(OrgForce.sort_order, OrgForce.label).all()
    banks = db.query(OrgMemberBank).order_by(OrgMemberBank.sort_order, OrgMemberBank.label).all()
    force_ranks, extras, removed, fr_labels = _force_rank_maps(db)

    equivalents: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in db.query(OrgRankEquivalent).all():
        equivalents[row.rab_rank][row.force].append(row.service_rank)

    wings_map: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in db.query(OrgRankForceWing).all():
        wings_map[row.rab_rank][row.force].append(row.wing)

    rank_forces: dict[str, list[str]] = {}
    for rank in ranks:
        eq = equivalents.get(rank.label) or {}
        wf = wings_map.get(rank.label) or {}
        keys = list(eq.keys()) or list(wf.keys())
        if keys:
            rank_forces[rank.label] = keys

    payload = {
        "ranks": [r.label for r in ranks],
        "rank_labels": {r.label: r.elaborate for r in ranks if r.elaborate},
        "wings": [w.label for w in wings],
        "wing_parent": {w.label: w.parent for w in wings if w.parent},
        "wing_labels": {w.label: w.elaborate for w in wings if w.elaborate},
        "forces": [f.label for f in forces],
        "force_ranks": dict(force_ranks),
        "force_rank_extras": dict(extras),
        "force_rank_removed": dict(removed),
        "force_rank_labels": {k: dict(v) for k, v in fr_labels.items()},
        "rank_forces": rank_forces,
        "rank_equivalents": {k: dict(v) for k, v in equivalents.items()},
        "rank_force_wings": {k: dict(v) for k, v in wings_map.items()},
        "member_banks": [b.label for b in banks],
    }
    cache_set(CACHE_CATALOG_KEY, payload, CACHE_CATALOG_TTL)
    return payload


def _auth_id(label: str) -> str:
    key = "".join(ch if ch.isalnum() else "_" for ch in label.strip().lower())
    key = "_".join(part for part in key.split("_") if part)
    return "auth_officer" if key == "officer" else f"auth_{key}"


def add_rank(db: Session, label: str, elaborate: str, *, staff: Staff, request) -> dict:
    name = label.strip()
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Label required", [FieldError("label", "required", "Required")])
    existing = db.query(OrgRank).filter(iexact(OrgRank.label, name)).one_or_none()
    if existing:
        raise AppError(409, "CONFLICT", "Rank exists", [FieldError("label", "taken", "Rank exists")])
    last = db.query(OrgRank).order_by(OrgRank.sort_order.desc()).first()
    db.add(OrgRank(label=name, sort_order=(last.sort_order + 1) if last else 0, elaborate=elaborate.strip(), builtin=False))
    if not db.get(AuthorizedStrength, _auth_id(name)):
        last_a = db.query(AuthorizedStrength).order_by(AuthorizedStrength.sort_order.desc()).first()
        db.add(
            AuthorizedStrength(
                id=_auth_id(name),
                label=name,
                sort_order=(last_a.sort_order + 1) if last_a else 0,
                wings={},
                held_wings={},
            )
        )
    record_audit(db, staff=staff, action="catalog.rank.create", entity_type="rank", entity_id=name, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": name}


def patch_rank(db: Session, label: str, elaborate: str | None, *, staff: Staff, request) -> dict:
    row = db.query(OrgRank).filter(iexact(OrgRank.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Rank not found")
    if elaborate is not None:
        row.elaborate = elaborate.strip()
    record_audit(db, staff=staff, action="catalog.rank.patch", entity_type="rank", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label, "elaborate": row.elaborate}


def delete_rank(db: Session, label: str, *, staff: Staff, request) -> dict:
    row = db.query(OrgRank).filter(iexact(OrgRank.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Rank not found")
    if row.builtin or row.label.lower() in CORE_RANKS:
        raise AppError(409, "BUILTIN", "Cannot delete a built-in rank")
    if db.query(Member).filter(Member.rank == row.label).first():
        raise AppError(409, "IN_USE", "Rank is still in use")
    auth = db.get(AuthorizedStrength, _auth_id(row.label))
    if auth:
        db.delete(auth)
    db.delete(row)
    record_audit(db, staff=staff, action="catalog.rank.delete", entity_type="rank", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label}


def _wing_cycle(db: Session, label: str, parent: str | None) -> None:
    seen = {label.lower()}
    current = parent
    while current:
        if current.lower() in seen:
            raise AppError(400, "VALIDATION_ERROR", "Wing parent cycle")
        seen.add(current.lower())
        row = db.query(OrgWing).filter(iexact(OrgWing.label, current)).one_or_none()
        current = row.parent if row else None


def add_wing(db: Session, label: str, parent: str | None, elaborate: str, *, staff: Staff, request) -> dict:
    name = label.strip()
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Label required", [FieldError("label", "required", "Required")])
    if name.lower() in BANNED_WINGS:
        raise AppError(400, "VALIDATION_ERROR", "Banned wing label")
    if db.query(OrgWing).filter(iexact(OrgWing.label, name)).one_or_none():
        raise AppError(409, "CONFLICT", "Wing exists", [FieldError("label", "taken", "Wing exists")])
    parent_val = parent.strip() if parent else None
    if parent_val:
        if not db.query(OrgWing).filter(iexact(OrgWing.label, parent_val)).one_or_none():
            raise AppError(400, "VALIDATION_ERROR", "Unknown parent wing")
        _wing_cycle(db, name, parent_val)
    last = db.query(OrgWing).order_by(OrgWing.sort_order.desc()).first()
    db.add(
        OrgWing(
            label=name,
            parent=parent_val,
            elaborate=elaborate.strip(),
            sort_order=(last.sort_order + 1) if last else 0,
            builtin=False,
        )
    )
    record_audit(db, staff=staff, action="catalog.wing.create", entity_type="wing", entity_id=name, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": name}


def patch_wing(db: Session, label: str, parent: str | None, elaborate: str | None, *, staff: Staff, request) -> dict:
    row = db.query(OrgWing).filter(iexact(OrgWing.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Wing not found")
    if parent is not None:
        parent_val = parent.strip() if parent else None
        if parent_val:
            if parent_val.lower() == row.label.lower():
                raise AppError(400, "VALIDATION_ERROR", "Wing parent cycle")
            if not db.query(OrgWing).filter(iexact(OrgWing.label, parent_val)).one_or_none():
                raise AppError(400, "VALIDATION_ERROR", "Unknown parent wing")
            _wing_cycle(db, row.label, parent_val)
        row.parent = parent_val
    if elaborate is not None:
        row.elaborate = elaborate.strip()
    record_audit(db, staff=staff, action="catalog.wing.patch", entity_type="wing", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label, "parent": row.parent, "elaborate": row.elaborate}


def delete_wing(db: Session, label: str, *, staff: Staff, request) -> dict:
    row = db.query(OrgWing).filter(iexact(OrgWing.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Wing not found")
    if row.builtin or row.label.lower() in CORE_WINGS:
        raise AppError(409, "BUILTIN", "Cannot delete a built-in wing")
    if db.query(Member).filter(Member.wing == row.label).first():
        raise AppError(409, "IN_USE", "Wing is still in use")
    db.delete(row)
    record_audit(db, staff=staff, action="catalog.wing.delete", entity_type="wing", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label}


def add_force(db: Session, label: str, *, staff: Staff, request) -> dict:
    name = label.strip()
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Label required")
    if db.query(OrgForce).filter(iexact(OrgForce.label, name)).one_or_none():
        raise AppError(409, "CONFLICT", "Force exists")
    last = db.query(OrgForce).order_by(OrgForce.sort_order.desc()).first()
    db.add(OrgForce(label=name, sort_order=(last.sort_order + 1) if last else 0, builtin=False))
    record_audit(db, staff=staff, action="catalog.force.create", entity_type="force", entity_id=name, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": name}


def delete_force(db: Session, label: str, *, staff: Staff, request) -> dict:
    row = db.query(OrgForce).filter(iexact(OrgForce.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Force not found")
    if row.builtin or row.label.lower() in CORE_FORCES:
        raise AppError(409, "BUILTIN", "Cannot delete a built-in force")
    if db.query(Member).filter(Member.force == row.label).first():
        raise AppError(409, "IN_USE", "Force is still in use")
    db.delete(row)
    record_audit(db, staff=staff, action="catalog.force.delete", entity_type="force", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label}


def add_force_rank(db: Session, force: str, label: str, elaborate: str, *, staff: Staff, request) -> dict:
    org = db.query(OrgForce).filter(iexact(OrgForce.label, force)).one_or_none()
    if org is None:
        raise AppError(404, "NOT_FOUND", "Force not found")
    name = label.strip()
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Label required")
    existing = (
        db.query(OrgForceRank)
        .filter(OrgForceRank.force == org.label, iexact(OrgForceRank.rank, name))
        .one_or_none()
    )
    if existing and not existing.is_removed:
        raise AppError(409, "CONFLICT", "Force rank exists")
    if existing:
        existing.is_removed = False
        existing.is_extra = True
        existing.elaborate = elaborate.strip() or existing.elaborate
    else:
        last = (
            db.query(OrgForceRank)
            .filter(OrgForceRank.force == org.label)
            .order_by(OrgForceRank.sort_order.desc())
            .first()
        )
        db.add(
            OrgForceRank(
                force=org.label,
                rank=name,
                is_extra=True,
                is_removed=False,
                elaborate=elaborate.strip(),
                sort_order=(last.sort_order + 1) if last else 0,
            )
        )
    record_audit(db, staff=staff, action="catalog.force_rank.create", entity_type="force_rank", entity_id=name, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": name}


def patch_force_rank(db: Session, force: str, label: str, elaborate: str, *, staff: Staff, request) -> dict:
    row = (
        db.query(OrgForceRank)
        .filter(iexact(OrgForceRank.force, force), iexact(OrgForceRank.rank, label))
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "NOT_FOUND", "Force rank not found")
    row.elaborate = elaborate.strip()
    bust_settings_cache()
    db.commit()
    return {"label": row.rank, "elaborate": row.elaborate}


def delete_force_rank(db: Session, force: str, label: str, *, staff: Staff, request) -> dict:
    row = (
        db.query(OrgForceRank)
        .filter(iexact(OrgForceRank.force, force), iexact(OrgForceRank.rank, label))
        .one_or_none()
    )
    if row is None:
        raise AppError(404, "NOT_FOUND", "Force rank not found")
    if row.is_extra:
        db.delete(row)
    else:
        row.is_removed = True
    record_audit(db, staff=staff, action="catalog.force_rank.delete", entity_type="force_rank", entity_id=row.rank, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.rank}


def put_equivalents(db: Session, rank: str, by_force: dict, *, staff: Staff, request) -> dict:
    rab = db.query(OrgRank).filter(iexact(OrgRank.label, rank)).one_or_none()
    if rab is None:
        raise AppError(404, "NOT_FOUND", "Rank not found")
    db.query(OrgRankEquivalent).filter(OrgRankEquivalent.rab_rank == rab.label).delete()
    for force, ranks in (by_force or {}).items():
        for service_rank in ranks or []:
            db.add(OrgRankEquivalent(rab_rank=rab.label, force=force, service_rank=str(service_rank)))
    record_audit(db, staff=staff, action="catalog.equivalents.put", entity_type="rank", entity_id=rab.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"rank": rab.label, "by_force": by_force}


def put_rank_force_wings(db: Session, rank: str, by_force: dict, *, staff: Staff, request) -> dict:
    rab = db.query(OrgRank).filter(iexact(OrgRank.label, rank)).one_or_none()
    if rab is None:
        raise AppError(404, "NOT_FOUND", "Rank not found")
    db.query(OrgRankForceWing).filter(OrgRankForceWing.rab_rank == rab.label).delete()
    for force, wings in (by_force or {}).items():
        for wing in wings or []:
            db.add(OrgRankForceWing(rab_rank=rab.label, force=force, wing=str(wing)))
    record_audit(db, staff=staff, action="catalog.rfw.put", entity_type="rank", entity_id=rab.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"rank": rab.label, "by_force": by_force}


def add_member_bank(db: Session, label: str, *, staff: Staff, request) -> dict:
    name = label.strip()
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Label required")
    if db.query(OrgMemberBank).filter(iexact(OrgMemberBank.label, name)).one_or_none():
        raise AppError(409, "CONFLICT", "Bank exists")
    last = db.query(OrgMemberBank).order_by(OrgMemberBank.sort_order.desc()).first()
    db.add(OrgMemberBank(label=name, builtin=False, sort_order=(last.sort_order + 1) if last else 0))
    record_audit(db, staff=staff, action="catalog.bank.create", entity_type="bank", entity_id=name, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": name}


def delete_member_bank(db: Session, label: str, *, staff: Staff, request) -> dict:
    row = db.query(OrgMemberBank).filter(iexact(OrgMemberBank.label, label)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Bank not found")
    if row.builtin or row.label.lower() in CORE_BANKS:
        raise AppError(409, "BUILTIN", "Cannot delete a built-in bank")
    if db.query(Member).filter(Member.bank_name == row.label).first():
        raise AppError(409, "IN_USE", "Bank is still in use")
    db.delete(row)
    record_audit(db, staff=staff, action="catalog.bank.delete", entity_type="bank", entity_id=row.label, request=request)
    bust_settings_cache()
    db.commit()
    return {"label": row.label}


def authorized_items(db: Session) -> list[dict]:
    rows = db.query(AuthorizedStrength).order_by(AuthorizedStrength.sort_order, AuthorizedStrength.label).all()
    items = []
    for row in rows:
        wings = row.wings or {}
        items.append(
            {
                "id": row.id,
                "label": row.label,
                "count": sum(int(v) for v in wings.values()),
                "wings": wings,
                "held_wings": row.held_wings or {},
            }
        )
    items.sort(key=lambda r: (0 if r["id"] == "auth_officer" else 1, r["label"]))
    return items


def put_authorized(db: Session, items: list[dict], *, staff: Staff, request) -> list[dict]:
    db.query(AuthorizedStrength).delete()
    for i, item in enumerate(items):
        wings = item.get("wings") or {}
        db.add(
            AuthorizedStrength(
                id=str(item.get("id") or _auth_id(str(item.get("label") or f"row_{i}"))),
                label=str(item.get("label") or ""),
                sort_order=i,
                wings={k: int(v) for k, v in wings.items()},
                held_wings={k: int(v) for k, v in (item.get("held_wings") or {}).items()},
            )
        )
    record_audit(db, staff=staff, action="authorized.put", entity_type="authorized", entity_id="*", request=request)
    bust_settings_cache()
    db.commit()
    return authorized_items(db)
