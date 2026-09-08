# RAB Mess Distribution — System Design

Runtime architecture for the FastAPI backend. HTTP shapes stay in [api-design.md](./api-design.md). Domain + phases stay in [backend-plan.md](./backend-plan.md). This doc answers **how it runs, fails, locks, and is observed**.

| | |
|---|---|
| Stack | FastAPI · PostgreSQL 16 · Redis 7 · Prometheus · Docker Compose |
| Scope | Single HQ, single mess. ~500–2 000 members. ~10 concurrent staff desks. |
| Clock | `Asia/Dhaka` for all “today” / day-lock / JL / meal-window decisions |
| Date | 2026-09-08 |

---

## 1. Goals and non-goals

**Must**

- Source of truth is Postgres, not browser `localStorage`.
- Money reprints the same after a rate change **if the month is closed**.
- Two Daily clerks cannot corrupt the same day (approve vs paint).
- Public register cannot flood the roster.
- Ops can see latency, errors, queue depth, and DB health without SSH.

**Must not (v1)**

- Multi-tenant / multi-battalion.
- Kubernetes. Compose is enough for one HQ VM or a small swarm later.
- Kafka / event sourcing. Redis lists + Postgres outbox cover the job volume.
- Server-side PDF. Browser `jspdf` stays.

**Bound:** 2 000 members × 31 days ≈ 62 k projected cells / month GET. Payload OK. If HQ grows past ~5 k, page assignments by `member_id`.

---

## 2. Context

```
                    ┌─────────────┐
   Staff browsers   │  Next.js    │  /api/v1/* rewrite
   + public QR  ───►│  frontend   │──────────────┐
                    └─────────────┘              │
                                                 ▼
                                      ┌──────────────────┐
                                      │  FastAPI (uvicorn│
                                      │  × N workers)    │
                                      └─┬──────┬───────┬─┘
                                        │      │       │
                           �─┬──────┬───────┬─┘
                                        │      │       │
                           ┌────────────┘      │       └────────────┐
                           ▼                   ▼                    ▼
                    ┌────────────┐      ┌───────────┐        ┌────────────┐
                    │ PostgreSQL │      │   Redis   │        │  MinIO/FS  │
                    │  primary   │      │ cache+Q+  │        │  docs      │
                    └────────────┘      │ lock+RL   │        └────────────┘
                                        └─────┬─────┘
                                              │ scrape
                    ┌────────────┐      ┌─────▼─────┐
                    │  worker    │◄─────│ Prometheus│
                    │  (same     │      │ + Grafana │
                    │   image)   │      └───────────┘
                    └────────────┘
                         │
                         ▼
                    ZKTeco (optional, demo / LAN)
```

Frontend already proxies `/api/v1` → `API_PROXY_URL` (prod default in `Dockerfile`: `http://api.ms.apptriangle.com`). Backend never serves the Next UI.

---

## 3. Containers

One Compose project. Same FastAPI image, two commands.

| Service | Image role | Ports (internal) | Why |
|---|---|---|---|
| `api` | uvicorn `--workers 2` | 8000 | Stateless HTTP |
| `worker` | ARQ / RQ consumer | — | JL, ZK ingest, outbox |
| `beat` | ARQ cron / RQ scheduler | — | Nightly 00:05 Dhaka |
| `db` | postgres:16 | 5432 | Source of truth |
| `redis` | redis:7-alpine | 6379 | Cache, queue, lock, JWT denylist, rate limit |
| `prometheus` | prom/prometheus | 9090 | Scrape `api:8000/metrics` |
| `grafana` | grafana/grafana (optional) | 3001 | Dashboards |
| `minio` | minio (optional v1: local volume) | 9000 | Member documents |
| `web` | existing Next image | 3000 | This repo |

Networks: `frontend` (web↔api), `backend` (api/worker↔db/redis/minio). Only `web` + `api` published.

Restart: `unless-stopped`. Healthchecks: `api GET /api/v1/health`, `db pg_isready`, `redis redis-cli ping`.

---

## 4. Why this stack

