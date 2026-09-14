from auth import hash_password, verify_password
from config import Settings
from schemas import normalize_tag


def test_password_roundtrip():
    hashed = hash_password("ChangeMe!")
    assert hashed != "ChangeMe!"
    assert verify_password("ChangeMe!", hashed)
    assert not verify_password("wrong", hashed)


def test_normalize_known_tag():
    assert normalize_tag("fr") == "FR"
    assert normalize_tag("CL") == "CL"


def test_production_rejects_weak_jwt(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    settings = Settings()
    try:
        settings.assert_secure()
        raised = False
    except RuntimeError:
        raised = True
    assert raised
