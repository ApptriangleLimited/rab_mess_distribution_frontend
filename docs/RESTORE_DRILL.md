# Restore drill (non-production)

Never point these commands at a production host. Never restore over the live application database during a drill.

## Result (2026-09-13, local Docker)

```text
RESTORE DRILL: PASS
SOURCE: rab_mess (container rab-mess-postgres)
ALTERNATE: rab_mess_restore_drill
ALEMBIC: 0002_platform (source and restore match)
LIVE API: left pointed at rab_mess (not switched)
```

| Check | Source | Restore | Result |
| ----- | ------ | ------- | ------ |
| Alembic revision | `0002_platform` | `0002_platform` | PASS |
| staff | 6 | 6 | PASS |
| members | 1 | 1 | PASS |
| assignments | 2 | 2 | PASS |
| tag_requests | 1 | 1 | PASS |
| catalog_state | 1 | 1 | PASS |
| refresh_sessions | 9 | 9 | PASS |
| permissions | 22 | 22 | PASS |
| audit_logs | 11 | 11 | PASS |
| Orphan assignments / tag_requests / refresh | — | 0 / 0 / 0 | PASS |
| Password verify + access-token issue against restore DB | — | `cc@mess.rab` | PASS |

Dump was written **inside** the Postgres container (`/tmp/rab_mess_restore_drill.sql`, ~40 KB) and copied to `backups/` (gitignored). The running API was **not** restarted onto the restore database.

## Commands used

```bash
docker exec rab-mess-postgres psql -U mess -d rab_mess -c "SELECT version_num FROM alembic_version;"
docker exec rab-mess-postgres pg_dump -U mess -d rab_mess -f /tmp/rab_mess_restore_drill.sql
docker exec rab-mess-postgres psql -U mess -d postgres -c "CREATE DATABASE rab_mess_restore_drill;"
docker exec rab-mess-postgres psql -U mess -d rab_mess_restore_drill -f /tmp/rab_mess_restore_drill.sql
```

Application check (isolated process, live API unchanged):

```text
DATABASE_URL=.../rab_mess_restore_drill
verify_password + create_access_token for cc@mess.rab
```

## Repeat on staging

Use `./scripts/backup-postgres.sh` then restore **only** into `rab_mess_restore_drill`. Do not use `scripts/restore-postgres.sh` for a drill — that script overwrites `rab_mess`.

Drop the drill database when finished:

```bash
docker exec rab-mess-postgres psql -U mess -d postgres -c "DROP DATABASE IF EXISTS rab_mess_restore_drill;"
```

## Common failures

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `database is being accessed` | Session still open on drill DB | Close the isolated Python process; do not point API at drill DB |
| Restore into `rab_mess` by mistake | Wrong `psql -d` | Restore only into `rab_mess_restore_drill` |
| Missing tables | Dump from empty volume | Seed, backup again |
