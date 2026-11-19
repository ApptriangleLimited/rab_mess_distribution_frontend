from datetime import date

from daily import inactive_open_start, month_end
from zk_gate import access_user_command, device_card_number, same_rfid
from permissions import filter_snapshot_body
from security import hash_token, validate_password, verify_login_mfa
from storage import StorageError, sniff_image_mime, sniff_mime
from cache import redis_log_target
from config import Settings


class DummyStaff:
    def __init__(self, role="cc", mfa_enabled=False, mfa_secret=None, mfa_recovery=None):
        self.role = role
        self.mfa_enabled = mfa_enabled
        self.mfa_secret = mfa_secret
        self.mfa_recovery = mfa_recovery


def test_device_verifies_the_stored_rfid_without_replacing_it():
    assert device_card_number("0007502842") == 4918042
    assert device_card_number("7502842") == 4918042
    assert same_rfid("7502842", 4918042)
    assert same_rfid("7502842", 7502842)


def test_restart_keeps_saved_punches_for_the_day(tmp_path, monkeypatch):
    import zk_gate

    day = date(2026, 11, 17)
    saved = tmp_path / "adms_punches.json"
    saved.write_text(
        '{"date":"2026-11-17","rows":[{"rab_id":"429672","punched_at":"2026-11-17 12:04:16"}]}',
        encoding="utf-8",
    )
    monkeypatch.setattr(zk_gate, "ADMS_PUNCH_PATH", saved)
    with zk_gate._state_lock:
        zk_gate._state["rows"] = []
        zk_gate._state["date"] = day.isoformat()
    rows = zk_gate._combined_rows(day)
    assert [row["rab_id"] for row in rows] == ["429672"]


def test_hazz_camp_keeps_its_own_punch_board():
    from config import settings
    from zk_hazz import HAZZ_PUNCH_PATH, is_hazz_serial

    assert HAZZ_PUNCH_PATH.name == "hazz_punches.json"
    assert is_hazz_serial(settings.adms_main_serial) is False
    assert is_hazz_serial("HAZZ-OTHER") is True
    assert is_hazz_serial("") is False


def test_access_command_sends_the_device_card_number():
    line = access_user_command(1393, "1006837", "Md Bellal Hossain", 4918042)
    assert line == (
        "C:1393:DATA UPDATE user CardNo=4918042 Name=MdBellalHossain "
        "Pin=1006837 Password= Group=1 StartTime=0 EndTime=0 Privilege=0"
    )


def test_inactive_keeps_that_day_and_clears_every_later_day():
    class Member:
        def __init__(self, status, spans):
            self.status = status
            self.inactive_spans = spans

    inactive = Member("0", [{"from": "2026-11-04", "to": None}])
    assert inactive_open_start(inactive) == date(2026, 11, 4)
    assert inactive_open_start(Member("1", [{"from": "2026-11-04", "to": None}])) is None
    assert month_end(date(2026, 11, 19)) == date(2026, 11, 30)
    assert month_end(date(2026, 12, 2)) == date(2026, 12, 31)


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


def test_sniff_image_accepts_jpeg_and_rejects_documents():
    jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
    ext, mime = sniff_image_mime(jpeg, "image", "application/octet-stream")
    assert ext == ".jpg"
    assert mime == "image/jpeg"
    try:
        sniff_image_mime(b"%PDF-1.4", "note.pdf", "application/pdf")
        raised = False
    except StorageError:
        raised = True
    assert raised


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
