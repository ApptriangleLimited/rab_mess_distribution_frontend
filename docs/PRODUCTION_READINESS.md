# Production Readiness

Only mark `[x]` when implemented **and** verified on the intended host.

- [x] Real authentication (JWT + bcrypt staff login)
- [x] Refresh tokens with rotation and reuse detection
- [x] Optional TOTP MFA (not forced; no UI)
- [x] Forgot/reset password APIs (no frontend screen)
- [x] RBAC desk roles + permission table
- [x] Production database (PostgreSQL)
- [x] Database migrations (`alembic upgrade head` on empty DB)
- [x] Redis cache + deny-list + rate limit (password required in production)
- [x] Redis/Postgres unpublished on the mess compose network
- [x] File storage (local named volume verified; S3 optional)
- [x] Health checks (`/health`, `/health/live`, `/health/ready`)
- [x] Docker (dev + prod overlay + nginx + worker)
- [x] Alternate-DB restore drill on local Docker (`docs/RESTORE_DRILL.md` PASS)
- [x] Backup scripts
- [ ] Real TLS certificate + HTTP→HTTPS on a public hostname
- [ ] `ENABLE_HSTS=true` after that HTTPS check
- [ ] Staging host deploy with the SSH workflow
- [ ] CI/CD health gate against staging hostname
- [x] ZK deferred (not go-live scope)
- [x] Snapshot writes desk-scoped

**Verdict: NOT YET PRODUCTION READY** — this workstation has no `STAGE_HOST`, no `gh` login, and no real TLS certificate. Overlay + TLS nginx + fail-closed deploy workflow are in the tree. They are not on `origin/develop` until committed and pushed. Do not commit `.env`.