| Pick | Job | Reject |
|---|---|---|
| **FastAPI** | Envelope + OpenAPI already assumed by FE | Django = heavier; Node API = second language for no gain |
| **Postgres** | Relational integrity, `NUMERIC`, range dates, `FOR UPDATE` | SQLite = no concurrency; Mongo = money + unique days hurt |
| **Redis** | Sub-ms locks, rate limit, job queue, JWT denylist | Second Postgres for queue = worse latency; RabbitMQ = ops cost at this scale |
| **Prometheus** | Pull metrics, no agent on each box | Push-only SaaS later if they buy Datadog |
| **Docker Compose** | One HQ VM | K8s when they have a second site or 24/7 SRE |

Python 3.12, SQLAlchemy 2, Alembic, Pydantic v2, `asyncpg` **or** sync `psycopg` + threadpool. Pick **one** IO model and stick:

**v1 recommendation:** sync SQLAlchemy + uvicorn workers (2–4). Simpler transactions. Async later if ZK poll blocks.

Worker **must not** share uvicorn process. HTTP + 30s ZK I/O on the same loop = Daily cockpit stalls.

---

## 5. Postgres as source of truth

### 5.1 Principles

- One row per fact. No `AppState` JSON blob.
- Money columns: `NUMERIC(12,2)` **never** `float`/`double`.
- API may still emit JSON numbers (locked client). Server math uses `Decimal`, quantize `0.01` (ROUND_HALF_UP) = `roundPaisa`.
- Timestamps `timestamptz` UTC. Calendar dates `date` (no tz).
- Soft rules (`ended`, inactive spans) over DELETE of members.
- `updated_at` on every mutable row. Optimistic check on member PUT: `If-Match` optional v2; v1 last-write-wins except §6 locks.

### 5.2 Critical uniqueness

```
members.rab_id                         UNIQUE  (citext)
members.personal_id                    UNIQUE  WHERE personal_id <> ''
assignments (member_id, date)          UNIQUE
suppressed_carries (member_id, date)   PK
approved_days (date)                   PK
boro_khana_dates (date)                PK
tag_requests one open per (user_id, queue)
  UNIQUE (user_id, queue) WHERE status = 'requested'
meal_plans (date)                      UNIQUE
staff.email                            UNIQUE  (citext)
closed_months (month)                  PK      -- YYYY-MM
```

Partial unique on open tag-requests is the race fix: two POST duty requests cannot both insert `requested`.

### 5.3 Indexes (beyond PK)

```
assignments (date)
assignments (member_id, date)          -- already unique
members (approval_status, status)
members (wing, rank)
tag_requests (queue, status, requested_at DESC)
state_reports (date, status)
meal_assigns (date, shift_id, member_id)
audit_events (at DESC)
audit_events (entity_type, entity_id)
```

`q` search v1: `ILIKE` on `name`, `rab_id`, `phone`. At 2 k rows this is fine. Add `pg_trgm` GIN only after p95 list > 200 ms.

### 5.4 Migrations

Alembic in the API image. **Compose `api` depends_on db + migrate job:**

```
api-migrate:
  command: alembic upgrade head
  restart: "no"
```

`api` starts only after migrate exit 0. Never auto-migrate from a running worker.

---

## 6. Consistency and locking

Two clerks, one day. That is the hard concurrency in this product.

### 6.1 Day paint vs approve

**Invariant:** a date is either unlocked (paintable) or in `approved_days`. Paint **always allowed** and **deletes** the lock (matches current UI). Approve fills empty/suppressed cells then inserts the lock.

**Txn (approve):**

```
BEGIN;
SELECT 1 FROM approved_days WHERE date = $d FOR UPDATE;  -- or try insert later
-- lock all assignment rows for $d
SELECT * FROM assignments WHERE date = $d FOR UPDATE;
-- lock member rows that will be filled
SELECT * FROM members WHERE id = ANY($ids) FOR UPDATE;
-- insert missing assignments from default_tag
-- delete suppressed_carries for those pairs
INSERT INTO approved_days … ON CONFLICT DO NOTHING;
COMMIT;
```

**Txn (paint / clear):**

