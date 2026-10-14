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
    ".bmp",
    ".heic",
    ".heif",
    ".avif",
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
    "image/bmp",
    "image/heic",
    "image/heif",
    "image/avif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
}

IMAGE_MAX_BYTES = int(2.5 * 1024 * 1024)

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".heic",
    ".heif",
    ".avif",
}

IMAGE_MIME = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/heic",
    "image/heif",
    "image/avif",
}

IMAGE_EXT_FOR_MIME = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/avif": ".avif",
}

HEIC_BRANDS = {
    "heic",
    "heix",
    "heif",
    "hevc",
    "heim",
    "heis",
    "hevm",
    "hevs",
    "mif1",
    "msf1",
}

MAGIC = (
    (b"%PDF", "application/pdf", {".pdf"}),
    (b"\x89PNG\r\n\x1a\n", "image/png", {".png"}),
    (b"\xff\xd8\xff", "image/jpeg", {".jpg", ".jpeg"}),
    (b"GIF87a", "image/gif", {".gif"}),
    (b"GIF89a", "image/gif", {".gif"}),
    (b"RIFF", "image/webp", {".webp"}),
    (b"BM", "image/bmp", {".bmp"}),
)


class StorageError(ValueError):
    pass


def _iso_brand(data: bytes) -> str:
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return data[8:12].decode("latin-1", errors="ignore").lower()
    return ""


def guess_image_mime(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"BM"):
        return "image/bmp"
    brand = _iso_brand(data)
    if brand in HEIC_BRANDS:
        return "image/heic"
    if brand in {"avif", "avis"}:
        return "image/avif"
    return ""


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
        mime = guess_image_mime(data)
    if not mime:
        if ext in {".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx"}:
            mime = declared if declared in ALLOWED_MIME else (mimetypes.guess_type(filename)[0] or "")
        else:
            raise StorageError("Unable to verify file type")
    if mime not in ALLOWED_MIME:
        raise StorageError("File type is not allowed")
    return ext, mime


def sniff_image_mime(data: bytes, filename: str, declared: str | None = None) -> tuple[str, str]:
    """Member / QR register uploads: images only, any common camera format."""
    del declared
    ext = Path(safe_filename(filename or "photo")).suffix.lower()
    mime = guess_image_mime(data)
    if not mime:
        raise StorageError("Only image files are allowed")
    if ext and ext not in IMAGE_EXTENSIONS:
        ext = IMAGE_EXT_FOR_MIME.get(mime, ".jpg")
    if not ext:
        ext = IMAGE_EXT_FOR_MIME.get(mime, ".jpg")
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
