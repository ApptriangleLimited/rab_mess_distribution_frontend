# Production Gap Analysis — SRB-Special Response Battalion Mess Distribution

**Date:** 2026-09-13  
**Frontend:** treated as the approved functional specification. UI/UX is locked.  
**Conclusion of this audit:** the stack is a working **Docker-backed prototype**, not a production-ready system.

---

## 1. Current Technology Stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Frontend | Next.js 16.2.12, React 19.2, TypeScript | App Router, `src/app` |
| Styling | Tailwind CSS 4, Radix, Tabler/Lucide icons, Motion | Approved visual system |
| State | Custom in-memory store + `localStorage` (`mess_proto_v1`) | Dual mode: demo vs API |
| Forms | Custom React forms (no Formik/RHF) | Client validation only |
| Charts | Recharts | Ration monthly dashboard |
| PDF/print | jsPDF, jspdf-autotable, browser print | Client-side generation |
| i18n | Custom `en` / `bn` catalogs | `mess_locale_v1` |
| Backend | FastAPI (Python 3.12), SQLAlchemy 2, Pydantic | Monolith: `main.py`, `daily.py`, `extra.py`, `persist.py` |
| Database | PostgreSQL 16 | `create_all` only — **no Alembic** |
| Cache | Redis 7 | Response cache + JWT deny-list |
| Auth | JWT HS256 + bcrypt | Single long-lived access token (default 7 days) |
| Authorization | Staff `role` string + `require_roles()` | No permissions table |
| Deploy | `docker-compose.yml` + GitHub SSH deploy | No prod compose, no reverse proxy, no TLS in repo |
| Tests | None | No backend or frontend automated tests |

**Environment flags**

- `NEXT_PUBLIC_USE_API` / `NEXT_PUBLIC_API_URL` — frontend talks to FastAPI
- Default frontend without those flags is **localStorage demo mode**

---

## 2. Existing Working Features

Statuses: **UI** = screen exists · **API** = dedicated REST · **SNAP** = only via `/api/v1/app/snapshot` · **DEMO** = demo/local fallback · **NONE** = missing

| Module | Screen | Feature | Frontend | Backend | DB | Production |
| ------ | ------ | ------- | -------- | ------- | -- | ---------- |
| Auth | `/login` | Staff login | UI + API | JWT login | `staff` | Partial — no refresh, lockout, or rate limit |
| Auth | `/login` | Demo desk login | UI | NONE | NONE | Demo only |
| Auth | `/register` | Public member register | UI + API | Public POST | `members` | Partial — no CAPTCHA/rate limit |
| Auth | header | Logout | UI + API | Token revoke (Redis) | — | Partial |
| CC | `/cc/users` | Member list/filter/page | UI + API | GET members | `members` | Usable |
| CC | `/cc/users/new` `[id]` edit | Member CRUD | UI + API | POST/PUT | `members` | Usable |
| CC | accept/reject | Approval | UI + API | PATCH accept/reject | `members` | Usable |
| CC | `/cc/requested` | Tag request list | UI + API | GET tag-requests | `tag_requests` | Usable |
| Daily | `/daily/tags` | Cockpit paint/carry | UI + API | assignments PUT | `assignments` | Usable |
| Daily | `/daily/requests` | Approve tag changes | UI + API | accept writes assignments | `tag_requests`, `assignments` | Usable |
| Daily | `/daily/manpower` | Form 1 + print | UI | SNAP + GET manpower | `authorized_strength`, `manpower_officer_absent` | Partial |
| Daily | `/daily/roster` | Roster + status | UI + API | members/status | `members` | Usable |
| Daily | `/daily/state-report` | Submit state report | UI | SNAP only | `state_reports` | Partial |
| Mess | `/mess/ledger` | MS/CD ledger | UI + API | GET ledger | assignments | Partial (demo fallback remains) |
| Mess | `/mess/shifts` | Shift CRUD | UI | SNAP only | `meal_shifts` | Partial |
| Mess | `/mess/reports` | Check-in / ZK / CSV | UI | SNAP + ZK stubs | meal tables | Partial — ZK is fake |
| Mess | `/mess/pritibhoj` | Event CRUD/print | UI + API | REST pritibhoj | `pritibhoj_events` | Usable |
| Mess | `/mess/planning` | Meal plans | UI | SNAP only | `meal_plans` | Partial |
| Consume | `/consume/requests` | Queue | UI + API | tag-requests | `tag_requests` | Usable |
| Consume | monthly / ledger / summary | Bills + official sheets | UI calc | SNAP + GET report | assignments, rates | Partial — letters still computed in browser |
| Ration | `/ration/monthly` | Dashboard | UI calc | SNAP + GET report | assignments, rates | Partial |
| Ration | `/ration/requests` | FR/CD queue | UI + API | tag-requests | `tag_requests` | Usable |
| Ration | `/ration/report` | Bank letters | UI calc | senders/rates APIs | `senders`, `rates` | Partial — PDF client-side |
| Ration | `/ration/members` | Bank list | UI + members API | members | `members` | Usable |
| Settings | `/settings` | Rates, senders, catalogs | UI + mixed APIs | rates/senders REST; catalogs SNAP | `rates`, `senders`, `catalog_state` | Partial |
| Admin | `/admin` | Dashboard | UI | NONE dedicated | derived | Partial |
| Admin | `/admin/state-reports` | Approve reports | UI | SNAP only | `state_reports` | Partial |
| Files | user form | Attachments | Metadata only | NONE | JSONB `documents` | **Missing** |
| Notifications | toasts | UX only | Client | NONE | NONE | **Missing** |
| Email | — | — | NONE | NONE | NONE | **Missing** |
| ZK | mess reports | Attendance | Demo personas | Stub APIs | NONE | **Missing** |

