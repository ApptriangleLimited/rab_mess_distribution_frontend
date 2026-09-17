# Observability

## Signals

| Signal | Where |
| ------ | ----- |
| Structured JSON request logs + `X-Request-ID` | API stdout (`rab.api`) |
| Worker job logs | `srb_worker` stdout |
| Nginx access/error | `srb_proxy` |
| Container health | `docker compose ps` + `/health/live` `/health/ready` |
| Postgres | `pg_isready` inside `srb_database` |
| Redis | `redis-cli ping` (with `-a` when `REDIS_PASSWORD` is set) |
| Disk | `df -h` on the host; Docker volume usage |

Secrets (`password`, tokens, OTP, Redis URLs) are stripped from API logs.

## Investigations

| Symptom | First checks |
| ------- | ------------ |
| HTTP 500 | API log `unhandled_exception` + `x-request-id` |
| Failed login | `audit_logs` action `LOGIN_FAIL`; Redis rate-limit keys `rab:rl:login:*` |
| Worker failure | `docker logs srb_worker`; Redis `rab:worker:heartbeat` |
| DB unavailable | `/health/ready` `database=down`; `docker logs srb_database` |
| Redis unavailable | `/health/ready` `redis=down`; confirm password and private network |
| Disk full | host `df`; Docker `docker system df` |
| High CPU/memory | `docker stats` |
| Failed migration | API/worker start logs; `alembic current` inside the api container |

Worker heartbeat is optional for readiness in development. Production readiness requires Postgres and Redis.
