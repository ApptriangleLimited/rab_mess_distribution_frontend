# Production string audit (Phase 18)

Inspected 2026-09-13. No secret values recorded. Test fixtures were not deleted.

| Occurrence | Where | Class |
| ---------- | ----- | ----- |
| `TODO` / `FIXME` in backend Python | none | SAFE |
| UI `placeholder=` props | form hints | SAFE |
| `strength-report.ts` “Form 2 placeholder” comment | report copy | SAFE |
| `mock` / pytest fixtures | `backend/tests/*` | DEV/TEST ONLY |
| `ChangeMe!` seed password | `SEED_STAFF_PASSWORD` default; tests | DEV/TEST ONLY — `assert_secure()` rejects it when `APP_ENV=production` |
| `dev-only-change-me` JWT default | `backend/config.py` | DEV/TEST ONLY — production startup fails if unchanged |
| `localhost` / `127.0.0.1` | compose defaults, CORS localhost list, frontend `NEXT_PUBLIC_API_URL` | DEV/TEST ONLY — must be HTTPS origin on the go-live host |
| `ALLOW_CREATE_ALL` | default false | SAFE — production must stay unset/false |
| `ENABLE_HSTS` | default false | SAFE until real HTTPS is verified, then set true |
| `REDIS_PASSWORD` empty | local compose | DEV/TEST ONLY on this workstation — **PRODUCTION BLOCKER** if empty on staging/prod |
| `SMTP_PASSWORD` unset | local compose | NOT REQUIRED (no forgot-password UI) |
| Isolated Redis `--requirepass` probe | throwaway container | SAFE — unauth `NOAUTH`, auth `PONG` |
| `docs/PRODUCTION_GAP_ANALYSIS.md` leftover “no prod compose” | stale analysis | SAFE — overlay exists as `docker-compose.prod.yml` (still untracked until committed) |
| ZK `/api/v1/zk/demo` | `extra.py` | SAFE / DEFERRED — not go-live scope |
| Hardcoded production secrets | none found | SAFE |

No production-code secret was found hardcoded. Remaining blockers are environment and host (TLS, Redis password on the real server, staging SSH), not source-code placeholders.
