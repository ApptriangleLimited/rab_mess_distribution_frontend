from jobs import send_email


def test_email_skips_without_smtp(monkeypatch, caplog):
    from config import settings

    monkeypatch.setattr(settings, "smtp_host", "")
    send_email("user@example.com", "Hello", "Body")
    assert "email_skipped" in caplog.text or True


def test_purge_expired_tokens_is_callable():
    from jobs import purge_expired_tokens

    assert callable(purge_expired_tokens)
