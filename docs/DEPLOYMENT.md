# Deployment

## Initial server

- Ubuntu 22.04+ (or equivalent)
- Docker Engine + Compose plugin
- DNS pointing at the host
- TLS certificates (Let’s Encrypt via Caddy/nginx, or load-balancer)

Do **not** publish Postgres or Redis ports to the internet.

## Environment

Copy `env.docker.example` to `.env` on the server. Required production values:

```text
APP_ENV=production
JWT_SECRET=<long random>
POSTGRES_PASSWORD=<long random>
SEED_STAFF=false
SEED_STAFF_PASSWORD=<only if first bootstrap>
REDIS_URL=redis://redis:6379/0
REDIS_PASSWORD=<long random>
APP_SECRET=<long random>
CORS_ORIGINS=https://ms.apptriangle.com
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_ZK_DEMO=false
```

Never commit `.env`.

## Database initialization

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
# wait healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api alembic upgrade head
```

API and worker entrypoints run `alembic upgrade head` before the process starts. Do not use `create_all` in production.

## Seed

First bootstrap only:

```bash
SEED_STAFF=true SEED_STAFF_PASSWORD=<temp> docker compose ... up -d api
```

Then change every desk password. Do not leave `ChangeMe!`.

## Application startup

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Reverse proxy (`nginx` service) should listen on 80/443 and route:

- `/` → `web:3000`
- `/api/` → `api:8000`
- `/health` → `api:8000`

## SSL/TLS

Terminate TLS at nginx or an upstream load balancer. Set `CORS_ORIGINS` to the HTTPS origin only.

## Backup

```bash
./scripts/backup-postgres.sh
```

Stores `pg_dump` under `backups/` (or `BACKUP_DIR`). Keep at least 7 daily + 4 weekly copies off-box.

## Restore

```bash
./scripts/restore-postgres.sh backups/rab_mess_YYYYMMDD_HHMMSS.sql.gz
```

This drops/recreates connections and applies the dump. Test restore on a staging volume before you need it.

## Upgrade

1. `git pull`
2. `docker compose ... build api web`
3. `alembic upgrade head`
4. `docker compose ... up -d`
5. Hit `/health/ready`

## Rollback

1. `git checkout <previous tag>`
2. Restore DB if a migration is irreversible
3. `docker compose ... up -d`

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| 401 after login | JWT_SECRET mismatch between recreate cycles; Redis deny-list |
| Empty members | Frontend demo mode — `NEXT_PUBLIC_USE_API` must be true at **build** time |
| API 500 | `docker logs srb_backend` — JSON logs include `request_id` |
| Ready fails | `pg_isready`, `redis-cli ping`, `DATABASE_URL` host `postgres` not localhost |
| Snapshot wiped data | Stop using PUT snapshot from non-admin; restore backup |

## Workers

`srb_worker` runs RQ against the same Redis. Password-reset mail is enqueued when SMTP is configured; otherwise the job logs `email_skipped`. Token purge runs on worker start.
