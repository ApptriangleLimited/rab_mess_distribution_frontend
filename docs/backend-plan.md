# RAB Mess Distribution — Backend Plan

Plan for a production API that replaces the frontend’s `localStorage` prototype (`mess_proto_v1`) while honouring the contracts the Next.js app already calls when `NEXT_PUBLIC_USE_API=true`.

**HTTP contract (every path, body, and error):** [api-design.md](./api-design.md).  
**Runtime (locks, Redis, jobs, Prometheus, month close):** [system-design.md](./system-design.md).  
**Build order (tickets, schema, tests, exit):** [backend-implementation-plan.md](./backend-implementation-plan.md).

**Frontend:** Next.js 16 / React 19 (this repo)  
**Intended API:** FastAPI at `/api/v1` (proxied from Next via `API_PROXY_URL` / `NEXT_PUBLIC_API_BASE_URL`, default `http://127.0.0.1:8000`)  
**Date of analysis:** 2026-09-08

---

## 1. What this product is

A staff-only operations system for **RAB Forces Headquarters mess, daily duty, consume bills, and ration payout**. Six desk roles share one org catalog and one member roster. Money and mess lists are derived from **daily duty tags** painted on a month grid (the Daily cockpit).

| Role | Home | Job |
|---|---|---|
| `cc` | `/cc/users` | Register members, request duty-tag changes |
| `daily` | `/daily/tags` | Paint duty tags, approve members, lock days, manpower, roster, submit state reports |
| `mess` | `/mess/ledger` | Who eats (MS/CD + Boro Khana), kitchen shifts, meal reports, Pritibhoj |
| `consume` | `/consume/monthly/ledger` | Monthly tag ledgers, per-tag bills, approve non-FR/CD tag requests |
| `ration` | `/ration/monthly` | Payout rates, sender banks, FR/CD requests, BEFTN letters / transfers |
| `admin` | `/admin` | Approve Daily state reports; also sees ration/consume + meal planning |

Demo login (API mode) is already specified in the frontend:

- Email `{role}@mess.rab` (e.g. `daily@mess.rab`)
- Password `ChangeMe!` (`SEED_STAFF_PASSWORD`)

---

## 2. Current frontend architecture (constraints on the API)

### Dual mode

| Flag | Behaviour |
|---|---|
| `NEXT_PUBLIC_USE_API` off | All writes go to `localStorage` (`STORE_KEY = mess_proto_v1`). No network. |
| `NEXT_PUBLIC_USE_API=true` | Bearer JWT + `/api/v1/*` via Next rewrite to FastAPI. |
| `NEXT_PUBLIC_ZK_DEMO` | ZKTeco punch demo even if full API is off. |

The API client (`src/lib/api/client.ts`) expects **this envelope**:

```json
{ "ok": true, "data": { } }
```

