# RAB Mess Distribution — Backend Implementation Plan

Phase plan for the FastAPI backend. Merges product work, HTTP contract, and runtime design.

| Source | Use for |
|---|---|
| [backend-plan.md](./backend-plan.md) | Domain, rules, RBAC, seed |
| [api-design.md](./api-design.md) | Paths, bodies, errors, LOCKED vs NEW |
| [system-design.md](./system-design.md) | Compose, Redis, locks, jobs, Prometheus, month close |

**Stack:** FastAPI · PostgreSQL 16 · Redis 7 · Prometheus · Docker Compose  
**Clock:** `Asia/Dhaka`  
**Repo:** new backend repo (this frontend only consumes `/api/v1`).

Do phases **in order**. Do not start money letters (P6) before month-close table. Do not put ZK I/O on the API process.

**LOCKED** = frontend already calls (`USE_API=true` breaks if you rename). Ship those first inside each phase.

---

## How to use this doc

Each phase has:

1. **Goal** — one sentence  
2. **Depends** — previous phase exit  
3. **Estimate** — one pair, HQ pace  
4. **Ship** — schema, Redis, metrics, routes  
5. **Rules** — port from frontend stores, do not re-invent  
6. **Tests** — must exist before exit  
7. **FE check** — screens to click with `NEXT_PUBLIC_USE_API=true`  
8. **Exit** — binary  
9. **Out** — explicitly later  

Tick lists are the work. If a row is not done, phase is not done.

---

## Phase map

```
P0 Platform ──► P1 Auth ──► P2 Roster/Settings ──► P3 Cockpit
                                                      │
                    P7 Harden ◄── P6 Money/close ◄── P5 Mess/ZK ◄── P4 Requests/JL
```

| Phase | Name | Est. | Unlocks FE |
|---|---|---|---|
| P0 | Platform | 3–5 d | — |
| P1 | Auth | 2–3 d | Login / logout |
| P2 | Members, catalog, rates, senders | 8–10 d | CC list/create, Settings rates/banks |
| P3 | Daily cockpit + member lifecycle | 10–12 d | `/daily/tags`, roster accept |
| P4 | Tag requests, state reports, JL job | 5–7 d | Request queues, Admin inbox |
| P5 | Mess kitchen + ZK | 7–8 d | Mess ledger, shifts, reports |
| P6 | Reports, month close, manpower, Pritibhoj, files | 8–10 d | Consume/ration print integrity |
| P7 | Harden + ops | 5–7 d | QR token, backup, Grafana |

**v1 backend ~7–9 weeks** one mid/senior. Two people: P2∥P0 leftovers, then P3 critical path.

---

## P0 — Platform

**Goal:** Process runs in Compose; deps probed; envelope + metrics exist; empty schema migrates.

**Code:** `backend/` in this repo (`compose.platform.yml`).

**Depends:** nothing.

### Ship

**Compose services:** `api`, `db` (postgres:16), `redis`, `prometheus`, `api-migrate` (alembic, `restart: no`).  
Later phases add `worker`, `beat`, `grafana`, `minio`.

