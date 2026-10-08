import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
from datetime import datetime, timezone

import pyotp
from cryptography.fernet import Fernet, InvalidToken

from config import settings

logger = logging.getLogger("rab.api")

COMMON_PASSWORDS = {
    "changeme!",
    "changeme",
    "password",
    "password1",
    "password123",
    "admin",
    "admin123",
    "12345678",
    "1234567890",
    "qwerty123",
    "letmein",
    "welcome",
    "mess12345",
}


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_token(nbytes: int = 48) -> str:
    return secrets.token_urlsafe(nbytes)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def validate_password(password: str, email: str = "") -> str | None:
    if len(password) < 6:
        return "Password must be at least 6 characters"
    if password.lower() in COMMON_PASSWORDS:
        return "Password is too common"
    if email:
        local = email.split("@", 1)[0].lower()
        # Numeric SRB IDs often appear in passwords (e.g. name@425691).
        if local and not local.isdigit() and local in password.lower():
            return "Password must not include the account name"
    if password.isalpha() or password.isdigit():
        return "Password must mix letters with numbers or symbols"
    if settings.is_production and password == "ChangeMe!":
        return "Default seed password is not allowed"
    return None


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.app_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        logger.error(json.dumps({"event": "secret_decrypt_failed"}))
        raise ValueError("Unable to read stored secret") from exc


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()


def recovery_code_matches(code: str, hashed_codes: list[str]) -> str | None:
    digest = hash_recovery_code(code)
    for item in hashed_codes:
        if hmac.compare_digest(item, digest):
            return item
    return None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    base = (name or "file").replace("\\", "/").split("/")[-1]
    cleaned = SAFE_NAME.sub("_", base).strip("._") or "file"
    return cleaned[:180]


def verify_login_mfa(staff, otp: str = "", recovery: str = "") -> tuple[str, str] | None:
    required = staff.role in settings.mfa_required_roles
    if required and not staff.mfa_enabled:
        return ("AUTH_MFA_REQUIRED", "MFA enrollment is required")
    if not staff.mfa_enabled:
        return None
    if otp and staff.mfa_secret:
        totp = pyotp.TOTP(decrypt_secret(staff.mfa_secret))
        if totp.verify(otp.strip(), valid_window=1):
            return None
        return ("AUTH_MFA_INVALID", "Invalid authenticator code")
    if recovery and staff.mfa_recovery:
        hashed = json.loads(decrypt_secret(staff.mfa_recovery))
        match = recovery_code_matches(recovery, hashed)
        if match:
            hashed.remove(match)
            staff.mfa_recovery = encrypt_secret(json.dumps(hashed))
            return None
        return ("AUTH_MFA_INVALID", "Invalid authenticator code")
    return ("AUTH_MFA_REQUIRED", "Authenticator code required")
