# Restore drill — RAB Mess Distribution

Sign off once before go-live. RPO is about 24 hours (daily `pg_dump`).

## Backup

Compose service `backup` writes custom-format dumps to volume `mess_backups`:

`/backups/mess-YYYYMMDD.dump`

Keep 28 days. Manual dump:

```bash
cd backend
docker compose -f compose.platform.yml exec backup sh /backup.sh
```

## Restore (Postgres)

1. Stop writers: `docker compose -f compose.platform.yml stop api worker beat`
2. Pick a dump: `docker compose -f compose.platform.yml exec backup ls /backups`
3. Restore:

```bash
docker compose -f compose.platform.yml exec -e PGPASSWORD=mess backup \
  sh /restore.sh /backups/mess-YYYYMMDD.dump
```

4. Start writers: `docker compose -f compose.platform.yml start api worker beat`
5. Prove it:

- `POST /api/v1/auth/login` with `{role}@mess.rab` / `ChangeMe!`
- `GET /api/v1/members` shows the expected roster
- `GET /api/v1/assignments?date=YYYY-MM-DD` shows a stored cell

SQLite tests use `app.services.backup.dump_sql` / `restore_sql` for the same login + member + assignment check.

## Docs volume

`DOCS_DIR` (`/data/docs`) is not inside `pg_dump`. Copy it with the dump if member files matter:

```bash
docker compose -f compose.platform.yml cp api:/data/docs ./docs-restore
```

Weekly job `docs_gc` deletes orphan files that are not in `member_documents.storage_path`.
