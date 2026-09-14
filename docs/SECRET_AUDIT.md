# Secret audit (P0-02)

Inspected 2026-09-14. No secret values are recorded.

## Repository search

| Pattern | Where | Class |
| ------- | ----- | ----- |
| `APP_SECRET=` / `JWT_SECRET=` | `env.docker.example`, `backend/env.example` | SAFE EXAMPLE |
| `REDIS_PASSWORD=` empty | `env.docker.example` | SAFE EXAMPLE (local compose may be empty) |
| `POSTGRES_PASSWORD=mess` | `env.docker.example`, compose default | SAFE EXAMPLE — rejected by `assert_secure()` when `APP_ENV=production` |
| `DATABASE_URL=...mess:mess@...` | `backend/env.example` | SAFE EXAMPLE |
| `changeme` / `password123` | `backend/security.py` common-password denylist; unit tests | TEST ONLY |
| `ChangeMe!` | seed default + live tests | TEST ONLY — production rejects it |
| `password=` / `secret=` committed production values | none found | SAFE |
| `.env*` | `.gitignore` | SAFE — excluded from source control |

No **PRODUCTION SECRET LEAK** was found in the repository.

## Staging / CI secret mechanism

This workstation:

| Item | Status |
| ---- | ------ |
| `STAGE_HOST` / `STAGE_USER` / `STAGE_KEY` / `STAGE_URL` in local env | UNSET |
| `gh` authenticated | NO |
| Server `.env` inspected | NOT AVAILABLE |

Required GitHub Actions secrets (store values only in GitHub, never in git):

```text
STAGE_HOST
STAGE_USER
STAGE_KEY
STAGE_URL          # https://<staging-hostname> for the public health gate
```

Required on the server `.env` (never commit):

```text
APP_ENV=production
APP_SECRET         # random ≥ 32 chars
JWT_SECRET         # random ≥ 32 chars, not a documented default
POSTGRES_PASSWORD  # strong; not mess / password / ChangeMe!
REDIS_PASSWORD     # required; overlay exits if empty
CORS_ORIGINS=https://<hostname>
NEXT_PUBLIC_API_URL=https://<hostname>
NEXT_PUBLIC_USE_API=true
SEED_STAFF=false   # after first bootstrap
ENABLE_HSTS=false  # set true only after HTTPS is verified
```

`backend/config.py` `assert_secure()` fails fast in production if JWT/APP/Redis/DB secrets are weak or CORS is `*`.
