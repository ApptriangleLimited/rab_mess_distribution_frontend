from permissions import filter_snapshot_body
from security import hash_token, validate_password, verify_login_mfa
from storage import StorageError, sniff_mime
from cache import redis_log_target
from config import Settings


class DummyStaff:
    def __init__(self, role="cc", mfa_enabled=False, mfa_secret=None, mfa_recovery=None):
        self.role = role
        self.mfa_enabled = mfa_enabled
        self.mfa_secret = mfa_secret
        self.mfa_recovery = mfa_recovery


def test_password_policy_rejects_short_and_common():
    assert validate_password("short")
    assert validate_password("Ab1cde") is None
    assert validate_password("abcdef")
    assert validate_password("password123")
    assert validate_password("ccadminpass", "cc@mess.rab")
    assert validate_password("CorrectHorse9") is None


def test_token_hash_is_not_plaintext():
    raw = "refresh-token-value"
    digest = hash_token(raw)
    assert digest != raw
    assert len(digest) == 64


def test_snapshot_filter_blocks_cross_desk_writes():
    body = {
        "users": [{"id": "u1"}],
        "assignments": [{"id": "a1"}],
        "meal_plans": [{"id": "mp1"}],
        "state_reports": [{"id": "sr1"}],
        "ranks": ["ASI"],
    }
    consume = filter_snapshot_body(body, "consume")
    assert "users" not in consume
    assert "assignments" not in consume
    assert "meal_plans" not in consume
    assert "state_reports" in consume
    mess = filter_snapshot_body(body, "mess")
    assert "meal_plans" in mess
    assert "users" not in mess
    admin = filter_snapshot_body(body, "admin")
    assert admin["users"]


def test_mfa_not_required_when_disabled():
    assert verify_login_mfa(DummyStaff(), "", "") is None


def test_mfa_required_when_enabled_without_otp():
    code, _message = verify_login_mfa(DummyStaff(mfa_enabled=True), "", "")
    assert code == "AUTH_MFA_REQUIRED"


def test_sniff_rejects_extension_mismatch_and_traversal_names():
    try:
        sniff_mime(b"%PDF-1.4", "note.exe", "application/pdf")
        raised = False
    except StorageError:
        raised = True
    assert raised
    ext, mime = sniff_mime(b"%PDF-1.4", "../../secret.pdf", "application/octet-stream")
    assert ext == ".pdf"
    assert mime == "application/pdf"


def test_redis_log_target_hides_password(monkeypatch):
    import cache as cache_mod

    monkeypatch.setattr(cache_mod.settings, "redis_url", "redis://:super-secret@redis:6379/0")
    monkeypatch.setattr(cache_mod.settings, "redis_password", "super-secret")
    target = redis_log_target()
    assert "super-secret" not in target
    assert "redis:6379" in target


def test_database_url_encodes_special_password(monkeypatch):
    from database import resolve_database_url

    monkeypatch.setenv("POSTGRES_HOST", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "p@ss/word$x")
    monkeypatch.setenv("POSTGRES_USER", "mess")
    monkeypatch.setenv("POSTGRES_DB", "rab_mess")
    url = resolve_database_url()
    assert "p@ss/word" not in url
    assert "p%40ss%2Fword%24x" in url
    assert url.startswith("postgresql+psycopg://mess:")


def test_production_requires_redis_password(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "a" * 40)
    monkeypatch.setenv("APP_SECRET", "b" * 40)
    monkeypatch.setenv("REDIS_PASSWORD", "")
    monkeypatch.setenv("POSTGRES_PASSWORD", "strong-db-pass-32chars-long!!")
    settings = Settings()
    try:
        settings.assert_secure()
        raised = False
    except RuntimeError:
        raised = True
    assert raised