Errors:

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "detail": "Request failed",
  "errors": [{ "field": "rab_id", "code": "taken", "message": "RAB ID already exists" }]
}
```

- `204` is treated as success with empty body.
- Auth header: `Authorization: Bearer <access_token>`.
- Dates are ISO `YYYY-MM-DD`. Money is BDT with paisa rounding on the client (`roundPaisa`).

**Do not invent a different envelope.** The frontend already maps FastAPI `accepted` → UI `approved` for member approval.

### What already talks to an API

These modules are written. Implement them first so `USE_API=true` is usable.

| Area | Frontend module | Endpoints already called |
|---|---|---|
| Auth | `src/lib/api/auth.ts` | `POST /auth/login`, `POST /auth/logout` |
| Public register | `src/lib/api/register.ts` | `POST /public/register` |
| Members | `src/lib/api/members.ts` | `GET /members`, `POST /members` |
| Assignments | `src/lib/api/assignments.ts` | `GET /assignments`, `GET /assignments/summary`, `PUT /assignments`, `PUT /assignments/range`, `DELETE /assignments` |
| Day lock | `src/lib/api/days.ts` | `POST /days/{date}/approve`, `GET /days/locks` |
| Boro Khana | `src/lib/api/boro-khana.ts` | `GET /boro-khana`, `PUT /boro-khana/{date}` |
| Rates | `src/lib/api/settings.ts` | `GET/PUT/POST /settings/rates`, `DELETE /settings/rates/{tag}` |
| Senders | `src/lib/api/settings.ts` | `GET/POST /senders`, `PUT/DELETE /senders/{id}` |
| Mess | `src/lib/api/mess.ts` | `GET /mess/eaters`, `GET /mess/ledger` |
| ZK demo | `src/lib/api/zk-demo.ts` | `GET /zk/demo/status`, `/users`, `/attendance` |

### What is still local-only (must be added)

No `src/lib/api/*` client exists yet. These domains still mutate `AppState` in the browser.

| Domain | Store / UI | Why the server must own it |
|---|---|---|
| Member get / patch / approve / reject / end / status / bank | `users.ts`, `daily.ts` | Roster is the source of truth |
| Tag-change requests (3 queues) | `tag-requests.ts` | Cross-role workflow |
| Daily state reports | `state-reports.ts` | Admin approval of a snapshot |
| Org catalog (ranks, wings tree, forces, equivalents) | `org-options.ts` | Shared picklists |
| Authorized strength + officer absent | `org-options.ts`, manpower | Form-1 manpower |
| Meal shifts / plans / assigns / guests | `meal-*.ts` | Kitchen CMS analog |
| Pritibhoj events | `pritibhoj.ts` | Feast manpower sheets |
| Consume / ration **computed** reports | `reports.ts` | Can stay client-side at first; move later for print integrity |
| Document **file** upload | user form (`docsHint`) | Prototype stores name + size only |
| Staff user admin | login only | Need more than 6 seed accounts |

---

## 3. Recommended stack

Match what the frontend already assumes.

| Layer | Choice | Notes |
|---|---|---|
| API | **FastAPI** (Python 3.12+) | Envelope + OpenAPI; comments already say FastAPI |
| DB | **PostgreSQL 16** | Relational, date ranges, audit |
| ORM / migrations | SQLAlchemy 2 + Alembic | Or SQLModel if the team prefers |
| Auth | JWT access token (`expires_in` seconds) + optional refresh later | Login body `{ email, password }` |
| Password | Argon2id or bcrypt | Seed hash for `ChangeMe!` |
| Files | Object store (MinIO / S3) or local volume | Member documents |
| Cache (optional) | Redis | Day-lock / ZK poll later |
| Timezone | **Asia/Dhaka** for “today”, ISO date keys, meal-shift windows | Client `todayISO()` is local-browser today — server must use Dhaka |
| IDs | UUID (string) | Frontend today uses `u_`, `a_`, `tr_`, `sr_`, `s_`, `pb_` prefixes — either is fine if strings |
| Deploy | Docker Compose next to this frontend | Frontend already has `Dockerfile` + `Dockerfile.dev` |

Keep **one mess / one HQ**. There is no multi-battalion or branch dimension in the UI.

---

## 4. Domain model

Canonical TypeScript shapes live in `src/lib/types.ts`. Persist these as first-class tables (do not dump the whole `AppState` JSON).

### 4.1 Staff (operators)

```
staff
  id, email UNIQUE, password_hash, display_name
  role  ENUM(cc, daily, mess, consume, ration, admin)
  active, created_at, updated_at
```

Login returns:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 28800,
  "staff": { "id": "...", "email": "...", "display_name": "...", "role": "daily" }
}
```

Route prefixes the frontend already enforces (`src/lib/session.ts`):

| Role | Allowed path prefixes |
|---|---|
| cc | `/cc` |
| daily | `/daily` |
| mess | `/mess` |
| consume | `/consume` |
| ration | `/ration`, `/consume` |
| admin | `/admin`, `/ration`, `/consume`, `/mess/planning`, `/mess/reports`, `/mess/guests` |
| all | `/settings` |

Backend RBAC should match **write** rights, not just pages. Suggested matrix is in §7.

### 4.2 Members (the roster)

Frontend `User` / API `MemberApiRow`.

```
members
  id
  name
  personal_id          -- NID / personal no. Unique when non-empty (civilian + others)
  rab_id UNIQUE        -- civilians: CIV-{card} or CIV-NID-{nid} if blank
  rfid
  rank, wing, force, religion
  member_type          -- new | attached | permanent | guest | civilian
  dropdown_no          -- card no. (required for civilian)
  phone                -- normalize BD: 01XXXXXXXXX
  blood_group          -- A+ … AB- or empty
  status               -- '0' inactive | '1' active  (strings, not bool)
  approval_status      -- pending | approved | rejected | ended
                       -- also accept write alias "accepted" → approved
  default_tag          -- standing duty tag; empty cells project this (default MS)
  jl_end_date          -- last JL paint; day after → auto-inactivate
  joining_date, out_date
  documents_verified   -- civilian only
  bank_name, account_name, account_number, routing, branch, branch_location
  created_at, updated_at
```

Related:

```
member_documents       id, member_id, name, size, url, created_at
member_emergency       id, member_id, name, relation, phone
member_inactive_spans  id, member_id, from_date, to_date NULL
                       -- inclusive; to NULL = still inactive
```

**Validation the UI already applies** (`src/lib/store/users.ts`):

| `member_type` | Required |
|---|---|
| `guest` | name only; strip bank / docs / rank / wing |
| `civilian` | `dropdown_no`, `personal_id` (NID), name, rank, wing, ≥1 document |
| others | `personal_id`, name, rank, wing, ≥1 document |

- Bank name must be in the member-bank catalog (or empty).
- Account number + routing: digits only.
- Guests **never** appear on Daily cockpit / mess eaters / manpower (`isCockpitMember`).
- Unique `rab_id` (case-insensitive).

### 4.3 Duty tags & rates

Built-in codes (`DAILY_TAGS`):  
`FR CL PL WR CD WIT MED TRG MS MOL CMH RBH BGH AWL OSL RL JL PE LNK MFR`

Rate-only (Settings list, **not** cockpit pickers): `FUEL` (৳/day, default 50), `CLFR` (fixed ৳/month, default 2500).

```
allowance_rates
  tag PK, amount_per_day NUMERIC(12,2)
  is_builtin, is_protected
```

- Protected / built-in tags cannot be deleted.
- Custom tags: `^[A-Za-z0-9]{2,8}$`.
- Seed amounts: MS = 180; other `allowance: true` tags = 220; rest 0.

**Allowance vs mess flags** (business, not just labels):

| Tag | Pays ration? | Mess eater (normal day)? |
|---|---|---|
| FR, MS, MOL, CMH, RBH, BGH, AWL, OSL, MFR | yes (if rate > 0) | MS only |
| CD | no | Mess ledger column only |
| others | only if custom rate > 0 | no |

### 4.4 Daily assignments (cockpit cells)

```
assignments
  id
  member_id, date UNIQUE(member_id, date)
  tag
  trg_tone             -- black | red, only when tag = TRG
  source implicit      -- stored row vs projected
  updated_by, updated_at
```

Projection the **GET** must compute (frontend `AssignmentCell.source`):

| `source` | Meaning |
|---|---|
| `stored` | Row exists |
| `carry` | No row; member `default_tag` shown (not last painted tag) |
| `suppressed` | Daily cleared the cell; hide carry until Approve Day |
| `empty` | Inactive / before join / after out / no default |

```
suppressed_carries   member_id, date PK
approved_days        date PK, approved_by, approved_at
boro_khana_dates     date PK, set_by, set_at
```

### 4.5 Tag-change requests

```
tag_requests
  id
  member_id
  date, from_date, to_date     -- inclusive paint range
  from_tag, to_tag
  trg_tone, trg_sarda          -- TRG extras
  queue                        -- daily | ration | consume
  status                       -- requested | updated | rejected
  requested_by, requested_at
  updated_by, updated_at
```

**One open request per (member, queue).** Creating again replaces the pending row.

Routing (`dutyTagQueue`):

| `to_tag` | Queue | Who acts |
|---|---|---|
| MS, MFR | *immediate* (no request; write assignment now) | Daily |
| FR, CD | `ration` | Ration desk |
| everything else | `consume` | Consume desk |
| CC → Daily change | `daily` | Daily desk |

### 4.6 Org catalog

Editable Settings. Seed from `src/lib/constants.ts` (`RANKS`, `WINGS`, `ADMIN_SUB_WINGS`, `HQ_SUB_WINGS`, `FORCES`, `FORCE_DEFAULT_RANKS`, `DEFAULT_AUTHORIZED`, `MEMBER_BANKS`).

```
org_ranks            label PK, sort_order, elaborate_name
org_wings            label PK, parent_label NULL, elaborate_name
org_forces           label PK, sort_order
org_force_ranks      force, rank, is_extra, is_removed, elaborate_name
org_rank_equivalents rab_rank, force, service_rank
org_rank_force_wings rab_rank, force, wing
org_member_banks     label PK
authorized_strength  id, label, wing → count JSON, held_wings JSON (officer only)
manpower_officer_absent  date, wing, count
```

Wing tree: Admin → Admin sub-wings; HQ Br → HQ hub-wings. Reject cycles.

`authorized.count` **must always equal** sum of `wings`. Officer Form-1: `উপস্থিত = প্রাপ্ত − অনুপস্থিত`.

### 4.7 Sender (payout) accounts

```
senders
  id, label, bank_name, account_name, account_number, routing
  branch, branch_location
  mapped_tags TEXT[]
  active BOOL DEFAULT true
```

Inactive senders hidden from payout pickers. Deleting a custom rate must strip that tag from `mapped_tags`.

### 4.8 State reports

```
state_reports
  id, date, status (pending|approved|rejected)
  submitted_at, submitted_by
  reviewed_at, reviewed_by, note
  boro_khana BOOL
  totals JSON          -- { active, by_tag, mess_eaters }
  members JSON         -- snapshot: user_id, tag, mess_reason, name, rab_id, rank, wing
```

Submit **replaces** an existing pending row for the same date (frontend R3). Snapshot is frozen at submit time — do not recompute on review.

### 4.9 Kitchen (CMS analog)

```
meal_shifts          id, name, start_time, end_time, description
                     -- builtin ids: breakfast, lunch, dinner (name locked)
meal_plans           id, date UNIQUE, meals JSON [{ shift_id, count }]
meal_assigns         id, member_id, shift_id, date, check_in_time
                     status 1=unique 2=duplicate
guest_meals          id, shift_id, date, check_in_time, guest_name, guest_info, ref_info
```

Shift rules already implemented in the client (`MealShiftFail`): unique name, `HH:MM` windows (overnight OK), no overlap, cannot delete builtin or in-use shifts.

There is **no guest-create UI**. Guest + assign rows come from ZK (or a future punch API).

### 4.10 Pritibhoj

```
pritibhoj_events
  id, title, occasion, date, org, created_at
  main_rows JSON, admin_rows JSON   -- PritibhojRow[]
```

Row fields: `wing, officer, dad, azadHall, distribution, others, civilian, nonMuslim, total, azadHallDist, distribution2, totalDistribution`. Server should re-lock computed totals the same way `lockPritibhojSheets` does.

---

## 5. API surface

All paths below are under `/api/v1`. Auth: Bearer unless marked **public**.

### 5.1 Already specified — implement exactly

#### Auth

| Method | Path | Body / query | Data |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ access_token, token_type, expires_in, staff }` |
| POST | `/auth/logout` | — | `204` or empty ok |

#### Public register

| Method | Path | Notes |
|---|---|---|
| POST | `/public/register` | Same body as staff create **minus** status/approval. Always `pending`, typically `status=0` until Daily accepts. Returns `{ id, name, rab_id, approval_status, status }`. |

Body mapper: `toMemberEntryBody` in `src/lib/api/register.ts`.

#### Members (partial)

| Method | Path | Query / body |
|---|---|---|
| GET | `/members` | `q, status, approval, wing, rank, date_from, date_to, page, page_size` — `date_*` match **joining_date or out_date**. Return `{ items, total, page, page_size }`. |
| POST | `/members` | Staff create + optional `status`, `approval_status`. |

List default sort: RAB ID → rank seniority → name (`compareUsers`).

#### Assignments

| Method | Path | Notes |
|---|---|---|
| GET | `/assignments` | `month` **or** `from`+`to` **or** `date`; optional `member_id, rank, wing, q`. Returns **projected** cells `{ items, from, to }`. |
| GET | `/assignments/summary` | Same filters. `{ by_tag, total_tagged_person_days, member_count, from, to }`. |
| PUT | `/assignments` | `{ member_id, date, tag }` → `{ items: AssignmentCell[] }` |
| PUT | `/assignments/range` | `{ member_id, dates[], tag }` → `{ updated, items }` |
| DELETE | `/assignments` | `member_id`, `date` — suppress carry, unlock that day |

#### Days / Boro Khana / rates / senders / mess / ZK

Match `src/lib/api/days.ts`, `boro-khana.ts`, `settings.ts`, `mess.ts`, `zk-demo.ts` 1:1.

Mess eater extra fields on each member row: `assignment_id`, `mess_reason` (`MS` \| `FR` \| `BK`).

Ledger: `{ from, to, dates, tag_codes, rows[], boro_khana_days[] }`. Default `preview_future` is on unless `preview_future=false`. Mess ledger tags are **MS + CD** (`MESS_LEDGER_TAGS`).

### 5.2 Missing endpoints the UI will need

Add these in the same envelope. Frontend clients can be written after Phase 2+.

#### Members (complete)

| Method | Path | Purpose |
|---|---|---|
| GET | `/members/{id}` | Detail |
| PUT | `/members/{id}` | Full edit (CC / Daily) |
| PATCH | `/members/{id}/bank` | Ration desk bank fields only |
| POST | `/members/{id}/approve` | `approval=approved`, `status=1`; optional `{ default_tag, trg_tone }` |
| POST | `/members/{id}/reject` | `approval=rejected` |
| POST | `/members/{id}/end` | `approval=ended`, `status=0` |
| PATCH | `/members/{id}/status` | `{ status: "0"\|"1" }` + inactive-span rules |
| POST | `/members/{id}/documents` | multipart upload |
| PATCH | `/members/{id}/documents/verify` | civilian `documents_verified` |

Approve-with-tag (Daily roster): if tag is MS/MFR write assignment for today; if FR/CD create ration request; else create consume request. See `member-accept-actions.tsx`.

#### Tag requests

| Method | Path | Purpose |
|---|---|---|
| GET | `/tag-requests` | `queue, status, q` |
| GET | `/tag-requests/counts` | `{ daily, ration, consume }` pending — sidebar chips |
| POST | `/tag-requests` | CC create (`queue=daily`) `{ member_id, to_tag, from_date, to_date }` |
| POST | `/tag-requests/duty` | Daily create `{ member_id, to_tag, from_date, to_date, queue, trg_tone?, trg_sarda? }` |
| POST | `/tag-requests/{id}/apply` | Paint range + `status=updated` |
| POST | `/tag-requests/{id}/reject` | `status=rejected` |

#### State reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/state-reports` | list, `status`, `date` |
| GET | `/state-reports/{id}` | one |
| GET | `/state-reports/draft?date=` | live draft (not persisted) |
| POST | `/state-reports` | `{ date }` submit snapshot; replace pending for date |
| POST | `/state-reports/{id}/approve` | Admin |
| POST | `/state-reports/{id}/reject` | `{ note? }` |

#### Settings catalog

| Method | Path | Purpose |
|---|---|---|
| GET | `/settings/catalog` | ranks, wings+parent+labels, forces, force_ranks, extras/removed/labels, rank_equivalents, rank_force_wings, member_banks |
| PUT | `/settings/catalog` | or split POST/DELETE per entity (`addRank`, `addWing`, …) |
| GET/PUT | `/settings/authorized` | strength rows |
| PUT | `/settings/manpower-absent` | `{ date, wing, count }` |

#### Kitchen

| Method | Path | Purpose |
|---|---|---|
| CRUD | `/meal-shifts` | overlap / builtin / in-use errors (`EMPTY_NAME`, `BAD_TIME`, `OVERLAP`, `NAME_TAKEN`, `IN_USE`, `BUILTIN`) |
| CRUD | `/meal-plans` | one plan per date (`EMPTY`, `CONFLICT`, `NOT_FOUND`) |
| GET | `/meal-assigns` | `from, to, shift_id, status` |
| GET | `/guest-meals` | same filters |
| POST | `/meal-assigns/ingest` | ZK → unique/duplicate (status 1/2) |

#### Pritibhoj

`GET/POST /pritibhoj`, `GET/PUT/DELETE /pritibhoj/{id}`.

#### Reports (Phase 4 — optional if client keeps `reports.ts`)

If print integrity / BEFTN must be server-authoritative:

| Path | Mirrors |
|---|---|
| `GET /reports/consume/{month}` | `buildConsumeMonth` |
| `GET /reports/consume/{month}/tag/{tag}` | `buildTagBill` (FR adds FUEL/day) |
| `GET /reports/consume/{month}/wings` | `buildWingSummary` |
| `GET /reports/consume/{month}/ledger` | `buildMonthLedger` |
| `GET /reports/ration/{month}` | `buildRationReportClean` |
| `GET /reports/ration/{month}/staff` | `buildRationStaffLines` + split by member bank |
| `GET /reports/ration/{month}/transfers` | `buildRationTransferLines` / FR transfer sheets |
| `GET /reports/manpower?date=` | `buildManpowerReport` |

PDF generation can stay in the browser (`jspdf`) for v1.

---

## 6. Business rules the server must own

These are easy to get wrong if you only persist CRUD. Port the logic, do not re-derive from screenshots.

### 6.1 Who can be painted

`canAssignOnDate` (`src/lib/store/daily.ts`):

- Date ≥ `joining_date` (if set)
- Not inside any inactive span (inclusive; `to=null` means still inactive)
- Date ≤ `out_date` (out **day itself is allowed**)
- Not after `jl_end_date` (those days are inactive)

Status flip (`applyStatusToSpans`):

- To inactive (`0`): open a span from `min(joining, today)` if none open.
- To active (`1`): close open span at **yesterday**; clear `jl_end_date`.
- Delete assignments that fall on newly inactive dates.

### 6.2 Default tag vs carry

Empty cells show **`member.default_tag`**, not “last painted tag”. Temp paints (CL, PL, …) do not change the default.

- **Clear cell** → insert `suppressed_carries`; GET returns `source=suppressed`.
- **Approve day** (`POST /days/{date}/approve`) → for each assignable cockpit member with empty/suppressed cell, write `default_tag`, drop suppress, add `approved_days`. Response `{ date, filled, locked: true }`.
- Any later paint/clear on that date **unlocks** the day.

### 6.3 MFR lock

If `default_tag == MFR`, the member is locked to MFR on every assignable day.

- Only allowed write besides MFR is **FR** (unlocks: `default_tag` becomes FR).
- Painting MFR sets `default_tag = MFR`.

### 6.4 JL → auto inactive

After a JL paint, set `jl_end_date` to the last JL date. On the **next calendar day** (server “today” Asia/Dhaka):

- `status = 0`
- Open inactive span from the day after last JL
- Clear `jl_end_date`
- Drop assignments on inactive dates

Run this on a nightly job **and** on assignment writes (`syncUserAfterJl`).

### 6.5 TRG tone

| Force | Tone |
|---|---|
| Army, Navy, Air Force | always `black` |
| Police + Sarda checked | `black`, else `red` |
| Police / Ansar / BGB + “Training” checked | `black`, else `red` |
| everyone else | `red` |

Store `trg_tone` on the assignment (and on the tag request). Black cells render white text on the client.

### 6.6 Who eats mess

`getMessEaters` (`src/lib/store/mess.ts`):

- **Normal day:** approved + active + assignable + **explicit stored MS** (not carry-only, unless you adopt the projected-mess helper for “tomorrow”).
- **Boro Khana:** **all** approved + active + assignable.  
  `mess_reason`: MS if tag MS, FR if tag FR, else `BK`.

Mess ledger columns: MS and CD only. Boro Khana days listed separately with eater counts.

### 6.7 Consume / ration money

Port `src/lib/reports.ts` + `src/lib/store/rates.ts`:

- Amount = `roundPaisa(days × rate)`.
- **FR bills** add `FUEL` ৳/day (`getFuelRatePerDay`, default 50).
- **CLFR:** member has MS days **and** CL days in the month **and** zero FR days → one fixed monthly amount (`CLFR`, default 2500), **not** `FR_rate × CL_days`. Attached to CL lines on ration letters.
- Ration groups: active senders × `mapped_tags`. Unmapped paying tags listed separately.
- Staff letters **split by member bank**, sorted bank-wise then roster order.
- Transfer sheets: sender account → member account + routing; flag `missingBank` when account or routing empty.
- FR transfer can be per user or grouped by member bank (`buildFrTransferSheets*`).

### 6.8 Manpower (Form 1)

`src/lib/manpower-report.ts`:

- Categories = Officer + each Settings rank.
- Per authorized **root** wing (Admin collapsed): প্রাধিকৃত / প্রাপ্ত / উপস্থিত / অনুপস্থিত.
- Held for Officer comes from `held_wings`; others from live roster.
- Absence buckets from projected tags (CL, PL, RL, TRG, WIT, hospitals, …).
- Guest members excluded.

### 6.9 Public vs staff create

| | Public `/public/register` | Staff `POST /members` |
|---|---|---|
| Auth | none (rate-limit + optional QR token later) | Bearer |
| Approval | always `pending` | caller may set (Daily often creates approved) |
| Status | typically inactive until accept | Daily create often `status=1` |

Settings → QR is a public register deep-link (`RegisterQrSection`). Plan a signed, expiring token on that URL in a later phase.

---

## 7. RBAC (writes)

| Action | cc | daily | mess | consume | ration | admin |
|---|---|---|---|---|---|---|
| Public register | — | — | — | — | — | — |
| Create / edit member | yes | yes | | | bank patch | yes |
| Approve / reject / end / status | | yes | | | | yes |
| Paint MS / MFR / approve day / BK | | yes | | | | |
| Tag request create (daily queue) | yes | | | | | |
| Tag request apply/reject daily | | yes | | | | |
| Tag request apply FR/CD | | | | | yes | yes |
| Tag request apply other tags | | | | yes | | yes |
| Rates / senders | | | | | yes | yes |
| Org catalog / authorized | | yes* | | | yes | yes |
| Mess shifts / plans | | | yes | | | yes (planning) |
| State report submit | | yes | | | | |
| State report review | | | | | | yes |
| Pritibhoj | | | yes | | | |
| ZK ingest | | | yes | | | yes |

\*Daily needs ranks/wings/forces to operate the cockpit; treat catalog writes as admin/ration unless product says otherwise. Frontend Settings is open to every logged-in role — **tighten on the server**.

---

## 8. Implementation phases

### Phase 0 — Scaffold (3–5 days)

- FastAPI app, health, envelope middleware, CORS for Next.
- Postgres + Alembic, Docker Compose (`api`, `db`, optional `minio`).
- JWT login/logout + 6 seed staff.
- Problem codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DAY_LOCKED`, `MFR_LOCKED`, `INACTIVE_DATE`.

**Exit:** `POST /auth/login` works with `{role}@mess.rab` / `ChangeMe!`.

### Phase 1 — Members + catalog + rates + senders (1.5–2 weeks)

- Seed ranks / wings / forces / authorized / banks / built-in rates from `constants.ts`.
- Members CRUD + list filters + public register.
- Inactive spans on status change.
- Rates + senders (frontend already wired).

**Exit:** CC list/create and Settings rates/senders work with `USE_API=true`.

### Phase 2 — Daily cockpit (2 weeks)

- Projected `GET /assignments` (stored / carry / suppressed / empty).
- PUT/range/DELETE + MFR + JL + TRG tone + day unlock.
- Approve day + locks.
- Boro Khana.
- Member approve/reject/end/status (Daily roster).

**Exit:** `/daily/tags` month grid matches demo behaviour.

### Phase 3 — Requests + state reports (1 week)

- Three queues, counts, apply (range paint), reject.
- State report draft / submit / admin review.
- Nightly JL inactivation job.

**Exit:** CC → Daily → Ration/Consume request path; Admin state-report inbox.

### Phase 4 — Mess kitchen + ZK (1.5 weeks)

- Eaters + ledger (already specified).
- Shifts / plans CRUD.
- ZK demo proxy **or** ingest punches → `meal_assigns` (status 1 vs 2) + optional `guest_meals`.
- Meal reports can stay assembled on the client from these lists.

**Exit:** Mess ledger + reports + shifts.

### Phase 5 — Money reports + manpower + Pritibhoj (1.5 weeks)

- Either keep `reports.ts` client-side (faster) **or** add `/reports/*` so print/BEFTN cannot drift.
- Manpower + authorized + officer-absent writes.
- Pritibhoj CRUD.
- Document upload + civilian verify.

**Exit:** Consume bills, ration letters, Form-1, Pritibhoj persist.

### Phase 6 — Harden

- Audit log (`actor, action, entity, before/after, at`).
- Idempotent day-approve and request-apply.
- Rate-limit public register.
- Signed QR register token.
- Refresh tokens or shorter JWT + rotation.
- Backup / restore (replace Settings “reset demo seed”).
- OpenAPI published; contract tests against `src/lib/api/*.ts`.

---

## 9. Suggested PostgreSQL sketch

```text
staff
members
  + member_documents
  + member_emergency
  + member_inactive_spans
assignments                 UNIQUE (member_id, date)
suppressed_carries          PK (member_id, date)
approved_days
boro_khana_dates
tag_requests
allowance_rates
senders
org_*                       (ranks, wings, forces, mappings)
authorized_strength
manpower_officer_absent     PK (date, wing)
state_reports
meal_shifts
meal_plans                  UNIQUE (date)
meal_assigns                INDEX (date, shift_id, member_id)
guest_meals
pritibhoj_events
audit_events
```

Indexes that matter:

- `assignments (date)`, `assignments (member_id, date)`
- `members (approval_status, status)`, `members (wing, rank)`, `members USING gin (to_tsvector(...))` or `ILIKE` on name / rab_id / phone
- `tag_requests (queue, status)`
- `state_reports (date, status)`

---

## 10. Seed data

Port `src/lib/store/seed.ts` as a `python -m app.seed` command:

1. Six staff accounts.
2. Full org catalog + `DEFAULT_AUTHORIZED`.
3. Built-in + FUEL + CLFR rates.
4. One or two sender accounts mapped to FR / MS / MOL / …  
5. Optional demo members + a few months of assignments (frontend currently seeds previous 3 months). **Production seed should skip fake members.**

Do **not** port localStorage migration of Alpha/Bravo wings or old Army officer ladders — start clean from current constants.

---

## 11. Frontend follow-up (after API exists)

Not in this repo’s current task, but the API will be unused until:

1. `GET/PUT /members/{id}` wired on CC/Daily edit + detail.
2. Approve/reject/end/status leave `lib/store/daily.ts`.
3. Tag-request boards (`/cc/requested`, `/daily/requests`, `/ration/requests`, `/consume/requests`) call `/tag-requests`.
4. Settings catalog / authorized / banks leave `org-options.ts`.
5. State report pages call `/state-reports`.
6. Meal shifts/plans/pritibhoj call new routes.
7. `memberToUser` should stop inventing `inactive_spans` from `status` and should pass through `jl_end_date`, `force`, `documents_verified` from the API.

Until then, `USE_API=true` only covers login, member **list/create**, cockpit paint, rates, senders, mess read, BK, and day approve.

---

## 12. Non-functionals

| Topic | Plan |
|---|---|
| Consistency | Envelope + ISO dates + string status `"0"`/`"1"` + paisa rounding |
| Concurrency | Optimistic `updated_at` on member/assignment; unique `(member_id, date)` |
| Day lock | Server rejects paint on `approved_days` **unless** the write is approve-fill; any successful paint deletes the lock (matches client) |
| Audit | Every tag paint, request apply, member approval, rate change, BK toggle |
| PII | NID, phone, bank — TLS only; restrict bank PATCH to ration/admin |
| Files | Virus-scan later; v1: size cap + PDF/JPG |
| i18n | API messages in English codes; UI translates (`FieldError.code`) |
| ZK | Isolate `/zk/demo/*` behind a flag; production ingest is a separate adapter (device user_id ↔ `members.rfid`) |

---

## 13. Definition of done (backend v1)

1. `NEXT_PUBLIC_USE_API=true` login works for all six roles.
2. Daily cockpit month view matches demo: carry, suppress, MFR, JL, TRG tone, BK, approve-day lock.
3. CC can register; Daily can accept/reject; guests stay off the cockpit.
4. Tag requests flow CC → Daily and Daily → Ration (FR/CD) / Consume (other).
5. Mess eaters on a normal day = MS; on BK = everyone assignable.
6. Rates + senders persist; FR bill includes FUEL; CL+MS+no FR pays CLFR monthly.
7. Admin can approve/reject a frozen state-report snapshot.
8. Org catalog + authorized strength survive refresh (no localStorage).
9. OpenAPI matches `src/lib/api/*.ts` for Phase 1–2 routes.
10. Seed staff + catalog documented for ops.

---

## 14. Source map (frontend → backend)

| Implement this rule | Read this first |
|---|---|
| Types | `src/lib/types.ts` |
| Constants / seeds | `src/lib/constants.ts`, `src/lib/store/seed.ts` |
| Envelope / flags | `src/lib/api/client.ts`, `mode.ts`, `next.config.ts` |
| Existing contracts | `src/lib/api/*.ts` |
| Member validation | `src/lib/store/users.ts` |
| Inactive / MFR / JL | `src/lib/store/daily.ts` |
| Paint / carry / approve | `src/lib/store/assignments.ts` |
| Requests | `src/lib/store/tag-requests.ts` |
| Mess eaters | `src/lib/store/mess.ts` |
| Money | `src/lib/reports.ts`, `src/lib/store/rates.ts` |
| Manpower | `src/lib/manpower-report.ts` |
| TRG | `src/lib/trg-tone.ts` |
| Shifts | `src/lib/store/meal-shifts.ts` |
| State reports | `src/lib/store/state-reports.ts` |
| RBAC pages | `src/lib/session.ts`, `src/components/layout/role-nav.ts` |

This plan is the contract between the current UI and the API to be built. Prefer matching existing JSON keys over “cleaning up” names — the frontend is already deployed as a dual-mode client.