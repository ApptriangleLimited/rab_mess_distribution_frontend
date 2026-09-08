# RAB Mess Distribution — API Design

HTTP contract for the FastAPI backend. Honour every path and JSON key the Next.js client already calls (`src/lib/api/*.ts`). New routes use the same envelope, naming, and date/money rules.

Companion: [backend-plan.md](./backend-plan.md).

| | |
|---|---|
| Base URL | `/api/v1` |
| Proxy | Next rewrite → `API_PROXY_URL` or `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:8000`) |
| Transport | HTTPS in prod; JSON UTF-8 unless multipart |
| Timezone | `Asia/Dhaka` for “today”, day locks, JL inactivation, meal windows |
| Version | `v1` — no silent key renames |

**Legend**

- **LOCKED** — frontend already calls this; change breaks `USE_API=true`.
- **NEW** — designed here; no `src/lib/api` client yet.

---

## 1. Conventions

### 1.1 Success envelope

Every JSON success body (except `204`):

```json
{ "ok": true, "data": { } }
```

`data` is the type documented per endpoint. The client returns `data` only (`apiJson<T>`).

`204 No Content` is success with empty body (logout). Do not send `{ ok: true }` on 204.

### 1.2 Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "detail": "Human-readable summary",
  "errors": [
    { "field": "rab_id", "code": "taken", "message": "RAB ID already exists" }
  ]
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad types, missing required, bad date, bad tag regex |
| 400 | `BAD_TIME` / `EMPTY_NAME` / `OVERLAP` / `NAME_TAKEN` / `EMPTY` | Meal shift / plan rules (also in `code`) |
| 401 | `UNAUTHORIZED` | Missing / expired / bad JWT |
| 401 | `INVALID_CREDENTIALS` | Login email/password mismatch |
| 403 | `FORBIDDEN` | Authenticated but role cannot write |
| 404 | `NOT_FOUND` | Unknown id / tag / date row |
| 409 | `CONFLICT` | Unique clash (rab_id, meal plan date, open request) |
| 409 | `DAY_LOCKED` | Paint on an approved day that this write does not unlock-by-design — **do not use**: client expects paint to *unlock*. Prefer allowing the write and dropping the lock. |
| 409 | `MFR_LOCKED` | Paint other than FR/MFR on an MFR member |
| 409 | `INACTIVE_DATE` | Paint outside assignable window |
| 409 | `IN_USE` | Delete shift still referenced |
| 409 | `BUILTIN` | Delete breakfast/lunch/dinner |
| 409 | `PROTECTED_RATE` | Delete built-in / rate-only tag |
| 409 | `NOT_PENDING` | Apply/reject a request or report that is not `requested` / `pending` |
| 413 | `PAYLOAD_TOO_LARGE` | Document upload |
| 415 | `UNSUPPORTED_MEDIA` | Document type |
| 429 | `RATE_LIMITED` | Public register / login |
| 503 | `ZK_UNAVAILABLE` | Device unreachable (demo) |
| 500 | `INTERNAL_ERROR` | Unexpected |

`errors[].field` is a JSON path (`name`, `items.0.amount_per_day`). Omit `errors` when there is nothing field-specific.

### 1.3 Auth

```
Authorization: Bearer <access_token>
```

| Kind | Rule |
|---|---|
| **public** | No Bearer. Rate-limit. |
| **staff** | Any active staff JWT. |
| **roles: …** | Staff whose `role` is in the list. `admin` is **not** implied unless listed. |

Login JWT claims (minimum): `sub` = staff id, `role`, `exp`. `token_type` in the body is always `"bearer"`. `expires_in` is seconds (seed: `28800` = 8h).

Actor strings stored on rows: `{role}:{display_name}` (e.g. `daily:Rahim`).

### 1.4 Scalars

| Kind | Format | Notes |
|---|---|---|
| Date | `YYYY-MM-DD` | Calendar day in Dhaka |
| Month | `YYYY-MM` | |
| DateTime | ISO-8601 UTC with `Z` | `created_at`, `updated_at`, `punched_at` |
| Time | `HH:MM` 24h | Meal shifts; overnight `22:00`→`06:00` allowed |
| Money | number, 2 dp | `roundPaisa`: `Math.round(n * 100) / 100`, never negative |
| Status | `"0"` \| `"1"` | **strings**, not booleans |
| Approval | `pending` \| `approved` \| `rejected` \| `ended` | Writes may send `accepted` → store `approved` |
| ID | string | UUID or prefixed (`u_`, `tr_`, …). Treat as opaque. |
| Phone | BD normalized | Digits; leading `880` / `+880` → `01XXXXXXXXX` |
| Account / routing | digits only | Strip spaces and dashes on write |
| Tag | `A-Za-z0-9`, 2–8 | Uppercase on write. Built-ins listed in §2. |

Empty optional strings: accept `""` or omit. Dates in **write** bodies: empty → `null`. Dates in **member read**: prefer `string` (empty if unset) **and** allow `null` (client already coalesces).

### 1.5 Pagination

Default `page=1`, `page_size=25`. Allowed `page_size`: `10, 25, 50, 100`.

```json
{ "items": [], "total": 0, "page": 1, "page_size": 25 }
```

Omit pagination only when the frontend already expects an unpaged `{ items }` (rates, senders, eaters).

### 1.6 List filters

Ignore empty string and the literal `all` (client already drops them). Unknown query keys: ignore.

Search `q`: case-insensitive substring over `name`, `personal_id`, `rab_id`, `rfid`, `phone`, `dropdown_no`.

Member date filter `date_from` / `date_to`: inclusive window; a row matches if **joining_date or out_date** falls in the window. One side only → that single day.

### 1.7 Idempotency

| Write | Behaviour |
|---|---|
| PUT assignment same tag | Update `updated_at` / `updated_by`; return cell |
| PUT assignment range | Upsert those dates |
| POST tag-request | Replace the single open row for `(member, queue)` |
| POST state-report | Replace pending row for that `date` |
| POST day approve | If already locked, `{ filled: 0, locked: true }` |
| PUT boro-khana same `on` | No-op, return current |

---

## 2. Enumerations

### Roles

`cc` | `daily` | `mess` | `consume` | `ration` | `admin`

### Member

| Field | Values |
|---|---|
| `member_type` | `new` `attached` `permanent` `guest` `civilian` |
| `status` | `0` inactive, `1` active |
| `approval_status` | `pending` `approved` `rejected` `ended` (`accepted` alias on write) |
| `blood_group` | `A+` `A-` `B+` `B-` `O+` `O-` `AB+` `AB-` or `""` |
| `religion` | `Islam` `Hinduism` `Buddhism` `Christianity` `Other` or `""` |

### Duty tags (built-in)

`FR CL PL WR CD WIT MED TRG MS MOL CMH RBH BGH AWL OSL RL JL PE LNK MFR`

Rate-only (Settings, not cockpit pickers): `FUEL`, `CLFR`.

