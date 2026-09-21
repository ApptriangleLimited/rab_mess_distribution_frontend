# QA checklist — Daily Manpower Report (Form 1)

Use this sheet to verify **Daily → Manpower → Form 1** (`/daily/manpower?form=1`).  
Print uses the same rules (`/daily/manpower/print?date=YYYY-MM-DD&form=1`).

**Login (Daily):** `SRB-DAILY` / `ChangeMe!`  
Pick a date that has Daily Cockpit tags, then open Form 1 for that same date.

---

## 1. Page layout (spaced sections)

There must be **space** between these blocks. **সর্বমোট** is the last strength block after Training School, above অনুপস্থিতির বিবরণ.

| # | Section title (what you see) | What it is |
|---|---|---|
| 1 | **দৈনিক জনবলের প্রতিবেদন** (org name + date on top) | Overall totals (sum of Form 1 wings) |
| 2 | **উইং** | Official Form 1 wings in paper order: Admin, Ops, Int, Comm & MIS, Trg, L & M, Inv, Air, R & D Cell, Training School |
| 3 | **অনুপস্থিতির বিবরণ** | Absence reason table — same main-wing set / same cockpit tags |

Admin branches belong on **Form 2 (এ্যাডমিন উইং)**. HQ Br / Forces Mess / Field Mess belong on **Form 3 (সদর দপ্তর শাখা)**. Do not fail Form 1 if those rows are missing here.

Section 1 header must include:

- দৈনিক জনবলের প্রতিবেদন
- এসআরবি-স্পেশাল রেসপন্স ব্যাটালিয়ন সদর দপ্তর
- তারিখ *(DD-MM-YYYY)* on the **right**

Do **not** show `Daily Manpower Report · কুর্মিটোলা, ঢাকা`.

There must **not** be a **হেডকোয়ার্টার** banner row.

---

## 2. Rank columns (same on every strength table)

Left labels, then Settings → Authorized categories, then **মোট**.

Typical columns (Bangla headers):

| বিবরণ | অফিসার | ডিএডি | আরটি | এএসআই | এএএসআই | নায়েক | কনস্টেবল | পাচক | এএনসিই | সিভিল | সংযুক্ত | মোট |

If Settings has extra / renamed categories, those names appear instead.  
**Every row in a block must have the same number of rank columns + মোট.**

---

## 3. Row titles (strength tables)

Each wing block has **two left columns**:

| Column | Title | What it shows |
|---|---|---|
| উইং | Wing name (spans 4 rows) | এ্যাডমিন উইং, অপস উইং, … |
| বিবরণ | Field name | The four titles below |

### Field titles

| Title | English | Type | Source / formula |
|---|---|---|---|
| **প্রাধিকৃত** | Authorized | Read-only | Settings → Authorized (per wing / rank). Section 1 uses category totals. |
| **প্রাপ্ত** | Held / received | **Input** on wing rows | Default = Daily Cockpit members that date on **that exact wing** (API `member.wing` + rank). Editable. |
| **বৃদ্ধি/হ্রাস** | Reduce / excess | Read-only (signed) | **প্রাধিকৃত − প্রাপ্ত** |
| **অনুপস্থিত** | Absent | **Input** on wing rows | Default = cockpit **mapped absent tags** (by wing + rank). Editable. |

Section 1 (overall) uses the same four titles but **no inputs** — it is the **sum of wing rows**.

**উপস্থিত** is calculated as **প্রাপ্ত − অনুপস্থিত** in the engine (never negative). It is **not** a visible row on Form 1.

**সর্বমোট** is the last wing block in section 2 (sum of the Form 1 wings). It is read-only.

---

## 4. Input fields (what QA can type)

Only on **section 2 (wings)**. Amber number boxes.

| Input title | Where | Who can edit | After edit, check |
|---|---|---|---|
| **প্রাপ্ত** | Every rank cell + that wing | Daily | **বৃদ্ধি/হ্রাস** of that wing = প্রাধিকৃত − new প্রাপ্ত. Section 1 প্রাপ্ত / বৃদ্ধি/হ্রাস update. |
| **অনুপস্থিত** | Every rank cell + that wing | Daily | Section 1 অনুপস্থিত updates (sum of wings). অনুপস্থিতির বিবরণ does **not** change (that table is tag-based). |

Empty / blank saves as **0**. Negative numbers are not allowed.

Section 1 cells and **প্রাধিকৃত** / **বৃদ্ধি/হ্রাস** are never inputs.

---

## 5. Tag → অনুপস্থিতির বিবরণ mapping

Open **Daily Cockpit** for the same date. Count members by tag and wing. Those counts must match Form 1 section 3.

