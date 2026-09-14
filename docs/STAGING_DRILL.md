# Staging production drill

Use a staging host that mirrors production Compose + nginx. Do not run destructive steps against live production data.

## Checklist

1. Fresh `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
2. Confirm startup ran `alembic upgrade head`
3. Redis starts with `REDIS_PASSWORD`
4. Worker container is running and `/health/ready` shows postgres + redis up
5. Bootstrap admin (`SEED_STAFF=true` once), then change passwords
6. Login, refresh token, logout (refresh must fail after logout)
7. Role test: consume cannot overwrite members via snapshot PUT
8. Permission test: `GET /api/v1/auth/permissions`
9. CRUD: member + tag request + Pritibhoj
10. File upload of a `.txt` or `.pdf`; reject `.exe`
11. Notifications list + unread count
12. Enqueue a forgot-password (SMTP may skip)
13. Restart api + worker; data still present
14. Backup, restore into `rab_mess_restore_drill` (`docs/RESTORE_DRILL.md`)
15. Health checks through the proxy
16. HTTPS verification (`docs/TLS.md`) when certificates exist

Record pass/fail for each line in the change ticket. A green `/health` alone is not a pass.