`trg_tone`: `black` | `red`.

### Assignment cell `source`

`stored` | `carry` | `suppressed` | `empty`

### Tag request

| Field | Values |
|---|---|
| `queue` | `daily` `ration` `consume` |
| `status` | `requested` `updated` `rejected` |

Queue routing for a **new duty** tag: `MS`/`MFR` → write now (no row); `FR`/`CD` → `ration`; else → `consume`. CC change requests always `queue=daily`.

### State report `status`

`pending` | `approved` | `rejected`

### Mess reason

`MS` | `FR` | `BK`

### Meal assign `status`

`1` unique, `2` duplicate (JSON numbers).

---

## 3. Shared schemas

### StaffPublic **LOCKED**

```json
{ "id": "st_…", "email": "daily@mess.rab", "display_name": "Daily Desk", "role": "daily" }
```

### DocumentMeta

```json
{ "name": "nid.pdf", "size": 120440, "url": "https://…/obj" }
```

`url` optional. Public register may send metadata only (no bytes).

### EmergencyContact

```json
{ "name": "Karim", "relation": "Brother", "phone": "01712345678" }
```

Drop rows where all three are blank.

### InactiveSpan

```json
{ "from": "2026-03-01", "to": "2026-03-20" }
```

`to` is `null` while still inactive.

### Member (read) — extend **LOCKED** `MemberApiRow`

Existing client keys stay. **NEW** keys are additive so `memberToUser` can stop inventing spans / JL.

```json
{
  "id": "u_…",
  "name": "Md. Rahim",
  "personal_id": "1985123456789",
  "rab_id": "RAB-10421",
  "rfid": "AABBCC",
  "rank": "ASI",
  "wing": "Ops Wg",
  "force": "Army",
  "religion": "Islam",
  "member_type": "permanent",
  "dropdown_no": "",
  "phone": "01712345678",
  "blood_group": "B+",
  "documents": [{ "name": "nid.pdf", "size": 120440, "url": null }],
  "documents_verified": false,
  "status": "1",
  "approval_status": "approved",
  "inactive_spans": [],
  "jl_end_date": "",
  "bank_name": "Trust bank",
  "account_name": "Md. Rahim",
  "account_number": "110200300",
  "routing": "020260025",
  "branch": "Gulshan",
  "branch_location": "Dhaka",
  "joining_date": "2024-01-15",
  "out_date": null,
  "default_tag": "MS",
  "emergency_contacts": [],
  "created_at": "2026-01-01T06:00:00Z",
  "updated_at": "2026-09-08T04:12:00Z"
}
```

Sort for lists: `rab_id` (numeric-aware) → rank seniority (catalog order) → `name`.

### MemberEntry (write)

What `toMemberEntryBody` already sends, plus recommended extras.

```json
{
  "name": "Md. Rahim",
  "rab_id": "RAB-10421",
  "personal_id": "1985123456789",
  "rfid": "AABBCC",
  "rank": "ASI",
  "wing": "Ops Wg",
  "force": "Army",
  "religion": "Islam",
  "member_type": "permanent",
  "dropdown_no": "",
  "phone": "01712345678",
  "blood_group": "B+",
  "bank_name": "Trust bank",
  "account_name": "Md. Rahim",
  "account_number": "110200300",
  "routing": "020260025",
  "branch": "Gulshan",
  "branch_location": "Dhaka",
  "joining_date": "2024-01-15",
  "out_date": null,
  "default_tag": "MS",
  "documents": [{ "name": "nid.pdf", "size": 120440, "url": null }],
  "emergency_contacts": [],
  "documents_verified": false,
  "status": "1",
  "approval_status": "pending"
}
```

| `member_type` | Required | Stripped |
|---|---|---|
| `guest` | `name` | bank, docs, rank, wing, force, religion, dates, contacts |
| `civilian` | `dropdown_no`, `personal_id`, `name`, `rank`, `wing`, ≥1 document | derive `rab_id` as `CIV-{card}` or `CIV-NID-{nid}` if blank |
| others | `personal_id`, `name`, `rank`, `wing`, ≥1 document | — |

- `bank_name` empty or must match member-bank catalog (case-insensitive → canonical label).
- Unique `rab_id` (case-insensitive). Unique `personal_id` when non-empty.
- `default_tag` default `"MS"`.
- Guests are never cockpit / mess / manpower members.

Staff `POST /members` may set `status` and `approval_status`. Public register **ignores** those and forces `approval_status=pending`, `status=0`.

### AssignmentCell **LOCKED**

```json
{
  "member_id": "u_…",
  "date": "2026-09-08",
  "tag": "MS",
  "source": "stored",
  "trg_tone": "black",
  "updated_at": "2026-09-08T04:12:00Z",
  "updated_by": "daily:Rahim"
}
```

`tag` is `null` when `source` is `suppressed` or `empty`. `trg_tone` only when tag is `TRG`.

Projection:

| `source` | Rule |
|---|---|
| `stored` | Row exists |
| `carry` | No row; assignable; not suppressed; `default_tag` (MFR lock → always `MFR`) |
| `suppressed` | Row in `suppressed_carries` |
| `empty` | Not assignable, or no default |

### SenderAccount **LOCKED**

```json
{
  "id": "s_…",
  "label": "Fresh Money — Trust",
  "bank_name": "Trust bank",
  "account_name": "RAB HQ Mess",
  "account_number": "001122",
  "routing": "020260025",
  "branch": "Gulshan",
  "branch_location": "Dhaka",
  "mapped_tags": ["FR", "MS", "MOL"],
  "active": true
}
```

`active` default `true`. Digits-only account/routing.

### RateApiRow **LOCKED**

```json
{ "tag": "MS", "amount_per_day": 180.0, "is_builtin": true, "is_protected": true }
```

`CLFR.amount_per_day` is a **monthly** fixed amount (name kept for the locked client).

### TagRequest **NEW** (matches `src/lib/types.ts`)

```json
{
  "id": "tr_…",
  "user_id": "u_…",
  "date": "2026-09-08",
  "from_date": "2026-09-08",
  "to_date": "2026-09-10",
  "from_tag": "MS",
  "to_tag": "CL",
  "trg_tone": "red",
  "trg_sarda": false,
  "queue": "consume",
  "status": "requested",
  "requested_by": "daily:Rahim",
  "requested_at": "2026-09-08T04:12:00Z",
  "updated_by": null,
  "updated_at": "2026-09-08T04:12:00Z"
}
```

`user_id` is the member id (frontend name). One open (`requested`) row per `(user_id, queue)`.

### DailyStateReport **NEW**

