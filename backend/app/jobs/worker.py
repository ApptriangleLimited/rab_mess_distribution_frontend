"""Consume `q:jobs`. `python -m app.jobs.worker` or `--once jl_inactivate`."""

import logging
import time

from redis.exceptions import RedisError

from app.jobs.jl import run_jl_inactivate
from app.jobs.zk import run_zk_poll
from app.logging import setup_logging
from app.metrics import JOB_DEAD
from app.redis_client import get_redis
from app.services.backup import run_backup, run_docs_gc

setup_logging()
log = logging.getLogger("app.jobs")
JOBS = {
    "jl_inactivate": run_jl_inactivate,
    "zk_poll": run_zk_poll,
    "backup": run_backup,
    "docs_gc": run_docs_gc,
}


def run_named(name: str) -> int:
    job = JOBS.get(name)
    if job is None:
        log.warning("unknown job %s", name)
        return 0
    try:
        return int(job() or 0)
    except Exception:
        JOB_DEAD.inc()
        log.exception("job %s failed", name)
        return 0


def main(argv: list[str] | None = None) -> None:
    import sys

    args = argv if argv is not None else sys.argv[1:]
    if args[:1] == ["--once"]:
        name = args[1] if len(args) > 1 else "jl_inactivate"
        n = run_named(name)
        print(f"{name} flipped={n}")
        return
    redis = get_redis()
    log.info("worker listening on q:jobs")
    while True:
        try:
            item = redis.brpop("q:jobs", timeout=5)
        except RedisError:
            time.sleep(2)
            continue
        if not item:
            continue
        _key, name = item if isinstance(item, (list, tuple)) else (None, item)
        run_named(str(name))


if __name__ == "__main__":
    main()