---

## 3. Mock / Dummy Implementation Inventory

| Kind | Path | Production classification |
| ---- | ---- | ------------------------- |
| Demo seed members/assignments | `src/lib/store/seed.ts` | DEVELOPMENT ONLY — still used if API off |
| Demo tag requests | `src/lib/tag-request-demo.ts` | Skipped when API on |
| Demo Pritibhoj sheets | `src/lib/pritibhoj-demo.ts` | Skipped when API on |
| ZK fake names | `src/lib/zk/attendance-report.ts` | MUST FIX for real ZK |
| Official letterhead constants | `src/lib/constants.ts` (`RATION_REPORT_META`, `CONSUME_REPORT_META`) | SAFE if treated as org config; should move to settings |
| Catalog defaults | `src/lib/constants.ts` (`RANKS`, `WINGS`, `FORCES`, `DEFAULT_AUTHORIZED`) | Fallback when `catalog_state` empty |
| Official senders | `src/lib/official-senders.ts` + `backend/extra.py` `DEFAULT_SENDERS` | Seeded master data; account numbers are demo |
| Seed staff | `cc@mess.rab` / `ChangeMe!` | DEVELOPMENT ONLY — must not ship as prod default |
| JWT default secret | `backend/auth.py` `"dev-only-change-me"` | MUST FIX |
| localStorage `mess_proto_v1` | `src/lib/store/index.ts` | Cache only when API on; authoritative store when API off |
| Role switcher | header / settings | DEVELOPMENT ONLY |
| Settings “Reset to seed” | `src/app/(app)/settings/page.tsx` | DEVELOPMENT ONLY |
| Snapshot PUT any staff | `PUT /api/v1/app/snapshot` | MUST FIX — can overwrite operational data |
| `Math.random` IDs | store helpers | SAFE in demo; API uses UUID prefixes |
| Dead route guard | `src/proxy.ts` | Present; confirm Next 16 actually invokes it |
| Unused | `src/lib/served.ts` | Dead code |

---

## 4. Missing Backend Features (by frontend operation)

### Authentication

| Frontend | Required backend | DB | Validation / permission / audit |
| -------- | ---------------- | -- | ------------------------------- |
| Login | `POST /api/v1/auth/login` (exists) | `staff` | Rate limit, lockout, audit LOGIN |
| Logout | `POST /api/v1/auth/logout` (exists) | revoke list | Audit LOGOUT |
| Session refresh | `POST /api/v1/auth/refresh` | `refresh_sessions` | Rotation + revoke |
| Change password | `POST /api/v1/auth/change-password` | `staff` | Current password, policy |
| Forgot/reset password | email + token APIs | `password_resets` | SMTP, expiry |

### Members / CC / Daily roster

Most CRUD exists. Still missing: document upload (`POST /api/v1/members/{id}/documents`), audit of accept/reject, IDOR tests.

### Daily cockpit

Assignments APIs exist. Day approve and boro-khana exist. Carry/suppress is API-backed. Missing: audit of tag paints; server-side month report for print (currently client PDF).

### State reports

| Frontend | Required | DB |
| -------- | -------- | -- |
| Submit | `POST /api/v1/state-reports` | `state_reports` |
| List | `GET /api/v1/state-reports` | |
| Approve/reject | `PATCH .../approve` `/reject` | status machine + audit |

Today: snapshot only.

### Meals

| Frontend | Required | DB |
| -------- | -------- | -- |
| Shifts CRUD | `/api/v1/meal-shifts` | `meal_shifts` |
| Plans | `/api/v1/meal-plans` | `meal_plans` |
| Check-in | `/api/v1/meal-assigns` | `meal_assigns` |
| Guests | `/api/v1/guest-meals` | `guest_meals` |

Today: snapshot only.

### Catalog / authorized

| Frontend | Required | DB |
| -------- | -------- | -- |
| Ranks/wings/forces/banks | `/api/v1/catalog` | normalize `catalog_state` or split tables |
| Authorized strength | `/api/v1/authorized` | `authorized_strength` |
| Officer absent | `/api/v1/manpower/absent` | `manpower_officer_absent` |

### Reports

Browser still runs official letter math (`src/lib/reports.ts`). Backend `GET /api/v1/reports/{consume,ration,manpower}` is a simpler aggregation. Production should keep **identical** letter logic and optionally move it server-side later without changing totals.

### Files / email / notifications / ZK

No production implementation.

---

## 5. Architecture decision (existing stack kept)

```text
Browser (Next.js — UI locked)
   │
   ▼
Reverse proxy (to add for production)
   │
   ├─ /        → Next.js
   └─ /api/v1  → FastAPI
                   ├─ PostgreSQL
                   ├─ Redis (cache, rate limit, token deny-list)
                   ├─ filesystem/S3 uploads (to add)
                   └─ worker/scheduler (to add for email/exports)
```

Do **not** replace FastAPI, Next.js, PostgreSQL, or Redis. Extend them.

---

## 6. Highest-priority blockers

1. No migrations — schema drift on existing volumes  
2. No automated tests  
3. No backups / restore runbook  
4. Weak JWT defaults and 7-day access tokens  
5. Snapshot PUT available to every logged-in role  
6. No audit trail  
7. No rate limiting on login / public register  
8. No structured logging of 500s  
9. No reverse proxy / TLS / prod compose  
10. File uploads, email, real ZK, meal/state-report REST still incomplete  
11. Frontend can still run entirely on demo seed if API env is off  

**This system is NOT YET PRODUCTION READY.**