```json
{
  "id": "sr_…",
  "date": "2026-09-08",
  "status": "pending",
  "submitted_at": "2026-09-08T10:00:00Z",
  "submitted_by": "daily:Rahim",
  "reviewed_at": null,
  "reviewed_by": null,
  "note": null,
  "boro_khana": false,
  "members": [
    {
      "user_id": "u_…",
      "tag": "MS",
      "mess_reason": null,
      "name": "Md. Rahim",
      "rab_id": "RAB-10421",
      "rank": "ASI",
      "wing": "Ops Wg"
    }
  ],
  "totals": { "active": 12, "by_tag": { "MS": 8, "FR": 4 }, "mess_eaters": 8 }
}
```

On Boro Khana, `mess_reason` is `MS` | `FR` | `BK`. Snapshot is frozen at submit.

### MealShift / MealPlan / MealAssign / GuestMeal / Pritibhoj

Match `src/lib/types.ts` field-for-field (see §12–§13).

---

## 4. Endpoint index

| Method | Path | Auth | Status |
|---|---|---|---|
| GET | `/health` | public | **NEW** |
| POST | `/auth/login` | public | **LOCKED** |
| POST | `/auth/logout` | staff | **LOCKED** |
| GET | `/auth/me` | staff | **NEW** |
| GET / POST | `/staff` | admin | **NEW** |
| PATCH | `/staff/{id}` | admin | **NEW** |
| POST | `/staff/{id}/password` | admin or self | **NEW** |
| POST | `/public/register` | public | **LOCKED** |
| GET / POST | `/members` | staff / roles | **LOCKED** |
| GET / PUT | `/members/{id}` | staff / roles | **NEW** |
| PATCH | `/members/{id}/bank` | ration, admin | **NEW** |
| PATCH | `/members/{id}/status` | daily, admin | **NEW** |
| POST | `/members/{id}/approve` | daily, admin | **NEW** |
| POST | `/members/{id}/reject` | daily, admin | **NEW** |
| POST | `/members/{id}/end` | daily, admin | **NEW** |
| POST | `/members/{id}/documents` | cc, daily, admin | **NEW** |
| DELETE | `/members/{id}/documents/{doc_id}` | cc, daily, admin | **NEW** |
| PATCH | `/members/{id}/documents/verify` | daily, admin | **NEW** |
| GET / PUT | `/assignments` | staff / daily, admin | **LOCKED** |
| GET | `/assignments/summary` | staff | **LOCKED** |
| PUT | `/assignments/range` | daily, admin | **LOCKED** |
| DELETE | `/assignments` | daily, admin | **LOCKED** |
| POST | `/days/{date}/approve` | daily, admin | **LOCKED** |
| GET | `/days/locks` | staff | **LOCKED** |
| GET / PUT | `/boro-khana` , `/boro-khana/{date}` | staff / daily, admin | **LOCKED** |
| GET / POST / PUT / DELETE | `/settings/rates` | see §10 | **LOCKED** |
| GET | `/settings/catalog` | staff | **NEW** |
| POST / PATCH / DELETE | `/settings/ranks` … | daily*, ration, admin | **NEW** |
| GET / PUT | `/settings/authorized` | daily*, ration, admin | **NEW** |
| PUT | `/settings/manpower-absent` | daily, admin | **NEW** |
| GET / POST / PUT / DELETE | `/senders` | see §11 | **LOCKED** |
| GET | `/mess/eaters` | staff | **LOCKED** |
| GET | `/mess/ledger` | staff | **LOCKED** |
| CRUD | `/meal-shifts` | mess, admin | **NEW** |
| CRUD | `/meal-plans` | mess, admin | **NEW** |
| GET | `/meal-assigns` | mess, admin | **NEW** |
| POST | `/meal-assigns/ingest` | mess, admin | **NEW** |
| GET | `/guest-meals` | mess, admin | **NEW** |
| GET / POST | `/tag-requests` | see §9 | **NEW** |
| GET | `/tag-requests/counts` | staff | **NEW** |
| POST | `/tag-requests/duty` | daily, admin | **NEW** |
| POST | `/tag-requests/{id}/apply` | queue owner | **NEW** |
| POST | `/tag-requests/{id}/reject` | queue owner | **NEW** |
| GET / POST | `/state-reports` | daily, admin | **NEW** |
| GET | `/state-reports/draft` | daily, admin | **NEW** |
| GET | `/state-reports/{id}` | daily, admin | **NEW** |
| POST | `/state-reports/{id}/approve` | admin | **NEW** |
| POST | `/state-reports/{id}/reject` | admin | **NEW** |
| CRUD | `/pritibhoj` | mess, admin | **NEW** |
| GET | `/reports/…` | consume, ration, admin | **NEW** |
| GET | `/zk/demo/status` | staff | **LOCKED** |
| GET | `/zk/demo/users` | staff | **LOCKED** |
| GET | `/zk/demo/attendance` | staff | **LOCKED** |

\*Catalog writes: allow `daily` only if product keeps Settings open; otherwise ration + admin. Server should be stricter than the current UI.

---

## 5. Health & auth

### `GET /health` **NEW** — public

```json
{ "status": "ok", "time": "2026-09-08T06:05:00Z", "db": "ok" }
```

HTTP 200 even if `db` is `down` (use `status: "degraded"`). For k8s liveness prefer a separate `/live` that does not touch the DB.

### `POST /auth/login` **LOCKED** — public

Request:

```json
{ "email": "daily@mess.rab", "password": "ChangeMe!" }
```

`200 data`:

```json
{
  "access_token": "eyJ…",
  "token_type": "bearer",
  "expires_in": 28800,
  "staff": {
    "id": "st_daily",
    "email": "daily@mess.rab",
    "display_name": "Daily Desk",
    "role": "daily"
  }
}
```

`401 INVALID_CREDENTIALS` if email unknown, password wrong, or staff inactive. Do not distinguish which. Rate-limit by IP + email.

Seed accounts: `{role}@mess.rab` / `ChangeMe!` for each role.

### `POST /auth/logout` **LOCKED** — staff

`204` preferred. If a denylist is used, blacklist `jti` until `exp`. Client clears local token even if this fails.

### `GET /auth/me` **NEW** — staff

`200 data`: `StaffPublic` plus `"active": true`.

---

## 6. Staff admin **NEW**

Roles: **admin** except password (self or admin).

### `GET /staff`

Query: `q`, `role`, `active` (`true`/`false`).  
`200 data`: `{ "items": StaffPublic[] }` (include `active`).

### `POST /staff`

```json
{
  "email": "daily2@mess.rab",
  "password": "ChangeMe!",
  "display_name": "Daily 2",
  "role": "daily"
}
```

`201 data`: `StaffPublic`. `409 CONFLICT` on email.

### `PATCH /staff/{id}`

```json
{ "display_name": "…", "role": "ration", "active": false }
```

Cannot deactivate the last active admin.

### `POST /staff/{id}/password`

```json
{ "password": "NewSecret1!" }
```

Self may change own password; admin may change any.

---

## 7. Public register & members

### `POST /public/register` **LOCKED** — public

Body: `MemberEntry` without `status` / `approval_status` (ignored if sent).

`201 data`:

```json
{
  "id": "u_…",
  "name": "Md. Rahim",
  "rab_id": "RAB-10421",
  "approval_status": "pending",
  "status": "0"
}
```

Rate-limit. Later: optional `?token=` signed QR (Settings → Register QR).

### `GET /members` **LOCKED** — staff

| Query | Type | Notes |
|---|---|---|
| `q` | string | Search |
| `status` | `0` `1` | |
| `approval` | approval enum | |
| `wing` `rank` | string | Exact catalog label |
| `date_from` `date_to` | date | Joining or out |
| `page` `page_size` | int | Default 1 / 25 |

`200 data`: `{ items: Member[], total, page, page_size }`.

Daily cockpit calls this with `approval=approved` and often `status=1`.

### `POST /members` **LOCKED** — cc, daily, admin

Body: `MemberEntry`. Daily typically sends `status=1`, `approval_status=approved`. CC typically `pending`.

`201 data`: `Member`.

### `GET /members/{id}` **NEW** — staff

`200 data`: `Member`. `404` if missing.

### `PUT /members/{id}` **NEW** — cc, daily, admin

Body: `MemberEntry` (no id). Recomputes inactive spans if `status` changes. Drops assignments on newly inactive dates. MFR member: `default_tag` may only stay `MFR` or become `FR`.

`200 data`: `Member`.

### `PATCH /members/{id}/bank` **NEW** — ration, admin

```json
{
  "bank_name": "Sonali Bank",
  "account_name": "Md. Rahim",
  "account_number": "110200300",
  "routing": "200270325",
  "branch": "Motijheel",
  "branch_location": "Dhaka"
}
```

`200 data`: `Member`.

### `PATCH /members/{id}/status` **NEW** — daily, admin

```json
{ "status": "0" }
```

Applies `applyStatusToSpans`. Activating (`1`) clears `jl_end_date`. `200 data`: `Member`.

### `POST /members/{id}/approve` **NEW** — daily, admin

```json
{
  "default_tag": "MS",
  "today_tag": "CL",
  "trg_tone": "red",
  "trg_sarda": false,
  "training": false
}
```

All fields optional.

1. Set `approval_status=approved`, `status=1`.
2. If `default_tag` present, set it (MFR rules apply).
3. If `today_tag` present (Daily accept-with-tag):
   - `MS` / `MFR` → PUT assignment for **today**
   - `FR` / `CD` → create/replace ration tag-request
   - else → create/replace consume tag-request (TRG extras if sent)

`200 data`:

```json
{
  "member": { },
  "assignment": null,
  "tag_request": null
}
```

`assignment` / `tag_request` filled when step 3 ran.

### `POST /members/{id}/reject` **NEW** — daily, admin

Empty body. Sets `approval_status=rejected`. Does not have to flip `status`.  
`200 data`: `Member`.

### `POST /members/{id}/end` **NEW** — daily, admin

Empty body. Sets `approval_status=ended`, `status=0` + inactive span.  
`200 data`: `Member`.

### `POST /members/{id}/documents` **NEW** — cc, daily, admin

`multipart/form-data` field `file`. Max 8 MB. `application/pdf`, `image/jpeg`, `image/png`.

`201 data`: `DocumentMeta` (with `url`).

### `DELETE /members/{id}/documents/{doc_id}` **NEW** — cc, daily, admin

`200 data`: `{ "id": "doc_…" }`.

### `PATCH /members/{id}/documents/verify` **NEW** — daily, admin

```json
{ "documents_verified": true }
```

Civilian only; `400` otherwise. `200 data`: `Member`.

---

## 8. Assignments, days, Boro Khana

Assignable = approved cockpit member, date ≥ join, ≤ out (out day allowed), not in an inactive span, not after `jl_end_date`.

Writes (except GET) **unlock** that date (remove from `approved_days`).

Painting `MFR` sets `default_tag=MFR`. Painting `FR` on an MFR member sets `default_tag=FR`. Other paints on MFR → `409 MFR_LOCKED`.

Painting `JL` updates `jl_end_date` to the latest JL date; if today (Dhaka) is after that date, inactivate immediately.

`TRG` without `trg_tone`: resolve from `force` (Army/Navy/Air Force → black; else red). Client may send `trg_tone` and `trg_sarda` / `training` on range writes.

### `GET /assignments` **LOCKED** — staff

Provide **one** of: `month=YYYY-MM` | `from`+`to` | `date`. Optional: `member_id`, `rank`, `wing`, `q`.

If none of the date selectors are sent → `400 VALIDATION_ERROR`.

Returns **projected** cells for every matching cockpit member × each date in range (not only stored rows).

`200 data`:

```json
{
  "items": [ { "member_id": "u_…", "date": "2026-09-08", "tag": "MS", "source": "carry" } ],
  "from": "2026-09-01",
  "to": "2026-09-30"
}
```

### `GET /assignments/summary` **LOCKED** — staff

Same query. Counts use **projected** tags (stored + carry), not suppressed/empty.

`200 data`:

```json
{
  "from": "2026-09-01",
  "to": "2026-09-30",
  "by_tag": { "MS": 120, "FR": 40 },
  "total_tagged_person_days": 160,
  "member_count": 80
}
```

### `PUT /assignments` **LOCKED** — daily, admin

```json
{ "member_id": "u_…", "date": "2026-09-08", "tag": "CL", "trg_tone": "red" }
```

`trg_tone` optional **NEW** (ignored unless tag is TRG).  
`200 data`: `{ "items": [ AssignmentCell ] }` — the written cell (`source=stored`). Clears suppress for that pair.

### `PUT /assignments/range` **LOCKED** — daily, admin

```json
{ "member_id": "u_…", "dates": ["2026-09-08", "2026-09-09"], "tag": "CL" }
```

Skip dates that are not assignable (do not fail the whole call).  
`200 data`: `{ "updated": 2, "items": [ AssignmentCell, … ] }`.

### `DELETE /assignments` **LOCKED** — daily, admin

Query (required): `member_id`, `date`.

Deletes stored row (if any), **inserts suppress**, unlocks the day.  
`200 data`: `{ "items": [ { "member_id", "date", "tag": null, "source": "suppressed" } ] }`.

### `POST /days/{date}/approve` **LOCKED** — daily, admin

`{date}` is `YYYY-MM-DD`. Empty body.

For each assignable cockpit member that day: if cell is empty or suppressed, write `default_tag` (skip if none). Clear those suppresses. Insert `approved_days`.

`200 data`: `{ "date": "2026-09-08", "filled": 14, "locked": true }`.

### `GET /days/locks` **LOCKED** — staff

Query required: `from`, `to`.  
`200 data`: `{ "dates": ["2026-09-07"], "from": "2026-09-01", "to": "2026-09-30" }`.

### `GET /boro-khana` **LOCKED** — staff

Query required: `from`, `to`.  
`200 data`: `{ "dates": ["2026-09-15"], "from": "…", "to": "…" }`.

