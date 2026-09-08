"""Enqueue jl_inactivate at 00:05 Asia/Dhaka. `python -m app.jobs.beat`."""

import logging
import time
from datetime import datetime, timedelta

from redis.exceptions import RedisError

from app.config import get_settings
from app.domain.dates import tz
from app.logging import setup_logging
from app.redis_client import get_redis

setup_logging()
log = logging.getLogger("app.jobs")


def _next_run() -> datetime:
    now = datetime.now(tz())
    target = now.replace(hour=0, minute=5, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return target


def main() -> None:
    redis = get_redis()
    log.info("beat started tz=%s", get_settings().tz)
    while True:
        target = _next_run()
        wait = max(1.0, (target - datetime.now(tz())).total_seconds())
        log.info("next jl_inactivate at %s (sleep %.0fs)", target.isoformat(), wait)
        time.sleep(min(wait, 60))
        now = datetime.now(tz())
        try:
            zk_stamp = now.replace(second=0, microsecond=0).strftime("%Y%m%d%H%M")
            if redis.set(f"beat:zk:{zk_stamp}", "1", nx=True, ex=90):
                redis.lpush("q:jobs", "zk_poll")
        except RedisError:
            log.warning("beat zk enqueue failed", exc_info=True)
        try:
            if now.hour == 2 and now.minute == 0:
                if redis.set(f"beat:backup:{now.date().isoformat()}", "1", nx=True, ex=26 * 3600):
                    redis.lpush("q:jobs", "backup")
                    log.info("enqueued backup")
            if now.weekday() == 6 and now.hour == 3 and now.minute == 0:
                if redis.set(f"beat:docs_gc:{now.date().isoformat()}", "1", nx=True, ex=26 * 3600):
                    redis.lpush("q:jobs", "docs_gc")
                    log.info("enqueued docs_gc")
        except RedisError:
            log.warning("beat ops enqueue failed", exc_info=True)
        if now.hour != 0 or now.minute != 5:
            continue
        stamp = now.date().isoformat()
        marker = f"beat:jl:{stamp}"
        try:
            if not redis.set(marker, "1", nx=True, ex=26 * 3600):
                continue
            redis.lpush("q:jobs", "jl_inactivate")
            log.info("enqueued jl_inactivate for %s", stamp)
        except RedisError:
            log.warning("beat enqueue failed", exc_info=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
