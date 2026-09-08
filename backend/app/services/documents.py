from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.domain.ids import new_id
from app.errors import AppError
from app.models.member import Member, MemberDocument
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.members import get_member

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
MAX_BYTES = 8 * 1024 * 1024


def _docs_root() -> Path:
    root = Path(get_settings().docs_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def document_public(row: MemberDocument) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "size": row.size,
        "url": row.url,
    }


def save_document(db: Session, member: Member, *, filename: str, content_type: str, data: bytes, staff: Staff, request) -> MemberDocument:
    if len(data) > MAX_BYTES:
        raise AppError(400, "VALIDATION_ERROR", "File larger than 8 MB")
    ext = ALLOWED_TYPES.get((content_type or "").split(";")[0].strip().lower())
    if ext is None:
        name = (filename or "").lower()
        if name.endswith(".pdf"):
            ext = ".pdf"
        elif name.endswith(".jpg") or name.endswith(".jpeg"):
            ext = ".jpg"
        elif name.endswith(".png"):
            ext = ".png"
        else:
            raise AppError(400, "VALIDATION_ERROR", "Use PDF, JPEG, or PNG")
    doc_id = new_id("d_")
    safe_name = Path(filename or f"document{ext}").name or f"document{ext}"
    rel = f"{member.id}/{doc_id}{ext}"
    dest = _docs_root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    url = f"/api/v1/members/{member.id}/documents/{doc_id}/file"
    row = MemberDocument(id=doc_id, name=safe_name, size=len(data), url=url, storage_path=str(dest))
    member.documents.append(row)
    record_audit(
        db,
        staff=staff,
        action="member.document.upload",
        entity_type="document",
        entity_id=doc_id,
        after={"member_id": member.id, "name": safe_name, "size": len(data)},
        request=request,
    )
    db.commit()
    db.refresh(row)
    return row


def delete_document(db: Session, member: Member, doc_id: str, staff: Staff, request) -> dict:
    row = next((d for d in member.documents if d.id == doc_id), None)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Document not found")
    path = Path(row.storage_path) if row.storage_path else None
    member.documents.remove(row)
    record_audit(
        db,
        staff=staff,
        action="member.document.delete",
        entity_type="document",
        entity_id=doc_id,
        request=request,
    )
    db.commit()
    if path and path.is_file():
        path.unlink(missing_ok=True)
    return {"id": doc_id}


def verify_documents(db: Session, member: Member, body: dict, staff: Staff, request) -> Member:
    if member.member_type != "civilian":
        raise AppError(400, "VALIDATION_ERROR", "Only civilian documents can be verified")
    flag = bool(body.get("documents_verified"))
    member.documents_verified = flag
    record_audit(
        db,
        staff=staff,
        action="member.document.verify",
        entity_type="member",
        entity_id=member.id,
        after={"documents_verified": flag},
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member


def read_document_bytes(member: Member, doc_id: str) -> tuple[MemberDocument, bytes]:
    row = next((d for d in member.documents if d.id == doc_id), None)
    if row is None or not row.storage_path:
        raise AppError(404, "NOT_FOUND", "Document not found")
    path = Path(row.storage_path)
    if not path.is_file():
        raise AppError(404, "NOT_FOUND", "Document file missing")
    return row, path.read_bytes()


def require_member(db: Session, member_id: str) -> Member:
    return get_member(db, member_id)