### `PUT /boro-khana/{date}` **LOCKED** — daily, admin

```json
{ "on": true }
```

`200 data`: `{ "date": "2026-09-15", "on": true }`.

---

## 9. Tag requests **NEW**

Roles:

| Action | Roles |
|---|---|
| List / counts | staff (filter to own queues in UI; API may return all) |
| `POST /tag-requests` | cc, admin |
| `POST /tag-requests/duty` | daily, admin |
| Apply / reject `queue=daily` | daily, admin |
| Apply / reject `queue=ration` | ration, admin |
| Apply / reject `queue=consume` | consume, admin |

### `GET /tag-requests`

| Query | Notes |
|---|---|
| `queue` | `daily` `ration` `consume` |
| `status` | default all; sidebar uses `requested` |
| `user_id` | member |
| `q` | member search |
| `page` `page_size` | |

`200 data`: `{ items: TagRequest[], total, page, page_size }` newest `requested_at` first.

### `GET /tag-requests/counts`

`200 data`: `{ "daily": 3, "ration": 1, "consume": 2 }` — pending (`requested`) only.

### `POST /tag-requests`

CC → Daily queue.

```json
{
  "user_id": "u_…",
  "to_tag": "CL",
  "from_date": "2026-09-08",
  "to_date": "2026-09-10"
}
```

- Member must be `approved` and assignable on `from_date`.
- `to_tag` ≠ current cockpit tag on `from_date`.
- MFR member: only `FR` allowed as `to_tag`.
- Replaces existing pending `(user_id, daily)`.
- `from_tag` snapshotted from cockpit projection.
- `date` = `from_date`.

`201 data`: `TagRequest`.

### `POST /tag-requests/duty`

Daily → Ration or Consume.

```json
{
  "user_id": "u_…",
  "to_tag": "FR",
  "from_date": "2026-09-08",
  "to_date": "2026-09-12",
  "queue": "ration",
  "trg_tone": "black",
  "trg_sarda": false
}
```

`queue` must match routing (`FR`/`CD` → `ration`, else `consume`). `400` if mismatched.  
`201 data`: `TagRequest`.

### `POST /tag-requests/{id}/apply`

Empty body. Paints `to_tag` on every assignable date in `[from_date, to_date]` (same as range PUT, with `trg_tone` from the request). Sets `status=updated`.

`200 data`: `{ "request": TagRequest, "updated": 3, "items": [ AssignmentCell ] }`.  
`409 NOT_PENDING` if not `requested`.

### `POST /tag-requests/{id}/reject`

Empty body. `status=rejected`. Does not change assignments.  
`200 data`: `TagRequest`.

---

## 10. Settings — rates **LOCKED** & catalog **NEW**

### Rates — ration, admin (GET: staff)

#### `GET /settings/rates`

`200 data`: `{ "items": RateApiRow[] }` — built-ins first (DAILY_TAGS order), then custom, including `FUEL` and `CLFR`.

#### `PUT /settings/rates`

```json
{ "items": [ { "tag": "MS", "amount_per_day": 180 }, { "tag": "FUEL", "amount_per_day": 50 } ] }
```

Replaces amounts for listed tags; always ensure `FUEL` + `CLFR` exist after write.  
`200 data`: `{ "items": RateApiRow[] }` full list.

#### `POST /settings/rates`

```json
{ "tag": "XTRA", "amount_per_day": 100 }
```

Tag `^[A-Za-z0-9]{2,8}$`, unique case-insensitive. Cannot collide with built-in / rate-only.  
`201 data`: `RateApiRow` (`is_builtin=false`, `is_protected=false`).

#### `DELETE /settings/rates/{tag}`

Cannot delete protected (built-in or `FUEL`/`CLFR`). Also strip `{tag}` from every sender `mapped_tags`.  
`200 data`: `{ "tag": "XTRA" }`.

### Catalog — GET staff; writes ration, admin (optional daily)

#### `GET /settings/catalog`

```json
{
  "ranks": ["DAD", "RT", "ASI"],
  "rank_labels": { "DAD": "Deputy Assistant Director" },
  "wings": ["Ops Wg", "Admin", "Fin Br"],
  "wing_parent": { "Fin Br": "Admin" },
  "wing_labels": { "Ops Wg": "Operations Wing" },
  "forces": ["Army", "Navy"],
  "force_ranks": { "Army": ["SWO", "WO"] },
  "force_rank_extras": { "Army": [] },
  "force_rank_removed": { "Army": [] },
  "force_rank_labels": { "Army": { "SWO": "Senior Warrant Officer" } },
  "rank_forces": { "DAD": ["Army"] },
  "rank_equivalents": { "DAD": { "Army": ["OR", "L/Cpl"] } },
  "rank_force_wings": { "DAD": { "Army": ["Ops Wg"] } },
  "member_banks": ["Trust bank", "Community bank", "Sonali Bank"]
}
```

Core RAB ranks/wings/forces from `constants.ts` cannot be deleted; extras can.

#### Ranks

| Method | Path | Body | Data |
|---|---|---|---|
| POST | `/settings/ranks` | `{ "label", "elaborate"? }` | `{ "label" }` |
| PATCH | `/settings/ranks/{label}` | `{ "elaborate"? }` | `{ "label", "elaborate" }` |
| DELETE | `/settings/ranks/{label}` | — | `{ "label" }` |

`label` path-encoded. DELETE `409` if members still use it or rank is built-in.

#### Wings

| Method | Path | Body |
|---|---|---|
| POST | `/settings/wings` | `{ "label", "parent"?: string \| null, "elaborate"? }` |
| PATCH | `/settings/wings/{label}` | `{ "parent"?, "elaborate"? }` |
| DELETE | `/settings/wings/{label}` | — |

Reject cycles (`400`). Banned legacy labels (`Alpha`…`Support`) → `400`.

#### Forces

`POST /settings/forces` `{ "label" }`  
`DELETE /settings/forces/{label}` — not if built-in or in use.

#### Force ranks

`POST /settings/forces/{force}/ranks` `{ "label", "elaborate"? }` — extra  
`DELETE /settings/forces/{force}/ranks/{label}` — marks default ranks **removed**, deletes extras  
`PATCH /settings/forces/{force}/ranks/{label}` `{ "elaborate" }`

#### Equivalents & wings-under-rank

`PUT /settings/rank-equivalents/{rank}`  

```json
{ "by_force": { "Army": ["OR", "L/Cpl"] } }
```

`PUT /settings/rank-force-wings/{rank}`  

```json
{ "by_force": { "Army": ["Ops Wg", "Int Wg"] } }
```

Replacing `by_force` also refreshes `rank_forces` = keys of equivalents (or of wings if no equivalents).

#### Member banks

`POST /settings/member-banks` `{ "label" }`  
`DELETE /settings/member-banks/{label}` — not if built-in or members still reference it.

### Authorized strength

#### `GET /settings/authorized` **NEW** — staff

