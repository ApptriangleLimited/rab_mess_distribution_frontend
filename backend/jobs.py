import logging
import smtplib
from email.message import EmailMessage

from rq import Retry

from cache import get_redis_raw, worker_heartbeat
from config import settings
from database import SessionLocal
from models import PasswordReset, RefreshSession
from security import utcnow

logger = logging.getLogger("rab.worker")


def enqueue(func, *args) -> None:
    client = get_redis_raw()
    if client is None:
        func(*args)
        return
    try:
        from rq import Queue

        Queue("rab", connection=client).enqueue(
            func,
            *args,
            retry=Retry(max=3, interval=[10, 60, 180]),
            job_timeout=120,
        )
    except Exception:
        logger.exception('{"event":"enqueue_failed","job":"%s"}', getattr(func, "__name__", "job"))
        func(*args)


def send_email(to_addr: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from or not to_addr:
        logger.info('{"event":"email_skipped","reason":"smtp_unconfigured"}')
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_addr
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    logger.info('{"event":"email_sent"}')


def send_reset_email(to_addr: str, reset_url: str) -> None:
    send_email(
        to_addr,
        "Password reset",
        "A password reset was requested for your mess desk account.\n\n"
        f"Open this link within one hour:\n{reset_url}\n\n"
        "If you did not request this, ignore the message.",
    )


def purge_expired_tokens() -> None:
    db = SessionLocal()
    try:
        now = utcnow()
        db.query(PasswordReset).filter(PasswordReset.expires_at < now).delete(synchronize_session=False)
        db.query(RefreshSession).filter(RefreshSession.expires_at < now).delete(synchronize_session=False)
        db.commit()
        logger.info('{"event":"token_purge_ok"}')
    except Exception:
        db.rollback()
        logger.exception('{"event":"token_purge_failed"}')
        raise
    finally:
        db.close()


def touch_worker() -> None:
    worker_heartbeat()
