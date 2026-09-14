# Implementation Tracker

Statuses: `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` · `COMPLETED` · `BLOCKED` · `VERIFIED`

| Area | Before | After | Verification | Status |
| ---- | ------ | ----- | ------------ | ------ |
| Alembic history | create_all + partial 0001 | 0001 schema.sql + 0002 platform | empty-DB upgrade | IMPLEMENTED |
| Catalogs | JSON blob only | classified + GET/PUT `/catalog` | unit + live | IMPLEMENTED |
| Redis auth | open on docker net | password env, no public ports, no password logs | compose + unit | IMPLEMENTED |
| Refresh tokens | access only | rotate + reuse detect + logout revoke | live hardening | IMPLEMENTED |
| Password reset | none | hashed token + generic + rate limit | live generic path | IMPLEMENTED |
| MFA | none | optional TOTP + recovery | unit (optional enroll) | IMPLEMENTED |
| RBAC permissions | desk roles | permissions + role map | live permissions | IMPLEMENTED |
| Snapshot restriction | any staff full PUT | filtered by desk; import admin | live IDOR | IMPLEMENTED |
| Workers | none | RQ worker + email/purge jobs | container start | IMPLEMENTED |
| File storage | metadata only | local/S3 + MIME sniff | live upload | IMPLEMENTED |
| Notifications | toasts only | DB + APIs, no new UI | live list/read | IMPLEMENTED |
| Security headers/CORS | partial | headers + explicit CORS + prod secrets | live headers | IMPLEMENTED |
| Tests | unit + health | platform unit + live hardening | pytest | IMPLEMENTED |
| TLS | nginx HTTP | documented real-cert procedure | docs only | IMPLEMENTED |
| Restore drill | scripts | `docs/RESTORE_DRILL.md` + isolated DB | drill commands | IMPLEMENTED |
| CI/CD | unit + SSH deploy | extra tests + migrate + health gate | workflow files | IMPLEMENTED |
| Staging drill | none | `docs/STAGING_DRILL.md` | not run on prod | IMPLEMENTED |
| Observability | request logs | ops runbook | docs | IMPLEMENTED |

Verified 2026-09-13 local Docker: empty-DB Alembic; Redis/Postgres unpublished; isolated Redis `--requirepass` (NOAUTH / PONG); alternate-DB restore **PASS**; live login / refresh reuse / consume snapshot IDOR / import 403 / unauthenticated members 401. Worker heartbeat recovered after container restart (`/health/ready` worker up). Not verified: real TLS, SMTP delivery, staging SSH, CI health gate on a public host, full-stack pause/restart (approval blocked). ZK/MFA UI/inbox/S3 deferred by scope.

| ID | Area | Feature | Status |
| -- | ---- | ------- | ------ |
| F04 | Foundation | Alembic full baseline | IMPLEMENTED |
| A02 | Auth | Refresh tokens | IMPLEMENTED |
| A03 | Auth | Reset password | IMPLEMENTED |
| A04 | Auth | MFA optional | IMPLEMENTED |
| R02 | RBAC | Permission table | IMPLEMENTED |
| R03 | RBAC | Snapshot write scope | IMPLEMENTED |
| M02 | Members | File storage API | IMPLEMENTED |
| C01 | Catalog | Dedicated REST | IMPLEMENTED |
| N01 | Notify | Persistent APIs | IMPLEMENTED |
| N02 | Email | SMTP job (skip if unset) | IMPLEMENTED |
| Z01 | ZK | Real device | NOT STARTED |