```
BEGIN;
DELETE FROM approved_days WHERE date = $d;          -- unlock
INSERT/UPDATE/DELETE assignments …;
INSERT/DELETE suppressed_carries …;
-- MFR / JL side effects on members
COMMIT;
```

No Redis lock required for correctness. Redis lock (`SET day:{date} NX PX 5000`) is **optional** to fail fast before hitting DB under double-click. DB txn is the authority.

### 6.2 Tag-request apply

```
BEGIN;
SELECT * FROM tag_requests WHERE id=$id AND status='requested' FOR UPDATE;
-- if 0 rows → 409 NOT_PENDING
-- paint range (same as assignment range, same day-unlock)
UPDATE tag_requests SET status='updated', …;
COMMIT;
```

Partial unique index stops two open rows. Apply uses row lock so double-click apply → one winner, one `NOT_PENDING`.

### 6.3 State-report submit

```
DELETE pending WHERE date=$d;  -- inside txn
INSERT new pending snapshot;
```

Snapshot JSON is frozen. Review does not recompute.

### 6.4 Month close (money integrity)

Live `GET /reports/*` is OK while month **open**. After Ration prints BEFTN, edits must not silently change ৳.

```
closed_months
  month PK          -- 2026-08
  closed_at, closed_by
  consume_snapshot JSONB   -- optional v1: skip, recompute from rates_as_of
  rates_snapshot JSONB     -- tag → amount at close
```

| Month state | Assignment write | Rate write | Report GET |
|---|---|---|---|
| open | allow | allow | live compute |
| closed | **403 `MONTH_CLOSED`** except admin `?force=1` (audited) | 403 | compute with **rates_snapshot** if present, else live + warn header |

v1 minimum: `closed_months` + reject writes. Snapshot JSON can wait one release. Without this, “senior money” is fake.

`POST /months/{month}/close` — ration, admin.  
`POST /months/{month}/reopen` — admin only, audit.

Add these two routes to the API in the same envelope (not in the locked client yet).

### 6.5 Isolation level

Default `READ COMMITTED` + explicit `FOR UPDATE` on the rows above. Do not set session `SERIALIZABLE` globally (unnecessary retries on reads).

---

## 7. Redis map

One Redis, key prefixes, DB 0. Persistence: `appendonly yes` in prod (denylist + queue). Dev: snapshot OK.

| Prefix | Type | TTL | Purpose |
|---|---|---|---|
| `sess:deny:{jti}` | string | until JWT `exp` | Logout denylist |
| `rl:login:{ip}` | incr | 15m | Login brute force |
| `rl:login:{email}` | incr | 15m | |
| `rl:reg:{ip}` | incr | 1h | Public register |
| `lock:day:{date}` | string NX | 5s | Fail-fast day mutex |
| `lock:job:{name}` | string NX | 10m | Single nightly JL |
| `cache:catalog` | string JSON | 60s | Org catalog GET |
| `cache:rates` | string JSON | 30s | Rates GET |
| `q:jobs` | list / ARQ | — | Worker queue |
| `q:dead` | list | 14d | Poison jobs |

**Do not** cache assignments or reports in v1. Invalidate bugs > CPU saved at this scale.

**Do not** store members in Redis. PII stays in Postgres.

Cache invalidation: any Settings write `DEL cache:catalog cache:rates`.

JWT: stateless signed tokens. Logout writes `sess:deny:{jti}`. `api` middleware: decode → Redis `EXISTS` → 401. If Redis down: **fail open for deny** (still accept valid JWT) + Prometheus `redis_down`. Login rate-limit: **fail closed** if Redis down (503 `RATE_LIMITED` / `REDIS_UNAVAILABLE`) — safer than open flood.

---

## 8. Jobs (worker + beat)

| Job | Trigger | Idempotent? | Fail |
|---|---|---|---|
| `jl_inactivate` | Daily 00:05 Asia/Dhaka | Yes — members already `status=0` skip | Retry 3× / 5m |
| `zk_poll` | Every 60s if `ZK_DEMO` or prod flag | Ingest unique on `(member, shift, date, punched_at)` | Backoff; `zk_up=0` |
| `zk_ingest` | Queue from poll | Same unique | Dead letter |
| `outbox_publish` | Every 2s | Outbox `sent_at` | Retry |