**Routes**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/live` | Process up, no deps |
| GET | `/api/v1/ready` | Postgres + Redis ping |
| GET | `/api/v1/health` | `{ status, time, db, redis }` — [api-design.md](./api-design.md) §5 |
| GET | `/metrics` | Prometheus text, **no** JSON envelope |

**Code**

- Envelope middleware: success `{ ok: true, data }`; errors `{ ok: false, code, detail, errors[] }`
- `204` allowed (no body)
- `X-Request-ID` in / out; JSON logs (`time, level, request_id, path, status, ms`)
- `prometheus_fastapi_instrumentator` + empty custom registry
- Settings from env: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `TZ=Asia/Dhaka`
- SQLAlchemy 2 + Alembic; first revision empty or `alembic_version` only
- CORS only if browser hits API direct (Next rewrite = same origin; still allow local `localhost:3000`)

**Do not** start uvicorn with ZK or report code. Sync SQLAlchemy + workers=2.

### Tests

- `/live` → 200  
- `/ready` → 200 with both deps; 503 if db stopped  
- Error path returns envelope (`ok: false`)  
- `/metrics` includes `http_requests_total`

### FE check

None. Backend-only.

### Exit

`docker compose up` → migrate exit 0 → `/ready` 200 → Prometheus scrape `api:8000/metrics` succeeds.

### Out

Auth, tables, Grafana, MinIO.

---

## P1 — Auth

**Goal:** Six desks can log in; logout denylists JWT; login cannot be brute-forced.

**Code:** `backend/app/routers/auth.py`, `backend/alembic/versions/0002_p1_staff.py`.

**Depends:** P0 exit.

### Schema

```
staff (id, email citext UNIQUE, password_hash, display_name, role, active, created_at, updated_at)
```

Seed: `{role}@mess.rab` / `ChangeMe!` for `cc daily mess consume ration admin`. Argon2id.

### Redis

| Key | Use |
|---|---|
| `sess:deny:{jti}` | Logout, TTL = token remaining life |
| `rl:login:{ip}` | 10 / 15m — fail **closed** if Redis down |
| `rl:login:{email}` | 5 / 15m |

### Routes

| Method | Path | Status | Roles |
|---|---|---|---|
| POST | `/auth/login` | **LOCKED** | public |
| POST | `/auth/logout` | **LOCKED** | staff |
| GET | `/auth/me` | NEW | staff |

JWT HS256: `sub`, `role`, `jti`, `exp`. `expires_in=28800`. `token_type=bearer`.

Middleware: Bearer → decode → Redis deny → attach staff. Missing/bad → `401 UNAUTHORIZED`. Inactive staff → 401.

### Metrics

`http_*` enough. Optional `mess_register_rejected_total` later.

### Tests

- Seed login each role → `staff.role` exact  
- Bad password → `401 INVALID_CREDENTIALS` (same body if unknown email)  
- Logout then reuse token → 401  
- 11th login / IP → 429 `RATE_LIMITED`

### FE check

`NEXT_PUBLIC_USE_API=true` → `/login` with `daily@mess.rab` / `ChangeMe!` → lands `/daily/tags`. Logout clears token.

### Exit

All six seed accounts login. Locked login/logout shapes match `src/lib/api/auth.ts`.

### Out

`GET/POST /staff` (P7). Refresh tokens.

---

## P2 — Members, catalog, rates, senders

**Goal:** Roster + Settings persist. CC create/list and Settings rates/senders work against API.

**Depends:** P1.

### Schema

```
members
member_documents
member_emergency
member_inactive_spans
org_ranks, org_wings, org_forces
org_force_ranks, org_rank_equivalents, org_rank_force_wings
org_member_banks
authorized_strength
allowance_rates          tag PK, amount NUMERIC(12,2)
senders
audit_events             hook on writes (same txn)
```

Uniques: `members.rab_id` citext; `personal_id` unique where non-empty.

Seed from `src/lib/constants.ts`: `RANKS`, `WINGS`, `ADMIN_SUB_WINGS`, `HQ_SUB_WINGS`, `FORCES`, `FORCE_DEFAULT_RANKS`, `DEFAULT_AUTHORIZED`, `MEMBER_BANKS`, `DAILY_TAGS` rates (MS=180, other allowance=220), `FUEL=50`, `CLFR=2500`, 1–2 senders.

### Redis

`cache:catalog` 60s, `cache:rates` 30s. `DEL` both on any Settings write.

### Routes — LOCKED first

| Method | Path |
|---|---|
| POST | `/public/register` |
| GET / POST | `/members` |
| GET / PUT / POST / DELETE | `/settings/rates` |
| GET / POST / PUT / DELETE | `/senders` |

### Routes — NEW (same phase; FE can stay on localStorage for these)

| Method | Path |
|---|---|
| GET / PUT | `/members/{id}` |
| GET | `/settings/catalog` |
| POST / PATCH / DELETE | `/settings/ranks` `/wings` `/forces` … ([api-design.md](./api-design.md) §10) |
| GET / PUT | `/settings/authorized` |

Staff POST `/members`: honour `status`, `approval_status`. Public register: force `pending` + `status=0`. Ignore those fields if sent.

Member validation: [api-design.md](./api-design.md) §3 MemberEntry. Guests stripped. Civilian `rab_id` derive. Phone normalize. Bank clamp to catalog.

**Read `Member`:** include `force`, `religion`, `documents_verified`, `inactive_spans`, `jl_end_date` (additive). Do not invent spans in the API — persist them.

Status change on PUT: `applyStatusToSpans` ([backend-plan.md](./backend-plan.md) §6.1).

### Audit

Member create, rate change, sender CRUD, catalog write.

### Rate limit

`rl:reg:{ip}` 5/h; global 20/h on public register.

### Tests

- Public register → pending / status 0  
- Duplicate `rab_id` → 409 `CONFLICT` field `rab_id`  
- List filters `q status approval wing rank date_from date_to page`  
- PUT rates keeps `FUEL`+`CLFR`  
- DELETE protected rate → 409 `PROTECTED_RATE`  
- Catalog GET after rank add; cache miss after write  

### FE check

- `/cc/users` list + `/cc/users/new` create  
- Settings → Rates save; Senders add/edit  
- `/register` public form  

Edit/detail still local until P3 wires GET/PUT (or wire now if you finish GET/PUT here).

### Exit

LOCKED member list/create, public register, rates, senders match `src/lib/api/{members,register,settings}.ts`. Seed catalog present.

### Out

Approve/reject/end (P3). Document **bytes** (P6). Manpower absent (P6).

---

## P3 — Daily cockpit + member lifecycle

**Goal:** Month grid matches demo: carry, suppress, MFR, JL, TRG, BK, approve-day. Daily can accept/reject members.

**Depends:** P2. Members must have `default_tag`, spans, `jl_end_date`.

### Schema

```
assignments            UNIQUE (member_id, date); tag; trg_tone; updated_by/at
suppressed_carries     PK (member_id, date)
approved_days          PK (date)
boro_khana_dates       PK (date)
```

### Redis

Optional `lock:day:{date}` NX 5s — fail-fast only. **DB txn is authority** ([system-design.md](./system-design.md) §6.1).

### Routes — LOCKED

| Method | Path |
|---|---|
| GET | `/assignments` |
| GET | `/assignments/summary` |
| PUT | `/assignments` |
| PUT | `/assignments/range` |
| DELETE | `/assignments` |
| POST | `/days/{date}/approve` |
| GET | `/days/locks` |
| GET | `/boro-khana` |
| PUT | `/boro-khana/{date}` |

GET assignments: **projected** cells for every cockpit member × date (`stored|carry|suppressed|empty`). Require `month` or `from+to` or `date`.

### Routes — NEW

| Method | Path |
|---|---|
| POST | `/members/{id}/approve` |
| POST | `/members/{id}/reject` |
| POST | `/members/{id}/end` |
| PATCH | `/members/{id}/status` |
| PATCH | `/members/{id}/bank` |

Approve-with-tag: MS/MFR write today; FR/CD → will need tag-request in P4 — until P4, accept `today_tag` only if immediate (MS/MFR) or store intent and return 501 for FR/CD. **Better:** ship P4 apply tables in same week if Daily accept-with-CL is required. Minimum P3: approve without `today_tag` + immediate tags only.

### Rules (must port)

| Rule | Source |
|---|---|
| `canAssignOnDate` | `src/lib/store/daily.ts` |
| Carry = `default_tag`, not last paint | `assignments.ts` `findPriorTag` |
| Clear → suppress | DELETE assignment |
| Approve day → fill default, lock | `approveCarryForward` |
| Paint → unlock day | delete `approved_days` |
| MFR lock; FR unlocks | `daily.ts` |
| JL → `jl_end_date`; next day inactive | `syncUserAfterJl` (full job P4) |
| TRG tone from force | `src/lib/trg-tone.ts` |
| Guests off cockpit | `isCockpitMember` |

**Txn approve / paint:** [system-design.md](./system-design.md) §6.1. Isolation `READ COMMITTED` + `FOR UPDATE`.

Money still live. No `closed_months` yet — do not close months until P6.

### Metrics

```
mess_assignment_writes_total{result}
mess_day_approves_total{result}
mess_day_approve_fill_count
```

### Tests

- Two threads: approve + paint same date — final state valid (either locked with fills, or unlocked with paint; no lost row)  
- MFR member + tag CL → 409 `MFR_LOCKED`  
- Inactive / before join → 409 `INACTIVE_DATE`  
- GET month: stored / carry / suppressed / empty all appear  
- Approve twice → `{ filled: 0, locked: true }`  
- Projection excludes guests  

### FE check

`/daily/tags` month: paint, clear, approve day, BK toggle. `/daily/roster` accept/reject. `/cc/users` still lists.

### Exit

LOCKED assignment/day/BK clients work. Grid behaviour matches demo for MS/CL/MFR/FR/JL/TRG.

### Out

Tag-request queues (P4). Nightly JL for “yesterday’s JL” (inline sync on write is enough for same-request; beat in P4). Mess eaters (P5) can wait — or implement eaters early if Mess desk blocked (uses same projection + BK).

---

## P4 — Tag requests, state reports, JL worker

**Goal:** CC→Daily and Daily→Ration/Consume queues. Admin reviews frozen state reports. JL runs at 00:05 Dhaka.

**Depends:** P3 (paint range + member approve exist).

### Schema

```
tag_requests
  UNIQUE (user_id, queue) WHERE status = 'requested'
