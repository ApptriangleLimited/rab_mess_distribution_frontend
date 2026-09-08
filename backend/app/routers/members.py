from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, File, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.members import member_public
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.documents import delete_document, document_public, read_document_bytes, save_document, verify_documents
from app.services.lifecycle import approve_member, end_member, patch_bank, patch_status, reject_member
from app.services.members import create_member, get_member, list_members, update_member

router = APIRouter(prefix="/members", tags=["members"])


@router.get("")
def get_members(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    q: str | None = None,
    status: str | None = None,
    approval: str | None = None,
    wing: str | None = None,
    rank: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    items, total, page, page_size = list_members(
        db,
        q=q,
        status=status,
        approval=approval,
        wing=wing,
        rank=rank,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [member_public(m) for m in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def post_member(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("cc", "daily", "admin"))],
) -> dict:
    member = create_member(db, body, public=False, staff=staff, request=request)
    return member_public(member)


@router.get("/{member_id}")
def get_one(
    member_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return member_public(get_member(db, member_id))


@router.put("/{member_id}")
def put_one(
    member_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("cc", "daily", "admin"))],
) -> dict:
    member = get_member(db, member_id)
    return member_public(update_member(db, member, body, staff=staff, request=request))


@router.post("/{member_id}/approve")
def post_approve(
    member_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
    body: dict[str, Any] | None = Body(default=None),
) -> dict:
    return approve_member(db, get_member(db, member_id), body or {}, staff, request)


@router.post("/{member_id}/reject")
def post_reject(
    member_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return member_public(reject_member(db, get_member(db, member_id), staff, request))


@router.post("/{member_id}/end")
def post_end(
    member_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return member_public(end_member(db, get_member(db, member_id), staff, request))


@router.patch("/{member_id}/status")
def patch_member_status(
    member_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return member_public(patch_status(db, get_member(db, member_id), body, staff, request))


@router.patch("/{member_id}/bank")
def patch_member_bank(
    member_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("ration", "admin"))],
) -> dict:
    return member_public(patch_bank(db, get_member(db, member_id), body, staff, request))


@router.post("/{member_id}/documents", status_code=201)
async def post_document(
    member_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("cc", "daily", "admin"))],
    file: UploadFile = File(...),
) -> dict:
    data = await file.read()
    row = save_document(
        db,
        get_member(db, member_id),
        filename=file.filename or "document",
        content_type=file.content_type or "",
        data=data,
        staff=staff,
        request=request,
    )
    return document_public(row)


@router.get("/{member_id}/documents/{doc_id}/file")
def get_document_file(
    member_id: str,
    doc_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> Response:
    row, data = read_document_bytes(get_member(db, member_id), doc_id)
    media = "application/pdf" if (row.name or "").lower().endswith(".pdf") else "application/octet-stream"
    if (row.name or "").lower().endswith((".jpg", ".jpeg")):
        media = "image/jpeg"
    elif (row.name or "").lower().endswith(".png"):
        media = "image/png"
    return Response(content=data, media_type=media)


@router.delete("/{member_id}/documents/{doc_id}")
def remove_document(
    member_id: str,
    doc_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("cc", "daily", "admin"))],
) -> dict:
    return delete_document(db, get_member(db, member_id), doc_id, staff, request)


@router.patch("/{member_id}/documents/verify")
def patch_verify(
    member_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return member_public(verify_documents(db, get_member(db, member_id), body, staff, request))
