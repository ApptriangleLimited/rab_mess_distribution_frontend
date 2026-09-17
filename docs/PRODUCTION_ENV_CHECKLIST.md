# Production environment checklist

Inspected 2026-09-13 (re-verified same day) against the **local Docker stack** (`srb_*`).  
This is **not** a staging or production host. No secret values are recorded.

Redis AUTH mechanism was proven on a throwaway `redis:7-alpine --requirepass` container on the same Docker network: unauthenticated `PING` → `NOAUTH`; authenticated `PING` → `PONG`. Password value was not logged. The long-lived `srb_redis` on this workstation still has an empty password (allowed for local compose).

Statuses: `[PASS]` · `[FAIL]` · `[NOT REQUIRED]` · `[UNSET — required before go-live]`

| Variable | Local Docker | Staging/prod requirement |
| -------- | ------------ | ------------------------ |
| `APP_ENV` | `[UNSET — required before go-live]` (defaults to development) | Must be `production` |
| `APP_SECRET` | `[PASS]` present | Strong random ≥ 32 chars |
| `JWT_SECRET` | `[PASS]` present | Strong random ≥ 32 chars; not a documented default |
| `DATABASE_URL` | `[PASS]` present (in-network `postgres`) | Private hostname, not public IP |
| `DATABASE_PASSWORD` / `POSTGRES_PASSWORD` | `[UNSET — required before go-live]` (compose default `mess`) | Strong; `assert_secure()` rejects `mess` in production |
| `REDIS_URL` | `[PASS]` `redis:6379/0` (password not logged) | In-network only |
| `REDIS_PASSWORD` | `[FAIL]` empty on this host | Required when `APP_ENV=production` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | `[NOT REQUIRED]` unset; reset UI is not in the approved frontend | Set only if password-reset mail is in release scope |
| `STORAGE_BACKEND` | `[PASS]` `local` | `local` OK for single-node + named volume |
| `STORAGE_LOCAL_PATH` | `[PASS]` `/var/lib/rab-mess/files` on `files_data` | Persist via Docker volume; back up the volume |
| `STORAGE_ENDPOINT` / `BUCKET` / `REGION` / `ACCESS_KEY` / `SECRET_KEY` | `[NOT REQUIRED]` | Required only if `STORAGE_BACKEND=s3` |
| `ENABLE_HSTS` | `[PASS]` unset/false | Enable only after real HTTPS is verified |
| `CORS_ORIGINS` / `ALLOWED_ORIGINS` | `[PASS]` explicit localhost list (no `*`) | Production must be the HTTPS origin only |
| `SEED_STAFF` | `[UNSET — required before go-live]` (dev default true) | `false` after first bootstrap |
| `ALLOW_CREATE_ALL` | `[PASS]` unset/false | Must stay false in production |

## Network exposure (this host)

| Service | Published to host | Verdict |
| ------- | ----------------- | ------- |
| `srb_database` | No (`5432/tcp` unbound) | `[PASS]` private Docker network |
| `srb_redis` | No (`6379/tcp` unbound) | `[PASS]` private Docker network |
| `srb_backend` | Yes `:8000` | Expected for local; production should publish only nginx 80/443 |
| `srb_frontend` | Yes `:3000` when started | Same as API — hide behind proxy in production |

Unrelated containers on this workstation publish `5432`/`6379`. Those are **not** the mess stack.

## Production overlay

`docker-compose.prod.yml` already:

- clears Postgres/Redis published ports
- requires Redis `--requirepass`
- sets `APP_ENV=production` (triggers weak-secret fail-fast)
- adds nginx on port 80

TLS 443 is **not** mounted. See `docs/TLS.md`.