| Report column (title) | Daily Cockpit tag(s) | Notes |
|---|---|---|
| **সিএল** | `CL` | Casual Leave |
| **পিএল** | `PL` | Privilege Leave |
| **আরএল** | `RL` | Recreation Leave only — **not** WR |
| **এমএল** | `ML` | New Daily Cockpit tag. **Not** MED. |
| **মাতৃত্ব** | `MOL` | Maternity |
| **প্রশিক্ষণ** | `TRG` | Training |
| **সাক্ষী** | `WIT` | Witness |
| **পরীক্ষা** | `PE` | Promotion exam only — **not** CD |
| **অন্যান্য** | `LNK` | Link only |
| **হাসপাতাল** | `CMH` **or** `RBH` **or** `BGH` | Any of the three counts as hospital |
| **গড় উপস্থিত** | `AWL` **or** `OSL` | Either tag |
| **মোট** | — | Sum of the columns on that row (not a tag) |

Guests are **excluded** (same as Daily Cockpit). Only approved, active, assignable members.

### Tags that must **not** fill those columns

These may exist on Cockpit but **do not** map to অনুপস্থিতির বিবরণ:

`MS`, `FR`, `MFR`, `WR`, `CD`, `MED`, `JL`, `FUEL`, `CLFR`

---

## 6. Special tag: `ML`

| Check | Expected |
|---|---|
| Daily Cockpit tag chips / paint list | **`ML` is listed** (after MED) |
| Paint a member `ML` | Cell shows ML; Form 1 **এমএল** counts that member |
| Form 1 **এমএল** | Counts `ML` only — **not** `MED` |
| Form 1 wing **অনুপস্থিত** default | `ML` members are included in that wing/rank |

Sample members that may already have `ML`: Omar Faruk (Admin), Lamia Sultana (Admin New), Farhana Akter (Air Wg). Confirm on the date you test — tags can change.

---

## 7. How to verify numbers (happy path)

1. Daily Cockpit → pick date **D**. Filter by a **wing** (e.g. `Fin Br`, `Admin (New)`, `Air Wg`) and note tags (`CL`, `PL`, `ML`, `TRG`, …).
2. Open **Manpower Form 1** for date **D**.
3. Main wings sit on **Form 1**. Admin / HQ children sit on **Form 2 / Form 3**. **প্রাপ্ত** default = cockpit headcount for that exact wing, split by rank.
4. Section 2: that wing’s **অনুপস্থিত** default ≈ cockpit members on **mapped absent tags** only, split by rank.
5. **বৃদ্ধি/হ্রাস** = প্রাধিকৃত − প্রাপ্ত (can be negative; show the minus).
6. Section 3: each tag column matches cockpit counts for that wing.
7. Section 3 **মোট** = sum of that wing’s reason columns.
8. Section 1 প্রাপ্ত / অনুপস্থিত / বৃদ্ধি/হ্রাস = **sum of all wing rows** (not a separate typed total).
9. Edit one wing **প্রাপ্ত** Officer cell → only that wing’s বৃদ্ধি/হ্রাস and section 1 প্রাপ্ত change.
10. Edit one wing **অনুপস্থিত** DAD cell → section 1 অনুপস্থিত changes; section 3 **does not** follow the typed absent (section 3 stays on tags).

---

## 8. Print

Print Form 1 must show:

- Same official title / date
- Same four row titles (প্রাধিকৃত, প্রাপ্ত, বৃদ্ধি/হ্রাস, অনুপস্থিত)
- Wings: **উইং** (name, 4-row span) + **বিবরণ**
- Same অনুপস্থিতির বিবরণ tag mapping
- No সর্বমোট strength block
- No হেডকোয়ার্টার banner

---

## 9. Fail if

- হেডকোয়ার্টার title is back
- সর্বমোট strength table is shown
- Wing first row is the wing name **instead of** প্রাধিকৃত (wing name must sit in the **উইং** column)
- অনুপস্থিত on wing rows is not an input
- প্রাপ্ত on wing rows is not an input
- এমএল counts `MED` instead of `ML`
- আরএল counts `WR`
- পরীক্ষা counts `CD`
- অন্যান্য counts anything except `LNK`
- `ML` is missing from Daily Cockpit paint chips
- A cockpit wing (e.g. `Fin Br`, `Admin (New)`) is missing or rolled into **Admin**
- `Fin Br` / Admin branches appear on Form 1 instead of **Form 2**
- `Forces Mess` / HQ Br children appear on Form 1 instead of **Form 3**
- Form 1 shows **এ্যাডমিন উইং** or **সদর দপ্তর শাখা** as extra blocks
- Section 1 / 2 / 3 are stuck together with no gap
- Rank columns do not line up across rows