**JL job (must match store):** for each member with `jl_end_date < today` or last JL assignment date < today → `status=0`, open inactive span from day after last JL, clear `jl_end_date`, delete assignments on inactive dates. One txn per member (or batches of 100). Redis `lock:job:jl_inactivate` so two beats cannot run.

**Outbox (v1 light):** table `outbox (id, topic, payload, created_at, sent_at)`. Use later for “notify Consume desk”. v1 can skip topic consumers; keep the table so you do not rewrite.

Worker library: **ARQ** (async Redis) or **RQ** (sync). Match API IO model. RQ + sync SQLAlchemy = less pain.

---

## 9. Files

v1: Docker volume `/data/docs/{member_id}/{uuid}_{filename}`.  
v1.1: MinIO bucket `mess-docs`, path same.

- Max 8 MB; PDF/JPEG/PNG.
- Store `url` as `/api/v1/files/{id}` — API streams after auth. **No public bucket URLs.**
- Signed GET TTL 5 min if MinIO.
- Orphan GC weekly: objects with no `member_documents` row.

---

## 10. Security

### 10.1 AuthN

- Argon2id passwords (`passlib` / `pwdlib`).
- JWT HS256 v1 (secret from env). RS256 when a second service appears.
- Claims: `sub`, `role`, `jti`, `exp`. `expires_in=28800`.
- HTTPS at reverse proxy (Caddy/nginx) in front of Compose. API itself HTTP on the Docker net.

### 10.2 AuthZ

Enforce [api-design.md](./api-design.md) role table on **writes**. GET mostly `staff`. Catalog writes: **ration + admin** (tighten vs current Settings UI).

Dependency: `require_roles("daily", "admin")`.

### 10.3 Abuse

| Surface | Limit |
|---|---|
| `POST /auth/login` | 10 / 15m / IP; 5 / 15m / email |
| `POST /public/register` | 5 / h / IP; 20 / h global |
| Upload | 8 MB + mime sniff |

After v1: signed QR `token` (HMAC, 7d) on `/public/register?token=`.

### 10.4 PII

NID, phone, bank on `members`. TLS in transit. DB disk encryption if the VM host offers it. Audit every bank PATCH and member export. No member list in Prometheus labels.

### 10.5 Secrets

`.env` not in image. Compose `env_file`. Rotate `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`. Redis requirepass in prod.

---

## 11. Observability (Prometheus)

### 11.1 Expose

`GET /metrics` — **not** under the JSON envelope. Protect with network policy (scrape only from Prometheus) or basic auth. Do **not** require staff JWT (scrape breaks).

Stack: `prometheus_fastapi_instrumentator` + custom `Counter`/`Histogram`/`Gauge`.

### 11.2 RED on HTTP

Default instrumentator already gives:

- `http_requests_total{handler,method,status}`
- `http_request_duration_seconds{handler,method}`

SLOs (alert when burned):

| SLO | Target |
|---|---|
| API availability | 99.5% / 30d (HQ, not public SaaS) |
| `GET /assignments` p95 | < 800 ms (month view) |
| `PUT /assignments` p95 | < 300 ms |
| `GET /reports/ration/{month}` p95 | < 2 s |
| Error ratio 5xx | < 1% / 15m |

### 11.3 Domain metrics (must have)

```
mess_assignment_writes_total{result}          # ok | mfr_locked | inactive | month_closed
mess_day_approves_total{result}
mess_day_approve_fill_count                   # histogram of `filled`
mess_tag_requests_pending{queue}              # gauge, refresh 15s
mess_tag_request_apply_total{queue,result}
mess_month_closed{month}                      # gauge 0/1 — or info metric
mess_jl_inactivations_total
mess_zk_up                                    # 1/0
mess_zk_ingest_total{status}                  # 1 unique / 2 dup / error
mess_job_duration_seconds{job}
mess_job_dead_total{job}
mess_register_rejected_total{reason}
```

DB: `pg_stat_statements` + `postgres_exporter` sidecar (optional v1; add when queries get slow).

