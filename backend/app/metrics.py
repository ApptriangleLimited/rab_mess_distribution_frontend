import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

HTTP_REQUESTS = Counter(
    "http_requests_total",
    "HTTP requests",
    ["method", "handler", "status"],
)
HTTP_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["method", "handler"],
)
ASSIGNMENT_WRITES = Counter(
    "mess_assignment_writes_total",
    "Assignment paint / clear / range writes",
    ["result"],
)
DAY_APPROVES = Counter(
    "mess_day_approves_total",
    "Day approve attempts",
    ["result"],
)
DAY_APPROVE_FILL = Histogram(
    "mess_day_approve_fill_count",
    "Members filled when a day is approved",
)
TAG_REQUESTS_PENDING = Gauge(
    "mess_tag_requests_pending",
    "Open tag requests",
    ["queue"],
)
TAG_REQUEST_APPLY = Counter(
    "mess_tag_request_apply_total",
    "Tag-request apply attempts",
    ["queue", "result"],
)
JOB_DURATION = Histogram(
    "mess_job_duration_seconds",
    "Background job duration",
    ["job"],
)
JL_INACTIVATIONS = Counter(
    "mess_jl_inactivations_total",
    "Members inactivated by the JL job",
)
ZK_UP = Gauge(
    "mess_zk_up",
    "1 if last ZK poll reached the device",
)
ZK_INGEST = Counter(
    "mess_zk_ingest_total",
    "Kitchen punch ingest results",
    ["status"],
)
MONTH_CLOSED = Gauge(
    "mess_month_closed",
    "1 if the month is closed for assignment writes",
    ["month"],
)
JOB_DEAD = Counter(
    "mess_job_dead_total",
    "Background jobs that raised",
)
DB_UP = Gauge("mess_db_up", "1 if last health probe reached Postgres")
REDIS_UP = Gauge("mess_redis_up", "1 if last health probe reached Redis")


def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path == "/metrics":
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        handler = request.url.path
        HTTP_REQUESTS.labels(request.method, handler, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.method, handler).observe(time.perf_counter() - start)
        return response
