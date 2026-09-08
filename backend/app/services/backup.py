"""SQL dump/restore for the restore drill. Postgres uses pg_dump in scripts/."""

import logging
import shutil
from pathlib import Path

from app.config import get_settings
from app.db import get_engine
from app.models import Base

log = logging.getLogger("app.jobs")


def backup_dir() -> Path:
    root = Path(get_settings().backup_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def dump_sql(path: Path | None = None) -> Path:
    dest = path or (backup_dir() / "mess-latest.sql")
    dest.parent.mkdir(parents=True, exist_ok=True)
    engine = get_engine()
    if engine.dialect.name != "sqlite":
        raise RuntimeError("dump_sql is for SQLite tests; use scripts/pg_backup.sh in Compose")
    raw = engine.raw_connection()
    try:
        dest.write_text("\n".join(raw.iterdump()), encoding="utf-8")
    finally:
        raw.close()
    return dest


def restore_sql(path: Path) -> None:
    engine = get_engine()
    if engine.dialect.name != "sqlite":
        raise RuntimeError("restore_sql is for SQLite tests; use scripts/pg_restore.sh in Compose")
    sql = Path(path).read_text(encoding="utf-8")
    Base.metadata.drop_all(engine)
    raw = engine.raw_connection()
    try:
        raw.executescript(sql)
        raw.commit()
    finally:
        raw.close()


def prune_backups(keep_days: int | None = None) -> int:
    from datetime import datetime, timedelta

    days = keep_days if keep_days is not None else get_settings().backup_keep_days
    cutoff = datetime.now() - timedelta(days=days)
    removed = 0
    for file in backup_dir().glob("mess-*"):
        try:
            mtime = datetime.fromtimestamp(file.stat().st_mtime)
        except OSError:
            continue
        if mtime < cutoff:
            file.unlink(missing_ok=True)
            removed += 1
    return removed


def run_backup() -> int:
    from datetime import datetime

    from app.metrics import JOB_DURATION

    started = __import__("time").perf_counter()
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    engine = get_engine()
    try:
        if engine.dialect.name == "sqlite":
            dump_sql(backup_dir() / f"mess-{stamp}.sql")
        elif shutil.which("pg_dump"):
            _pg_dump(backup_dir() / f"mess-{stamp}.dump")
        else:
            log.info("pg_dump missing; compose backup sidecar owns Postgres dumps")
            return 0
        prune_backups()
        return 1
    finally:
        JOB_DURATION.labels("backup").observe(__import__("time").perf_counter() - started)


def _pg_dump(dest: Path) -> None:
    import os
    import subprocess
    from urllib.parse import urlparse

    url = get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")
    parsed = urlparse(url)
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "pg_dump",
            "-Fc",
            "-h",
            parsed.hostname or "127.0.0.1",
            "-p",
            str(parsed.port or 5432),
            "-U",
            parsed.username or "mess",
            "-d",
            (parsed.path or "/mess").lstrip("/"),
            "-f",
            str(dest),
        ],
        check=True,
        env=env,
    )


def run_docs_gc() -> int:
    from app.db import get_session_factory
    from app.metrics import JOB_DURATION
    from app.models.member import MemberDocument

    started = __import__("time").perf_counter()
    root = Path(get_settings().docs_dir)
    if not root.exists():
        JOB_DURATION.labels("docs_gc").observe(__import__("time").perf_counter() - started)
        return 0
    session = get_session_factory()()
    try:
        kept = {Path(p).resolve() for (p,) in session.query(MemberDocument.storage_path).all() if p}
    finally:
        session.close()
    removed = 0
    for file in root.rglob("*"):
        if not file.is_file():
            continue
        if file.resolve() not in kept:
            file.unlink(missing_ok=True)
            removed += 1
    JOB_DURATION.labels("docs_gc").observe(__import__("time").perf_counter() - started)
    return removed