Redis: `redis_exporter` or `INFO` gauges: `connected_clients`, `used_memory`, queue length `LLEN q:jobs`.

### 11.4 Logs

JSON stdout: `time, level, request_id, staff_id, role, path, status, ms, code`.

`X-Request-ID`: take inbound or generate UUID. Echo header. Put on every log line. **Not** in the JSON envelope v1 (client does not read it). Add later as `meta.request_id` if needed.

Never log `password`, `access_token`, full NID, full account_number. Mask `****5678`.

### 11.5 Tracing

v1 skip OpenTelemetry. Add FastAPI + SQLAlchemy instrumentation when p95 unexplained. One HQ VM: logs + RED enough.

### 11.6 Health

`GET /api/v1/health` (already specified):

```json
{ "status": "ok|degraded", "time": "…", "db": "ok|down", "redis": "ok|down" }
```

- `db` down → `status=degraded`, HTTP **503** (k8s/compose should restart? **no** — proxy can keep serving 503; liveness is separate).
- `GET /api/v1/live` — process up, no deps. Compose healthcheck uses `/live`.
- `GET /api/v1/ready` — db ping + redis ping. Load balancer uses `/ready`.

---

## 12. Prometheus scrape

`prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:8000"]
  - job_name: redis
    static_configs:
      - targets: ["redis-exporter:9121"]
```

Alert rules (load into Prometheus):

- `SLOErrorBudget` — 5xx ratio > 2% / 10m
- `AssignmentsP95` — histogram quantile > 1s / 10m
- `RedisDown` — `up{job="redis"}==0` for 2m
- `PostgresDown` — health `db=down` via recording rule or blackbox on `/ready`
- `JobDeadLetter` — `increase(mess_job_dead_total[1h]) > 0`
- `ZkDown` — `mess_zk_up==0` for 15m (only if ZK enabled)
- `PendingRequestsStuck` — `mess_tag_requests_pending > 0` for 48h (desk asleep)

Grafana: one dashboard — QPS, p95, 5xx, pending requests by queue, ZK, job duration, Redis memory.

---

## 13. Capacity (one HQ)

| Resource | Size | Headroom |
|---|---|---|
| Members | 2 000 | 10 k before search work |
| Assignments / year | 2 000 × 365 ≈ 0.7 M | Postgres trivial |
| Audit / year | ~2–5× writes | Partition by month if > 20 M |
| API | 2 workers × 1 CPU | 4 workers if reports + cockpit overlap |
| DB | 2 GB RAM, 20 GB disk | 50 GB comfortable 5y |
| Redis | 256 MB | queue + denylist tiny |

No read replica v1. Backup is the HA story.

---

## 14. Failure modes

| Failure | User sees | System does |
|---|---|---|
| API process die | 502 via Next proxy | Compose restart; JWT still valid |
| Postgres down | 503 `INTERNAL` / ready fail | Writes stop. No split-brain. |
| Redis down | Login may 503 (rate-limit fail closed). Logout denylist skipped. Jobs pause. | HTTP reads still work. Cache miss → DB. |
| Worker die | JL waits until next night; ZK stale | Beat re-queues; `mess_zk_up` alerts |
| Disk full (docs) | 500 on upload | Alert disk %; assignments still work |
| Clock skew | Wrong “today” | NTP on VM; app uses zoneinfo `Asia/Dhaka` not container UTC date |
| Double approve click | Second `{ filled: 0, locked: true }` | Idempotent |
| Replay ingest | `status=2` or unique no-op | Unique punch key |

**Backup**

- Postgres: daily `pg_dump` to volume + weekly retain 4. RPO ~24h. If finance needs better: WAL archive hourly (RPO ~1h).
- Redis: AOF — lose seconds of denylist/queue. Re-login on mystery 401 after Redis wipe is OK.
- Docs volume: rsync with DB dump.

Restore drill once before go-live. Document in runbook (out of this file).

---

## 15. Deployment

```
                    Internet
                       │
                   ┌───▼────┐
                   │ Caddy  │  TLS, / → web:3000, /api/v1 → api:8000
                   └───┬────┘
                       │
              Docker Compose network
```

