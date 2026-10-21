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


def _wait_for_redis(attempts: int = 15, delay: float = 2.0):
    for attempt in range(1, attempts + 1):
        client = get_redis_raw()
        if client is not None:
            return client
        logger.warning(
            '{"event":"redis_wait","attempt":%s,"of":%s}',
            attempt,
            attempts,
        )
        time.sleep(delay)
    raise SystemExit("Redis is unavailable; worker cannot start")


def main() -> None:
    client = _wait_for_redis()
    logger.info('{"event":"worker_start","redis":"%s"}', redis_log_target())
    threading.Thread(target=_heartbeat_loop, name="rq-heartbeat", daemon=True).start()
    queue = Queue("rab", connection=client)
    queue.enqueue(purge_expired_tokens, job_timeout=60)
    Worker([queue], connection=client).work(logging_level="INFO")


if __name__ == "__main__":
    main()
