# Mess backend (P0 platform)

FastAPI + Postgres + Redis + Prometheus. Contract: `docs/backend-implementation-plan.md` P0.

## Local tests (no Docker)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest
```

`/live`, envelope, `/metrics` run without Postgres. `/ready` needs both deps (or mocked in tests).

## Compose

```bash
cd backend
docker compose -f compose.platform.yml up --build
```

| URL | What |
|---|---|
| http://127.0.0.1:8000/api/v1/live | liveness |
| http://127.0.0.1:8000/api/v1/ready | Postgres + Redis |
| http://127.0.0.1:8000/api/v1/health | `{ ok, data: { status, db, redis } }` |
| http://127.0.0.1:8000/metrics | Prometheus (no envelope) |
| http://127.0.0.1:9090 | Prometheus UI |

Exit: migrate completes, `/ready` 200, Prometheus targets `api` UP.

## Auth (P1)

Seed desks: `{role}@mess.rab` / `ChangeMe!` (`cc daily mess consume ration admin`).

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"daily@mess.rab","password":"ChangeMe!"}'
```

`POST /api/v1/auth/logout` + `GET /api/v1/auth/me` need `Authorization: Bearer`.

P2 next: members + catalog + rates.
