import hashlib
import io
import logging
import mimetypes
from pathlib import Path

from config import settings
from security import new_id, safe_filename

logger = logging.getLogger("rab.api")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".csv",
}

ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
}

MAGIC = (
    (b"%PDF", "application/pdf", {".pdf"}),
    (b"\x89PNG\r\n\x1a\n", "image/png", {".png"}),
    (b"\xff\xd8\xff", "image/jpeg", {".jpg", ".jpeg"}),
    (b"GIF87a", "image/gif", {".gif"}),
    (b"GIF89a", "image/gif", {".gif"}),
    (b"RIFF", "image/webp", {".webp"}),
)


class StorageError(ValueError):
    pass


def sniff_mime(data: bytes, filename: str, declared: str | None) -> tuple[str, str]:
    ext = Path(safe_filename(filename)).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError("File type is not allowed")
    mime = ""
    for prefix, guessed, exts in MAGIC:
        if data.startswith(prefix):
            if ext == ".webp" and guessed == "image/webp" and data[8:12] != b"WEBP":
                continue
            mime = guessed
            if ext not in exts and guessed != "image/webp":
                raise StorageError("File content does not match the extension")
            break
    if not mime:
        if ext in {".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx"}:
            mime = declared if declared in ALLOWED_MIME else (mimetypes.guess_type(filename)[0] or "")
        else:
            raise StorageError("Unable to verify file type")
    if mime not in ALLOWED_MIME:
        raise StorageError("File type is not allowed")
    return ext, mime


def local_root() -> Path:
    path = Path(settings.storage_local_path)
    path.mkdir(parents=True, exist_ok=True)
    return path


def put_bytes(data: bytes, filename: str) -> str:
    key = f"{new_id('f')}/{safe_filename(filename)}"
    if settings.storage_backend == "s3":
        _s3_put(key, data)
        return key
    dest = local_root() / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return key


def get_bytes(key: str) -> bytes:
    if ".." in key or key.startswith("/") or "\\" in key:
        raise StorageError("Invalid storage key")
    if settings.storage_backend == "s3":
        return _s3_get(key)
    dest = local_root() / key
    if not dest.is_file():
        raise StorageError("File not found")
    return dest.read_bytes()


def delete_key(key: str) -> None:
    try:
        if settings.storage_backend == "s3":
            _s3_delete(key)
            return
        dest = local_root() / key
        if dest.is_file():
            dest.unlink()
    except Exception:
        logger.error('{"event":"storage_delete_failed"}')


def checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _client():
    import boto3
    from botocore.config import Config

    kwargs = {
        "aws_access_key_id": settings.storage_access_key,
        "aws_secret_access_key": settings.storage_secret_key,
        "region_name": settings.storage_region,
        "config": Config(signature_version="s3v4"),
    }
    if settings.storage_endpoint:
        kwargs["endpoint_url"] = settings.storage_endpoint
    return boto3.client("s3", **kwargs)


def _s3_put(key: str, data: bytes) -> None:
    _client().put_object(Bucket=settings.storage_bucket, Key=key, Body=data)


def _s3_get(key: str) -> bytes:
    body = _client().get_object(Bucket=settings.storage_bucket, Key=key)["Body"]
    return body.read()


def _s3_delete(key: str) -> None:
    _client().delete_object(Bucket=settings.storage_bucket, Key=key)


def as_stream(data: bytes):
    return io.BytesIO(data)