`200 data`: `{ "items": AuthorizedStrength[] }`

```json
{
  "id": "auth_officer",
  "label": "Officer",
  "count": 184,
  "wings": { "Admin": 24, "Ops Wg": 16 },
  "held_wings": { "Admin": 20 }
}
```

`count` is always the sum of `wings`. Officer is first; then one row per Settings rank.

#### `PUT /settings/authorized` **NEW** — ration, admin

```json
{
  "items": [
    { "id": "auth_officer", "label": "Officer", "wings": { "Admin": 24 }, "held_wings": { "Admin": 20 } }
  ]
}
```

Server recomputes `count`. Creating a new Settings rank should add an empty authorized row.

#### `PUT /settings/authorized/{id}/wings/{wing}` **NEW**

```json
{ "count": 24 }
```

Wing must be an authorized root (`Admin`, `Ops Wg`, …). Admin family keys roll up to Admin.

#### `PUT /settings/authorized/{id}/held/{wing}` **NEW**

Officer only. `{ "count": 20 }`.

### Manpower officer absent

#### `PUT /settings/manpower-absent` **NEW** — daily, admin

```json
{ "date": "2026-09-08", "wing": "Ops Wg", "count": 2 }
```

`count=0` deletes the cell.  
`200 data`: `{ "date", "wing", "count" }`.

#### `GET /settings/manpower-absent` **NEW** — staff

Query: `from`, `to`.  
`200 data`: `{ "items": [ { "date", "wing", "count" } ] }`.

---

## 11. Senders **LOCKED**

GET: staff. Writes: ration, admin.

### `GET /senders`

`200 data`: `{ "items": SenderAccount[] }` — include inactive; client hides `active===false` from pickers.

### `POST /senders`

Body: `SenderAccount` minus `id`.  
`201 data`: `SenderAccount`.

### `PUT /senders/{id}`

Full replace (same body as create).  
`200 data`: `SenderAccount`.

### `DELETE /senders/{id}`

Hard delete.  
`200 data`: `{ "id": "s_…" }`.

---

## 12. Mess, kitchen, ZK

### `GET /mess/eaters` **LOCKED** — staff

Query: **`date` required**; optional `rank`, `wing`, `q`.

**Normal day:** approved + active + assignable + **stored MS**.  
**Boro Khana:** all approved + active + assignable.  
`mess_reason`: MS / FR / BK from projected tag.  
`assignment_id`: stored id or `bk-{member_id}-{date}`.

`200 data`:

```json
{
  "date": "2026-09-08",
  "boro_khana": false,
  "items": [ { "…Member": true, "assignment_id": "a_…", "mess_reason": "MS" } ],
  "total": 42
}
```

Sorted by `name`. Guests excluded.

### `GET /mess/ledger` **LOCKED** — staff

Query: **`from` `to` required**; optional `rank`, `wing`, `q`; `preview_future=false` to hide carry on future days (default: preview on).

`tag_codes` is always `["MS","CD"]`.  
`days[i]` is the tag for `dates[i]` or `""`. Carry fills empty days (≤ today, or future if preview). Boro Khana days listed separately (everyone assignable).

`200 data`:

```json
{
  "from": "2026-09-01",
  "to": "2026-09-30",
  "dates": ["2026-09-01", "2026-09-02"],
  "tag_codes": ["MS", "CD"],
  "rows": [
    {
      "member": { },
      "days": ["MS", ""],
      "tag_counts": { "MS": 1 },
      "total_days": 1
    }
  ],
  "boro_khana_days": [{ "date": "2026-09-15", "eater_count": 80 }]
}
```

### Meal shifts **NEW** — mess, admin (GET: staff)

Builtin ids (name locked): `breakfast`, `lunch`, `dinner`.

| Method | Path | Body | Errors |
|---|---|---|---|
| GET | `/meal-shifts` | — | `{ items: MealShift[] }` sorted by `start_time` |
| POST | `/meal-shifts` | `{ name, start_time, end_time, description }` | `EMPTY_NAME` `BAD_TIME` `OVERLAP` `NAME_TAKEN` |
| PUT | `/meal-shifts/{id}` | same; name ignored for builtin | same + `NOT_FOUND` |
| DELETE | `/meal-shifts/{id}` | — | `BUILTIN` `IN_USE` `NOT_FOUND` |

```json
{
  "id": "breakfast",
  "name": "Breakfast",
  "start_time": "06:30",
  "end_time": "09:00",
  "description": "",
  "created_at": "…",
  "updated_at": "…"
}
```

Windows may wrap midnight. Zero-length (`start==end`) is `BAD_TIME`. Overlap uses half-open `[start, end)`.

### Meal plans **NEW** — mess, admin (GET: staff)

One plan per date. Counts ≤ 0 dropped. Unknown `shift_id` dropped.

| Method | Path | Body | Errors |
|---|---|---|---|
| GET | `/meal-plans` | query `from` `to` | `{ items: MealPlan[] }` newest date first |
| GET | `/meal-plans/{date}` | — | `MealPlan` or 404 |
| POST | `/meal-plans` | `{ date, meals: [{ shift_id, count }] }` | `EMPTY` `CONFLICT` |
| PUT | `/meal-plans/{date}` | `{ meals }` | `EMPTY` `NOT_FOUND` |
| DELETE | `/meal-plans/{date}` | — | `NOT_FOUND` → `{ date }` |

```json
{
  "id": "mp_20260908",
  "date": "2026-09-08",
  "meals": [{ "shift_id": "lunch", "count": 420 }],
  "created_at": "…",
  "updated_at": "…"
}
```

### Meal assigns & guests **NEW** — GET: mess, admin

#### `GET /meal-assigns`

Query: `from`, `to` (required), `shift_id`, `status` (`1`/`2`), `member_id`, `page`, `page_size`.

`200 data`: paged `{ items: MealAssign[] }`.

```json
{
  "id": "ma_…",
  "member_id": "u_…",
  "shift_id": "lunch",
  "status": 1,
  "date": "2026-09-08",
  "check_in_time": "2026-09-08T06:41:00Z",
  "created_at": "…",
  "updated_at": "…"
}
```

#### `POST /meal-assigns/ingest`

ZK (or device adapter) → kitchen row.

```json
{
  "member_id": "u_…",
  "shift_id": "lunch",
  "date": "2026-09-08",
  "check_in_time": "2026-09-08T06:41:00Z"
}
```

Resolve member by `member_id` **or** `rfid` / `zk_user_id` (send one).  
First unique punch that day+shift → `status=1`; later → `status=2`.  
`201 data`: `MealAssign`.

#### `GET /guest-meals`

Same date filters.  

```json
{
  "id": "gm_…",
  "shift_id": "lunch",
  "date": "2026-09-08",
  "check_in_time": "…",
  "guest_name": "Visitor",
  "guest_info": "",
  "ref_info": "",
  "created_at": "…",
  "updated_at": "…"
}
```

