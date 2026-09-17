# Go-live runbook

## Scope decisions (do not treat as hidden blockers)

| Item | Classification | Notes |
| ---- | -------------- | ----- |
| ZK attendance device | **DEFERRED — NOT PART OF GO-LIVE SCOPE** | API returns `reachable: false`. Daily tags are operator-entered. |
| MFA enforcement / MFA UI | **OPTIONAL SECURITY FEATURE** | TOTP APIs exist. Not forced. No enroll screen. |
| Notification inbox | **API CAPABILITY AVAILABLE / FRONTEND INBOX NOT IN CURRENT SCOPE** | Approved UI uses toasts. |
| Dedicated meal / state-report REST | **FUTURE ARCHITECTURE** | GET snapshot hydrates the SPA. Writes are desk-scoped. No security/scale blocker identified at current size. |
| Password-reset email | **NOT IN APPROVED UI** | APIs exist; no forgot-password screen. Live check: `POST /api/v1/auth/forgot-password` returns the generic 200 body when SMTP is unset. SMTP is P1 if you later ship reset mail. |
| S3/MinIO | **NOT REQUIRED** for single-node compose | Local `files_data` volume is the supported topology. Use S3 if you add replicas. |

## Sequence

1. **Provision** Ubuntu 22.04+ (or equivalent) with Docker Engine + Compose. Do not publish Postgres or Redis.
2. **DNS** — A/AAAA for the public hostname only.
3. **TLS** — mount a real certificate (Let's Encrypt, org PKI, or load-balancer). Enable the HTTPS server in `deploy/nginx/nginx.conf`. Redirect `:80` → `:443`. See `docs/TLS.md`. Do **not** set `ENABLE_HSTS=true` until that redirect and the certificate chain work from a browser off the server.
4. **Secrets** — copy `env.docker.example` to `.env` on the server. Set strong `APP_SECRET`, `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`. Set `APP_ENV=production`, `SEED_STAFF=false` after bootstrap, `CORS_ORIGINS=https://<hostname>`, `NEXT_PUBLIC_API_URL=https://<hostname>`, `NEXT_PUBLIC_USE_API=true`.
5. **PostgreSQL** — `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres` and wait healthy.
6. **Redis** — start with `REDIS_PASSWORD` set. Confirm `6379` is not published. Unauthenticated `PING` from another network must fail.
7. **Build / deploy** — `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
8. **Migrations** — entrypoint runs `alembic upgrade head`. Confirm `alembic current` is `0002_platform` (or later head).
9. **Workers** — `srb_worker` must be running. `/health/ready` should show postgres + redis up.
10. **Nginx** — only `80`/`443` published. `/` → web, `/api/` → api, `/health*` → api.
11. **HTTPS** — valid cert, hostname match, no mixed content.
12. **Health** — `GET https://<host>/health/live` and `/health/ready` return 200.
13. **Smoke** — login, refresh, logout, one member read, one scoped snapshot PUT as consume (members must not change), file upload of `.txt`, reject `.exe`.
14. **SMTP** — skip unless reset mail is in scope. If in scope, send one reset and confirm delivery.
15. **Storage** — confirm `files_data` (or S3) survives `docker compose restart api`.
16. **Backup** — `./scripts/backup-postgres.sh` and copy dumps off-box. Repeat `docs/RESTORE_DRILL.md` on this host once.
17. **Traffic** — point users at HTTPS only.
18. **Monitor** — `docker logs -f srb_backend` (JSON + `x-request-id`). See `docs/OBSERVABILITY.md`.

## Rollback (staging or production)

| Failure | Recovery |
| ------- | -------- |
| New API image fails startup | `docker compose rollback` is not built-in. Recreate the previous image tag / `git checkout <previous>` and `up -d --build`. |
| Migration fails | Entrypoint / deploy script must stop. Do not continue. Restore `rab_mess` from the pre-deploy dump **only if** the failed revision is irreversible. |
| `/health/ready` fails | Treat deploy as failed. Keep previous containers if you used a second compose project; otherwise rebuild the last known-good commit. |
| Nginx cannot reach API | Check `docker compose ps`, API health, and `proxy_pass`. TLS mistakes do not require a DB restore. |

Do not run destructive rollback tests on production.

## Restart / persistence expectation

Redis cache loss is acceptable. Members, assignments, files on `files_data`, and Alembic revision must survive a full `docker compose restart`.
