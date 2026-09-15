from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from auth import current_staff
from database import SessionLocal, get_db
from models import Permission, RolePermission, Staff

PERMISSIONS = {
    "member.view": "View members",
    "member.create": "Create members",
    "member.update": "Update members",
    "member.approve": "Accept or reject members",
    "assignment.view": "View daily assignments",
    "assignment.update": "Change daily assignments",
    "tag_request.view": "View tag requests",
    "tag_request.create": "Create tag requests",
    "tag_request.approve": "Accept or reject tag requests",
    "report.view": "View consume and ration reports",
    "report.export": "Export report letters",
    "settings.manage": "Manage catalogs, rates, and senders",
    "snapshot.read": "Read application snapshot",
    "snapshot.write": "Write allowed snapshot slices",
    "pritibhoj.view": "View Pritibhoj events",
    "pritibhoj.manage": "Create or delete Pritibhoj events",
    "file.upload": "Upload files",
    "file.download": "Download files",
    "notification.view": "Read notifications",
    "auth.manage": "Revoke sessions and manage MFA",
    "meal.view": "View meal plans",
    "meal.manage": "Change meal plans",
}

ROLE_PERMISSIONS = {
    "admin": list(PERMISSIONS),
    "cc": [
        "member.view",
        "member.create",
        "member.update",
        "member.approve",
        "assignment.view",
        "tag_request.view",
        "tag_request.create",
        "report.view",
        "settings.manage",
        "snapshot.read",
        "snapshot.write",
        "file.upload",
        "file.download",
        "notification.view",
        "auth.manage",
    ],
    "daily": [
        "member.view",
        "assignment.view",
        "assignment.update",
        "tag_request.view",
        "tag_request.create",
        "tag_request.approve",
        "report.view",
        "snapshot.read",
        "snapshot.write",
        "file.download",
        "notification.view",
        "auth.manage",
    ],
    "mess": [
        "member.view",
        "assignment.view",
        "report.view",
        "snapshot.read",
        "snapshot.write",
        "pritibhoj.view",
        "pritibhoj.manage",
        "meal.view",
        "meal.manage",
        "notification.view",
        "auth.manage",
        "file.download",
    ],
    "consume": [
        "member.view",
        "assignment.view",
        "tag_request.view",
        "tag_request.approve",
        "report.view",
        "report.export",
        "snapshot.read",
        "snapshot.write",
        "notification.view",
        "auth.manage",
    ],
    "ration": [
        "member.view",
        "assignment.view",
        "tag_request.view",
        "tag_request.approve",
        "report.view",
        "report.export",
        "settings.manage",
        "snapshot.read",
        "snapshot.write",
        "notification.view",
        "auth.manage",
        "file.download",
    ],
}

CATALOG_SLICE = {
    "ranks",
    "wings",
    "wing_parent",
    "wing_labels",
    "forces",
    "force_ranks",
    "force_rank_extras",
    "force_rank_removed",
    "force_rank_labels",
    "rank_labels",
    "rank_forces",
    "rank_equivalents",
    "rank_force_wings",
    "member_banks",
    "authorized",
    "manpower_officer_absent",
    "manpower_held",
    "manpower_absent",
    "paper_report_requests",
}

SNAPSHOT_WRITE_KEYS = {
    "admin": None,
    "cc": CATALOG_SLICE,
    "daily": {"approved_dates", "suppressed_carries", "boro_khana_dates"} | CATALOG_SLICE,
    "mess": {
        "meal_shifts",
        "meal_plans",
        "meal_assigns",
        "guest_meals",
        "pritibhoj_events",
        "paper_report_requests",
    },
    "consume": {"state_reports"},
    "ration": CATALOG_SLICE,
}


def allowed_snapshot_keys(role: str) -> set[str] | None:
    return SNAPSHOT_WRITE_KEYS.get(role, set())


def filter_snapshot_body(body: dict, role: str) -> dict:
    allowed = allowed_snapshot_keys(role)
    if allowed is None:
        return body
    return {key: value for key, value in body.items() if key in allowed}


def seed_permissions() -> None:
    db = SessionLocal()
    try:
        existing = {row.code for row in db.query(Permission.code).all()}
        for code, description in PERMISSIONS.items():
            if code not in existing:
                db.add(Permission(code=code, description=description))
        db.flush()
        for role, codes in ROLE_PERMISSIONS.items():
            have = {
                row.permission_code
                for row in db.query(RolePermission).filter(RolePermission.role == role)
            }
            for code in codes:
                if code not in have:
                    db.add(RolePermission(role=role, permission_code=code))
        db.commit()
    finally:
        db.close()


def role_permission_codes(db: Session, role: str) -> set[str]:
    if role == "admin":
        return set(PERMISSIONS)
    rows = db.query(RolePermission.permission_code).filter(RolePermission.role == role).all()
    return {row[0] for row in rows}


def has_permission(db: Session, staff: Staff, *codes: str) -> bool:
    if staff.role == "admin":
        return True
    have = role_permission_codes(db, staff.role)
    return any(code in have for code in codes)


def require_permission(*codes: str):
    def _inner(
        staff: Staff = Depends(current_staff),
        db: Session = Depends(get_db),
    ) -> Staff:
        if not has_permission(db, staff, *codes):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action.",
            )
        return staff

    return _inner
