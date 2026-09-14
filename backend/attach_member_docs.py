"""Attach viewable sample files to member document metadata.

Run: docker exec rab-mess-api python attach_member_docs.py
"""

from __future__ import annotations

from cache import bust_members
from database import SessionLocal
from models import FileObject, Member, RolePermission
from permissions import seed_permissions
from persist import new_id
from storage import checksum, put_bytes

MINI_PDF = (
    b"%PDF-1.1\n"
    b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
    b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
    b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
    b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    b"4 0 obj<< /Length 80 >>stream\n"
    b"BT /F1 16 Tf 72 720 Td (SRB Mess member document) Tj ET\n"
    b"endstream\nendobj\n"
    b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
    b"trailer<< /Root 1 0 R >>\n"
)

MINI_JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000"
    "ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e272322292c342e2c31313434341f27393d38323c2e333432"
    "ffc0000b080001000101011100"
    "ffc40014000100000000000000000000000000000008"
    "ffda0008010100003f007f00ffd9"
)


def bytes_for_name(name: str) -> tuple[bytes, str]:
    lower = name.lower()
    if lower.endswith((".jpg", ".jpeg")):
        return MINI_JPEG, "image/jpeg"
    if lower.endswith(".png"):
        return (
            bytes.fromhex(
                "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
                "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
            ),
            "image/png",
        )
    return MINI_PDF, "application/pdf"


def main() -> None:
    seed_permissions()
    db = SessionLocal()
    attached = 0
    try:
        for member in db.query(Member).all():
            docs = list(member.documents or [])
            changed = False
            next_docs = []
            for raw in docs:
                doc = dict(raw) if isinstance(raw, dict) else {"name": str(raw), "size": 0}
                if doc.get("id"):
                    next_docs.append(doc)
                    continue
                name = str(doc.get("name") or "document.pdf")
                data, mime = bytes_for_name(name)
                key = put_bytes(data, name)
                file_id = new_id("fl")
                db.add(
                    FileObject(
                        id=file_id,
                        original_name=name[:255],
                        storage_key=key,
                        mime_type=mime,
                        size=len(data),
                        checksum=checksum(data),
                        entity_type="member",
                        entity_id=member.id,
                        uploaded_by="seed",
                    )
                )
                doc["id"] = file_id
                doc["name"] = name
                doc["size"] = len(data)
                next_docs.append(doc)
                changed = True
                attached += 1
            if changed:
                member.documents = next_docs
        if (
            db.query(RolePermission)
            .filter(
                RolePermission.role == "daily",
                RolePermission.permission_code == "file.download",
            )
            .first()
            is None
        ):
            db.add(RolePermission(role="daily", permission_code="file.download"))
        db.commit()
        bust_members()
        print(f"attached_files={attached}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
