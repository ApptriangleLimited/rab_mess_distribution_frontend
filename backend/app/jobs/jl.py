import logging
import time
from datetime import date

from redis.exceptions import RedisError

from app.db import get_session_factory
from app.domain.dates import today_dhaka
from app.metrics import JL_INACTIVATIONS, JOB_DURATION
from app.models.daily import Assignment
from app.models.member import Member
from app.redis_client import get_redis
from app.services.assignments import sync_after_jl

log = logging.getLogger("app.jobs")
LOCK_KEY = "lock:job:jl_inactivate"


def acquire_job_lock(ttl: int = 600) -> bool:
    try:
        return bool(get_redis().set(LOCK_KEY, "1", nx=True, ex=ttl))
    except RedisError:
        return True


def release_job_lock() -> None:
    try:
        get_redis().delete(LOCK_KEY)
    except RedisError:
        return


def run_jl_inactivate(as_of: date | None = None) -> int:
    as_of = as_of or today_dhaka()
    started = time.perf_counter()
    if not acquire_job_lock():
        log.info("jl_inactivate skipped, lock held")
        return 0
    session = get_session_factory()()
    flipped = 0
    try:
        ids = {m.id for m in session.query(Member).filter(Member.jl_end_date != "").all()}
        for (member_id,) in session.query(Assignment.member_id).filter(Assignment.tag == "JL").distinct():
            ids.add(member_id)
        for member_id in ids:
            member = session.get(Member, member_id)
            if member is None:
                continue
            before = member.status
            sync_after_jl(session, member, as_of)
            if before == "1" and member.status == "0":
                flipped += 1
        session.commit()
        JL_INACTIVATIONS.inc(flipped)
        return flipped
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        release_job_lock()
        JOB_DURATION.labels("jl_inactivate").observe(time.perf_counter() - started)
