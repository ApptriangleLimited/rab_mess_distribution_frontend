import logging
import threading
import time

from rq import Queue, Worker

from cache import get_redis_raw, redis_log_target, worker_heartbeat
from jobs import purge_expired_tokens

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("rab.worker")


def _heartbeat_loop() -> None:
    while True:
        worker_heartbeat()
        time.sleep(30)


def main() -> None:
    client = get_redis_raw()
    if client is None:
        raise SystemExit("Redis is unavailable; worker cannot start")
    logger.info('{"event":"worker_start","redis":"%s"}', redis_log_target())
    threading.Thread(target=_heartbeat_loop, name="rq-heartbeat", daemon=True).start()
    queue = Queue("rab", connection=client)
    queue.enqueue(purge_expired_tokens, job_timeout=60)
    Worker([queue], connection=client).work(logging_level="INFO")


if __name__ == "__main__":
    main()