Env (API):

```
DATABASE_URL=postgresql+psycopg://mess:…@db:5432/mess
REDIS_URL=redis://:pass@redis:6379/0
JWT_SECRET=…
JWT_EXPIRES_IN=28800
TZ=Asia/Dhaka
SEED_STAFF_PASSWORD=ChangeMe!     # prod: disable seed or force rotate
ZK_ENABLED=0
PROM_ENABLE=1
```

Frontend already: `NEXT_PUBLIC_USE_API=true`, `API_PROXY_URL=http://api:8000` **inside Compose** (not the public hostname). Browser talks to Next; Next rewrites to `api`.

Rollout:

1. `alembic upgrade`  
2. start redis, db, api, worker, beat, prometheus  
3. seed staff + catalog  
4. flip `NEXT_PUBLIC_USE_API`  
5. close previous month after first real payout  

No blue/green v1. Compose `up -d --no-deps api` + health `/ready`.

---

## 16. Audit

```
audit_events
  id, at, staff_id, role, action, entity_type, entity_id
  before JSONB, after JSONB
  request_id, ip
```

Write **in the same txn** as the mutation (not a Redis fire-and-forget). If audit insert fails, the write fails.

Must audit: member approve/reject/end, bank patch, assignment paint/clear, day approve, tag-request apply/reject, rate change, month close/reopen, sender CRUD, BK toggle.

Retain 7 years (finance). Partition by `at` month when large.

---

## 17. Testing the design

| Layer | What |
|---|---|
| Contract | pytest + httpx against **LOCKED** `src/lib/api/*.ts` shapes |
| Concurrency | two threads: approve + paint same date; assert one lock story |
| Money | Decimal fixtures: FR days × rate + FUEL; CLFR monthly not × days |
| Month close | write after close → 403 |
| Jobs | JL: last JL yesterday → inactive today |
| Rate limit | 11th login → 429 |

CI: `api` image + `postgres:16` + `redis:7` services. Prometheus not required in CI.

---

## 18. Build order (systems, not features)

Matches product phases but adds platform work **first**.

| Slice | Ship |
|---|---|
| S0 | Compose: api, db, redis, prometheus. `/live` `/ready` `/metrics` `/health`. Alembic empty. |
| S1 | Auth + denylist + login RL. Seed staff. |
| S2 | Members + catalog + rates + senders. Audit hook. Cache catalog. |
| S3 | Assignments + **txn locks** + day approve + BK. Concurrency test. |
| S4 | Tag requests (partial unique + FOR UPDATE). Worker + JL job. |
| S5 | Mess + kitchen + ZK ingest unique. `mess_zk_*` metrics. |
| S6 | Reports live + **`closed_months`**. Alert on 5xx + p95. |
| S7 | Grafana + backup cron + restore drill. |

Do not start S6 money letters without S6 close. That was the hole.

---

## 19. Decision log

| Decision | Choice | Revisit when |
|---|---|---|
| Sync API + RQ worker | Simpler txns | p95 idle wait on ZK-in-request (ZK never on request path) |
| Redis fail-open on JWT deny | Availability | Compliance says logout must be instant → fail closed |
| No assignment cache | Correctness | Month GET > 800 ms p95 → cache open-month cells 10s |
| NUMERIC + Decimal | Money | Never switch to float |
| Month close table | Integrity | Need reprint-exact → add JSON snapshot |
| Compose not K8s | Ops size | Second site or >1 API host |
| Prometheus pull | Ops size | Hosted Grafana Cloud later |

---

## 20. What “done” means for this design

- Compose file exists; `GET /metrics` scraped; Grafana shows RED + pending queues.
- Approve vs paint race covered by a test, not a comment.
- `closed_months` blocks last-month paint after payout.
- JL runs at 00:05 Dhaka behind a Redis lock; metric increments.
- Redis outage: reads live, login limited, jobs pause, alert fires.
- Daily `pg_dump` + one successful restore.

HTTP details stay in [api-design.md](./api-design.md). Add `POST /months/{month}/close|reopen` there when implementing S6.