No public create (device/admin ingest later if needed).

### ZK demo **LOCKED** — staff

Flag-gated on the server (`ZK_DEMO=1`). Production devices should use ingest, not these.

#### `GET /zk/demo/status`

```json
{
  "reachable": true,
  "host": "192.168.1.50",
  "port": 4370,
  "latency_ms": 12,
  "error": null
}
```

#### `GET /zk/demo/users`

```json
{
  "items": [
    { "user_id": "101", "name": "Rahim", "privilege": 0, "group_id": "0", "card": "AABBCC" }
  ],
  "total": 1
}
```

#### `GET /zk/demo/attendance`

Query: `from`, `to` (datetime or date), `limit`.

```json
{
  "items": [
    {
      "user_id": "101",
      "punched_at": "2026-09-08T00:41:00Z",
      "status": 0,
      "punch": 0,
      "uid": 12
    }
  ],
  "total": 1,
  "limit": 200,
  "from": "2026-09-01",
  "to": "2026-09-08"
}
```

---

## 13. State reports & Pritibhoj **NEW**

### State reports — submit: daily, admin; review: admin; read: daily, admin

#### `GET /state-reports/draft?date=YYYY-MM-DD`

Live, not persisted. Same shape as a report **without** `id/status/submitted_*`.

`200 data`: `{ date, boro_khana, members, totals }`.

Members: approved + active + cockpit + assignable that day. Tag = projected (stored / carry). Totals: `active`, `by_tag`, `mess_eaters`.

#### `GET /state-reports`

Query: `status`, `date`, `from`, `to`, `page`, `page_size`.  
`200 data`: paged `DailyStateReport[]`, newest `submitted_at` first.

#### `GET /state-reports/{id}`

`200 data`: `DailyStateReport`.

#### `POST /state-reports`

```json
{ "date": "2026-09-08" }
```

Builds draft, persists `pending`, **replaces** any existing pending for that date.  
`201 data`: `DailyStateReport`.

#### `POST /state-reports/{id}/approve`

Empty body. Only if `pending`. Sets `reviewed_*`.  
`200 data`: `DailyStateReport`.

#### `POST /state-reports/{id}/reject`

```json
{ "note": "Counts look short" }
```

`note` optional.  
`200 data`: `DailyStateReport`.

### Pritibhoj — mess, admin (GET: staff)

Row numbers are integers ≥ 0. Server recomputes `total` and `totalDistribution` (same lock as `lockPritibhojSheets`).

```json
{
  "id": "pb_…",
  "title": "Eid feast",
  "occasion": "Eid-ul-Fitr",
  "date": "2026-03-31",
  "org": "RAB HQ",
  "created_at": "…",
  "main_rows": [],
  "admin_rows": []
}
```

| Method | Path | Body | Data |
|---|---|---|---|
| GET | `/pritibhoj` | query `from` `to` `q` + page | paged events, date desc |
| GET | `/pritibhoj/{id}` | — | event |
| POST | `/pritibhoj` | `{ title, occasion, date, org, main_rows, admin_rows }` | `201` event |
| PUT | `/pritibhoj/{id}` | same | event |
| DELETE | `/pritibhoj/{id}` | — | `{ id }` |

`title` required. `date` required.

---

## 14. Reports **NEW**

Authoritative money / Form-1. Client `jspdf` may still render. Roles: **consume, ration, admin** except manpower (**daily, admin**) and ration-only paths (**ration, admin**).

Month path param: `YYYY-MM`. Money: `roundPaisa`. FR tag bills add `FUEL` ৳/day. CLFR: members with MS days + CL days + 0 FR days get one monthly `CLFR` amount on CL ration lines.

### Consume

#### `GET /reports/consume/{month}`

Mirrors `buildConsumeMonth`.

```json
{
  "month": "2026-09",
  "assignment_count": 900,
  "rows": [
    {
      "user": { },
      "tag_days": { "MS": 20, "CL": 2 },
      "total_days": 22,
      "allowance_days": 20,
      "amount": 3600.0
    }
  ],
  "by_tag": [{ "tag": "MS", "days": 400, "users": 40, "amount": 72000.0 }],
  "total_amount": 72000.0
}
```

`user` is `Member`. Only stored assignments (not carry). Rate > 0 counts as allowance.

#### `GET /reports/consume/{month}/tag/{tag}`

Mirrors `buildTagBill`. `{tag}` path-encoded.

```json
{
  "month": "2026-09",
  "tag": "FR",
  "rate": 220.0,
  "fuel_rate": 50.0,
  "rows": [
    {
      "sl": 1,
      "user": { },
      "days": 10,
      "rate": 220.0,
      "amount": 2200.0,
      "fuel_rate": 50.0,
      "fuel_amount": 500.0,
      "grand_total": 2700.0,
      "remarks": ""
    }
  ],
  "total_days": 10,
  "total_amount": 2200.0,
  "total_fuel": 500.0,
  "grand_total": 2700.0
}
```

`fuel_rate` is 0 unless `tag=FR`.

#### `GET /reports/consume/{month}/wings`

```json
{
  "month": "2026-09",
  "tag_codes": ["FR", "MS"],
  "rows": [{ "wing": "Ops Wg", "manpower": 12, "tag_days": { "MS": 200 }, "total_days": 200 }],
  "totals": { "manpower": 80, "tag_days": { "MS": 400 }, "total_days": 400 }
}
```

#### `GET /reports/consume/{month}/ledger`

Query: `tags` comma-separated (default all); `carry=true`; `preview_future=true`.

```json
{
  "month": "2026-09",
  "day_count": 30,
  "tag_codes": ["MS", "CD"],
  "rows": [
    {
      "user": { },
      "days": ["MS", "", "CD"],
      "tag_counts": { "MS": 1, "CD": 1 },
      "total_days": 2
    }
  ]
}
```

`days` length = `day_count`; index 0 is day 1.

### Ration — ration, admin

#### `GET /reports/ration/{month}`

Mirrors `buildRationReportClean` (groups with no lines omitted).

```json
{
  "month": "2026-09",
  "groups": [
    {
      "sender": { },
      "lines": [
        { "user": { }, "tag": "FR", "days": 10, "rate": 220.0, "amount": 2200.0 }
      ],
      "total": 2200.0
    }
  ],
  "unmapped": [],
  "total": 2200.0
}
```

Includes CLFR lines (`tag=CL`, `rate` = monthly amount, `amount` = monthly, not × days).

#### `GET /reports/ration/{month}/staff`

Query: `sender_id`, `tag` (optional).  
When both set, count that tag even if rate is 0 (letter-by-tag). `tag=CL` uses CLFR rules.

`200 data`: `{ "sheets": RationStaffSheet[] }` already **split by member bank**.