state_reports          snapshot JSONB frozen
```

### Compose

Add `worker` + `beat` (same image, RQ/ARQ). Redis `q:jobs`, `lock:job:jl_inactivate`.

### Routes — NEW

| Method | Path | Roles |
|---|---|---|
| GET | `/tag-requests` | staff |
| GET | `/tag-requests/counts` | staff |
| POST | `/tag-requests` | cc, admin |
| POST | `/tag-requests/duty` | daily, admin |
| POST | `/tag-requests/{id}/apply` | queue owner |
| POST | `/tag-requests/{id}/reject` | queue owner |
| GET | `/state-reports/draft` | daily, admin |
| GET / POST | `/state-reports` | daily, admin |
| GET | `/state-reports/{id}` | daily, admin |
| POST | `/state-reports/{id}/approve` | admin |
| POST | `/state-reports/{id}/reject` | admin |

Apply: `SELECT … FOR UPDATE` + range paint + `status=updated` ([system-design.md](./system-design.md) §6.2).  
Submit state report: replace pending for date; persist draft snapshot ([backend-plan.md](./backend-plan.md) §4.8).

`POST /members/{id}/approve` with `today_tag` FR/CD/other now creates duty request (finish P3 leftover).

### Job

`jl_inactivate` daily 00:05 Asia/Dhaka. Idempotent. Metric `mess_jl_inactivations_total`.

### Metrics

```
mess_tag_requests_pending{queue}     # gauge
mess_tag_request_apply_total{queue,result}
mess_job_duration_seconds{job}
```

Alert later (P7): pending > 0 for 48h.

### Tests

- Second POST duty same queue replaces pending (partial unique)  
- Double apply → one `updated`, one `409 NOT_PENDING`  
- Queue mismatch FR + `queue=consume` → 400  
- Draft totals = live projection; after submit, mutating assignment does **not** change stored report  
- JL: last JL yesterday → status 0 today  

### FE check

`/cc/requested`, `/daily/requests`, `/ration/requests`, `/consume/requests` (need FE clients — until then, pytest + httpie). `/daily/state-report` submit, `/admin/state-reports` approve.

### Exit

Three queues + counts. Apply paints range. State report frozen. Worker ran JL once in staging.

### Out

FE `src/lib/api/tag-requests.ts` (frontend work). Month close.

---

## P5 — Mess kitchen + ZK

**Goal:** Who eats today; MS/CD ledger; shifts/plans; punches → unique/duplicate.

**Depends:** P3 (assignments + BK). P4 not strictly required.

### Schema

```
meal_shifts            seed breakfast, lunch, dinner
meal_plans             UNIQUE (date)
meal_assigns           unique (member_id, shift_id, date, check_in_time)
guest_meals
```

### Routes — LOCKED

| Method | Path |
|---|---|
| GET | `/mess/eaters` |
| GET | `/mess/ledger` |
| GET | `/zk/demo/status` |
| GET | `/zk/demo/users` |
| GET | `/zk/demo/attendance` |

Eaters / ledger rules: [api-design.md](./api-design.md) §12. Normal day = stored MS; BK = all assignable.

### Routes — NEW

CRUD `/meal-shifts` `/meal-plans`; `GET /meal-assigns`; `POST /meal-assigns/ingest`; `GET /guest-meals`.

Shift errors: `EMPTY_NAME` `BAD_TIME` `OVERLAP` `NAME_TAKEN` `BUILTIN` `IN_USE`.

### ZK

Demo routes flag-gated. **Poll on worker**, not API request. Ingest unique → `status=1`, dup → `2`. `mess_zk_up`, `mess_zk_ingest_total{status}`.

If device absent: demo endpoints return `reachable: false`; ingest still testable with POST body.

### Tests

- Normal vs BK eater sets  
- Ledger `tag_codes=["MS","CD"]`; `preview_future=false` hides future carry  
- Cannot delete `lunch` if plan references  
- Ingest twice → 1 then 2  

### FE check

`/mess/ledger`, `/mess/shifts`, `/mess/reports` (client may still join assigns locally).

### Exit

LOCKED mess + ZK demo shapes work. Builtin three shifts seeded. Ingest idempotent.

### Out

Pritibhoj (P6). Guest create UI (never v1).

---

## P6 — Reports, month close, manpower, Pritibhoj, files

**Goal:** Server-authoritative ৳ and Form-1. Closed month cannot change under a printed letter.

**Depends:** P3 (assignments). Rates/senders P2. Authorized P2. Kitchen P5 optional for consume (consume uses assignments only).

### Schema

```
closed_months          month PK, closed_at, closed_by, rates_snapshot JSONB
manpower_officer_absent PK (date, wing)
pritibhoj_events
```

Document bytes: volume `/data/docs/…` or MinIO. `POST /members/{id}/documents` multipart.

### Routes — NEW (must)

| Method | Path |
|---|---|
| POST | `/months/{month}/close` |
| POST | `/months/{month}/reopen` |
| GET | `/reports/consume/{month}` |
| GET | `/reports/consume/{month}/tag/{tag}` |
| GET | `/reports/consume/{month}/wings` |
| GET | `/reports/consume/{month}/ledger` |
| GET | `/reports/ration/{month}` |
| GET | `/reports/ration/{month}/staff` |
| GET | `/reports/ration/{month}/transfers` |
| GET | `/reports/manpower` |
| GET / PUT | `/settings/manpower-absent` |
| CRUD | `/pritibhoj` |
| POST / DELETE | `/members/{id}/documents` … |
| PATCH | `/members/{id}/documents/verify` |

Money: `Decimal` + `NUMERIC(12,2)`. Port `src/lib/reports.ts`: FR+FUEL, CLFR monthly (MS+CL+no FR), sender groups, bank-split staff letters.

**Close:** snapshot rates; assignment writes for dates in that month → `403 MONTH_CLOSED` (admin `?force=1` audited). Report GET after close uses `rates_snapshot`.

**Do not ship ration letters without close.** That was the system-design hole.

### Metrics

```
mess_month_closed{month}    # or info
mess_assignment_writes_total{result=month_closed}
```

### Tests

- FR bill = days×rate + days×FUEL  
- CLFR: MS+CL+0 FR → one monthly amount, not × CL days  
- Write assignment in closed month → 403  
- Reopen (admin) then write → 200  
- Manpower guests excluded  

### FE check

`/consume/monthly`, `/ration/report` — until FE calls `/reports/*`, verify via OpenAPI + golden JSON vs `buildRationReportClean` fixtures.

### Exit

Close month blocks paint. Consume + ration fixtures match frontend math. Pritibhoj persist. Upload + verify civilian.

### Out

Server PDF. Grafana (P7).

---

## P7 — Harden + ops

**Goal:** Ops can see and restore the system. Staff admin. QR register token. Alerts on fire.

**Depends:** P1+ (auth). Best after P6 so dashboards have domain metrics.

### Ship

- `GET/POST /staff`, `PATCH /staff/{id}`, `POST /staff/{id}/password`  
- Signed QR token on `POST /public/register?token=` (HMAC, 7d)  
- Grafana + dashboards (RED, pending queues, ZK, jobs)  
- Prometheus alert rules ([system-design.md](./system-design.md) §12)  
- Daily `pg_dump` cron + retain 4 weeks  
- **One restore drill** documented  
- OpenAPI `/openapi.json` (still wrapped at HTTP)  
- Contract tests: every **LOCKED** function in `src/lib/api/*.ts`  
- `postgres_exporter` optional  
- Disk/docs orphan GC weekly  

### Tests

- Last admin cannot deactivate self  
- Register without token still works (v1) or required if you flip flag  
- Restore dump → login + one member + one assignment present  

### FE check

Settings → QR still hits `/register`; token query optional until FE adds it.

### Exit

Grafana shows p95 + 5xx. Backup file exists. Restore drill signed off. LOCKED contract suite green in CI (api+db+redis).

### Out

K8s, refresh tokens, OpenTelemetry, `pg_trgm` (only if list p95 > 200 ms).

---

## Cross-cutting (every phase after P0)

Do these as you touch the code, not as a dump in P7.

| Always |
|---|
| Envelope + error `code` from [api-design.md](./api-design.md) §1.2 |
| `require_roles` on writes ([backend-plan.md](./backend-plan.md) §7) |
| Audit in **same txn** as mutation (after table exists P2) |
| `Decimal` for money; never `float` in SQL |
| JSON logs; mask NID / account / token |
| Alembic revision per phase; `api` waits on migrate |
| No ZK / long I/O in request workers |

---

## Locked checklist vs phase

Ship these before claiming `USE_API=true` for that desk.

| Desk | Phase | LOCKED routes |
|---|---|---|
| All | P1 | `/auth/login` `/auth/logout` |
| CC | P2 | `/members` GET/POST, `/public/register` |
| Ration Settings | P2 | `/settings/rates` `/senders` |
| Daily | P3 | `/assignments*` `/days/*` `/boro-khana*` |
| Mess | P5 | `/mess/eaters` `/mess/ledger` `/zk/demo/*` |

NEW routes do not block those desks; they block the *next* desk.

---

## Frontend follow-up (not backend, track anyway)

Wire after the matching phase exits. See [backend-plan.md](./backend-plan.md) §11.

| After | FE work |
|---|---|
| P1 | already done |
| P2 | already list/create/rates/senders |
| P3 | edit/detail GET-PUT; approve/reject/end/status leave `lib/store` |
| P4 | `src/lib/api/tag-requests.ts` + four request boards; state-report pages |
| P5 | shifts/plans/assigns leave local store |
| P6 | reports fetch `/reports/*`; catalog/authorized/banks; documents multipart; month close UI |
| P7 | QR token; staff admin screen if wanted |

---

## Definition of done (backend v1)

All of:

1. P0–P7 exits ticked.  
2. Six seed roles login.  
3. Daily cockpit = demo rules (carry, suppress, MFR, JL, TRG, BK, approve).  
4. Tag requests three queues.  
5. Mess eaters MS / BK-everyone.  
6. FR+FUEL and CLFR match `reports.ts`.  
7. Closed month rejects paint.  
8. State report snapshot frozen.  
9. `/metrics` scraped; JL job ran.  
10. LOCKED contract tests green.  
11. Restore drill done.

---

## Suggested ticket cut (first sprint)

If you open the backend repo tomorrow, first 10 tickets = P0+P1:

1. Compose: api, db, redis, prometheus, migrate  
2. Envelope + exception handlers  
3. `/live` `/ready` `/health` `/metrics`  
4. Alembic bootstrap  
5. `staff` model + seed  
6. `POST /auth/login` LOCKED  
7. JWT middleware + `GET /auth/me`  
8. `POST /auth/logout` + Redis denylist  
9. Login rate limit  
10. Pytest: login + ready + metrics  

Then P2 ticket 11 = `members` table + `GET/POST /members`.
