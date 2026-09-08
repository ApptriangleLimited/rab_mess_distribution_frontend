"""TCP reachability poll. Never runs on the API request path."""

import logging
import socket
import time

from app.config import get_settings
from app.constants import CACHE_ZK_STATUS, ZK_STATUS_TTL
from app.metrics import JOB_DURATION, ZK_UP
from app.services.cache import cache_set

log = logging.getLogger("app.jobs")


def run_zk_poll() -> int:
    settings = get_settings()
    host = (settings.zk_host or "").strip()
    port = int(settings.zk_port)
    started = time.perf_counter()
    reachable = False
    error = None
    latency_ms = 0
    if not host:
        error = "host unset"
    else:
        t0 = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=1.0):
                pass
            reachable = True
            latency_ms = int((time.perf_counter() - t0) * 1000)
        except OSError as exc:
            latency_ms = int((time.perf_counter() - t0) * 1000)
            error = str(exc) or "unreachable"
    cache_set(
        CACHE_ZK_STATUS,
        {
            "reachable": reachable,
            "host": host or settings.zk_host,
            "port": port,
            "latency_ms": latency_ms,
            "error": error,
        },
        ZK_STATUS_TTL,
    )
    ZK_UP.set(1 if reachable else 0)
    JOB_DURATION.labels("zk_poll").observe(time.perf_counter() - started)
    log.info("zk_poll reachable=%s host=%s port=%s", reachable, host, port)
    return 1 if reachable else 0