```json
{
  "month": "2026-09",
  "sender": { },
  "member_bank": "Sonali Bank",
  "lines": [
    {
      "ser": 1,
      "user": { },
      "amount": 2700.0,
      "tags": ["FR"],
      "days": 10,
      "missing_bank": false,
      "remarks": ""
    }
  ],
  "total": 2700.0
}
```

`missing_bank` if account or routing empty. Lines sorted bank-wise then roster.

#### `GET /reports/ration/{month}/transfers`

Query: `sender_id` required; `mode=grouped|per_user` (default `grouped`); `tag` optional (FR sheets).

```json
{
  "month": "2026-09",
  "sender": { },
  "report_date": "2026-09-08",
  "lines": [
    {
      "ser": 1,
      "date": "2026-09-08",
      "ref_no": "RAB HQ/Finance/S33/Pay/…",
      "sender_account_no": "001122",
      "receiver_routing": "200270325",
      "sender_routing": "020260025",
      "type": "C",
      "customer_account_name": "Md. Rahim",
      "customer_account_no": "110200300",
      "amount": 2700.0,
      "institute": "RAB HQ",
      "entry_description": "Fresh Money Bill",
      "payment_info": "Fresh Money",
      "currency": "BDT",
      "user": { },
      "missing_bank": false
    }
  ],
  "total": 2700.0
}
```

Copy constants from `RATION_REPORT_META` (`src/lib/constants.ts`).

### Manpower — daily, admin

#### `GET /reports/manpower?date=YYYY-MM-DD`

Mirrors `ManpowerReport`. Guests excluded. Tags projected.

```json
{
  "date": "2026-09-08",
  "officer_category_id": "auth_officer",
  "categories": [{ "id": "auth_officer", "label": "Officer", "count": 184, "wings": {}, "held_wings": {} }],
  "hq": {
    "authorized": { "auth_officer": 184 },
    "held": {},
    "shortfall": {},
    "present": {},
    "absent": {}
  },
  "wings": [
    {
      "wing": "Ops Wg",
      "authorized": {},
      "held": {},
      "present": {},
      "absent": {}
    }
  ],
  "grand_total": { "wing": "Total", "authorized": {}, "held": {}, "present": {}, "absent": {} },
  "absence": [
    {
      "wing": "Ops Wg",
      "cl": 1, "pl": 0, "rl": 0, "ml": 0, "maternity": 0,
      "training": 0, "witness": 0, "exam": 0, "other": 0,
      "hospital": 0, "avg_present": 0, "total": 1
    }
  ]
}
```

Counts keys are authorized row ids. Officer wing cells stay blank on Form-1 (client). `উপস্থিত = প্রাপ্ত − অনুপস্থিত` for Officer using `manpower_officer_absent`.

---

## 15. Validation cheat-sheet

| Field | Rule |
|---|---|
| `email` | lowercase trim; valid email |
| `password` | min 8 on staff create / change |
| `name` | trim, 1–120 chars |
| `rab_id` | trim, unique ci, 1–40 (except guest empty until derived civilian) |
| `personal_id` | trim; required except guest |
| `phone` | normalize BD; empty allowed |
| `tag` | `^[A-Za-z0-9]{2,8}$` uppercased |
| `amount_per_day` | ≥ 0, 2 dp |
| `date` | real calendar day |
| `month` | real month |
| `from` ≤ `to` | swap or 400 — **swap** to match member date filters |
| `page` | ≥ 1 |
| `page_size` | 10 / 25 / 50 / 100 |
| Meal `count` | integer ≥ 1 after clean |
| Pritibhoj counts | integer ≥ 0 |
| Wing parent | both labels in catalog, no self, no cycle |

---

## 16. HTTP status map

| Situation | Status |
|---|---|
| GET / PUT success | 200 + envelope |
| POST create | 201 + envelope |
| Logout / optional empty | 204 no body |
| Bad input | 400 |
| No / bad token | 401 |
| Wrong role | 403 |
| Missing row | 404 |
| Unique / workflow clash | 409 |
| Upload too big | 413 |
| Bad file type | 415 |
| Rate limit | 429 |
| Bug | 500 |
| ZK down | 503 |

---

## 17. Example traces

### Daily paints CL, then Consume applies a request

1. `PUT /assignments` `{ member_id, date, tag: "MS" }` → stored MS.  
2. `POST /tag-requests/duty` `{ user_id, to_tag: "CL", queue: "consume", from_date, to_date }` → pending.  
3. `GET /tag-requests/counts` → `{ consume: 1, … }`.  
4. `POST /tag-requests/{id}/apply` → cells become CL (`stored`), request `updated`, day unlocked.

### Approve day

1. Members with empty cells show `source=carry`, `tag=default_tag`.  
2. `POST /days/2026-09-08/approve` → those cells become `stored`, `locked: true`.  
3. `GET /days/locks?from=&to=` includes `2026-09-08`.  
4. Later `PUT /assignments` on that date succeeds and **removes** the lock.

### Boro Khana

1. `PUT /boro-khana/2026-09-15` `{ on: true }`.  
2. `GET /mess/eaters?date=2026-09-15` → every assignable member; reasons MS/FR/BK.  
3. Ledger `boro_khana_days` includes `{ date, eater_count }`.

---

## 18. OpenAPI notes

Publish `/openapi.json` from FastAPI. Wrapper middleware must still emit the `{ ok, data }` / `{ ok: false, … }` envelope (do not return raw Pydantic models at the HTTP boundary).

Suggested tags: `health`, `auth`, `staff`, `members`, `assignments`, `days`, `boro-khana`, `tag-requests`, `settings`, `senders`, `mess`, `meals`, `state-reports`, `pritibhoj`, `reports`, `zk`.

Contract tests: replay each **LOCKED** function in `src/lib/api/*.ts` against a running API.

---

## 19. Out of scope for v1

- Multi-mess / multi-battalion
- Refresh tokens (add `POST /auth/refresh` later without changing login shape)
- Server-side PDF bytes (client `jspdf` stays)
- Guest-meal create UI
- Device management UI beyond ZK demo + ingest
- Soft-delete members (use `ended` + inactive)

---

## 20. Locked path checklist

Implement these first so current `USE_API=true` screens work:

1. `POST /auth/login` `POST /auth/logout`  
2. `POST /public/register`  
3. `GET /members` `POST /members`  
4. `GET /assignments` `GET /assignments/summary` `PUT /assignments` `PUT /assignments/range` `DELETE /assignments`  
5. `POST /days/{date}/approve` `GET /days/locks`  
6. `GET /boro-khana` `PUT /boro-khana/{date}`  
7. `GET/PUT/POST /settings/rates` `DELETE /settings/rates/{tag}`  
8. `GET/POST /senders` `PUT/DELETE /senders/{id}`  
9. `GET /mess/eaters` `GET /mess/ledger`  
10. `GET /zk/demo/status` `/users` `/attendance`  

Then ship **NEW** member lifecycle, tag-requests, catalog, state-reports, kitchen, reports — in that order ([backend-plan.md](./backend-plan.md) §8).
