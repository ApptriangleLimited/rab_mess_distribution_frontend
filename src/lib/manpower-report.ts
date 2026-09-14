import {
  ADMIN_SUB_WINGS,
  DEFAULT_WING_PARENT,
  HQ_SUB_WINGS,
} from "@/lib/constants";
import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { canAssignOnDate } from "@/lib/store/daily";
import { isCockpitMember } from "@/lib/store/users";
import {
  authorizedWingDisplayCount,
  isBannedWing,
  listAuthorized,
  listAuthorizedRootWings,
  listAuthorizedRootWingsFrom,
} from "@/lib/store/org-options";
import type { AuthorizedStrength, DailyTag, User } from "@/lib/types";
import type { AssignmentCell } from "@/lib/api/assignments";

/** Optional daily-cockpit snapshot (API mode). Else use local store. */
export type ManpowerSnapshot = {
  users: User[];
  /** Projected tag for member on report date (stored/carry). */
  tagFor: (userId: string) => DailyTag | "";
  wingParent?: Record<string, string>;
  authorized?: AuthorizedStrength[];
  officerAbsent?: Record<string, number>;
  /** Extra cockpit wings that are not in the Settings authorized ladder. */
  extraWings?: string[];
  /** Live Settings wing catalog from the API. */
  wings?: string[];
  /** Members are already approved + active + assignable. */
  prefiltered?: boolean;
};

/** Build tag resolver from assignment cells for one date. */
/** Same tag the Daily Cockpit cell shows: stored/carry, else default ghost. */
export function cockpitTagForMember(
  cell: AssignmentCell | undefined,
  defaultTag: string,
  manpowerTag?: string,
  manpowerSource?: string,
): DailyTag | "" {
  const source = cell?.source || manpowerSource || "";
  if (source === "suppressed") return "";
  const painted = (cell?.tag || manpowerTag || "").toUpperCase();
  return (painted || defaultTag || "") as DailyTag | "";
}

export function tagForFromCells(
  cells: AssignmentCell[],
  date: string,
  defaults: Map<string, string> = new Map(),
): (userId: string) => DailyTag | "" {
  const byMember = new Map<string, AssignmentCell>();
  for (const cell of cells) {
    if (cell.date !== date) continue;
    byMember.set(cell.member_id, cell);
  }
  return (userId: string): DailyTag | "" => {
    const cell = byMember.get(userId);
    const fallback = defaults.get(userId) ?? "";
    return cockpitTagForMember(cell, fallback);
  };
}

export type ManpowerCounts = Record<string, number>;

export type ManpowerWingBlock = {
  wing: string;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
  shortfall: ManpowerCounts;
  present: ManpowerCounts;
  absent: ManpowerCounts;
};

export type ManpowerAbsenceRow = {
  wing: string;
  cl: number;
  pl: number;
  rl: number;
  ml: number;
  maternity: number;
  training: number;
  witness: number;
  exam: number;
  other: number;
  hospital: number;
  avgPresent: number;
  total: number;
};

export type ManpowerReport = {
  date: string;
  categories: AuthorizedStrength[];
  /** Officer category id — wing cells forced blank. */
  officerCategoryId: string | null;
  hq: {
    authorized: ManpowerCounts;
    held: ManpowerCounts;
    shortfall: ManpowerCounts;
    present: ManpowerCounts;
    absent: ManpowerCounts;
  };
  wings: ManpowerWingBlock[];
  /** Main wings / Admin children / HQ Br children — same data as `wings`. */
  groups: ManpowerWingGroup[];
  /** Sum of wing blocks — print after all wings. */
  grandTotal: ManpowerWingBlock;
  absence: ManpowerAbsenceRow[];
};

export type ManpowerWingGroupId = "main" | "admin" | "hq";

export type ManpowerWingGroup = {
  id: ManpowerWingGroupId;
  titleBn: string;
  wings: ManpowerWingBlock[];
  absence: ManpowerAbsenceRow[];
};

export const MANPOWER_WING_GROUPS: {
  id: ManpowerWingGroupId;
  titleBn: string;
}[] = [{ id: "main", titleBn: "উইং" }];

const ABSENT_TAGS = new Set<string>([
  "CL",
  "PL",
  "RL",
  "ML",
  "MOL",
  "TRG",
  "WIT",
  "PE",
  "LNK",
  "CMH",
  "RBH",
  "BGH",
  "AWL",
  "OSL",
]);

const RANK_ALIASES: Record<string, string[]> = {
  officer: [
    "officer",
    "ad",
    "director",
    "oc",
    "capt",
    "maj",
    "lt",
    "col",
  ],
  dad: ["dad", "jco", "wo", "swo", "scpo", "cpo", "warrant"],
  rt: ["rt", "wrt", "others", "other", "misc", "recruit"],
  asi: ["asi", "nco", "sgt", "po", "si", "havildar"],
  aasi: ["aasi", "lnco", "l/cpl", "lcpl", "cpl", "ls", "lma"],
  naik: ["naik", "nayek", "naiek", "nayak"],
  constable: ["constable", "co", "or", "const", "ab", "od", "sepoy", "soldier"],
  cook: ["cook"],
  ance: ["ance", "nc(e)", "nce", "lp(e)", "lpe", "lp (e)"],
  civill: ["civill", "civil", "civilian"],
  attached: ["attached", "attach"],
};

function emptyCounts(categories: AuthorizedStrength[]): ManpowerCounts {
  return Object.fromEntries(categories.map((c) => [c.id, 0]));
}

function sumCounts(counts: ManpowerCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export function isOfficerCategory(
  cat: AuthorizedStrength | undefined,
): boolean {
  if (!cat) return false;
  const key = cat.label.trim().toLowerCase();
  return key === "officer" || key.startsWith("officer");
}

function officerIdOf(categories: AuthorizedStrength[]): string | null {
  return categories.find((c) => isOfficerCategory(c))?.id ?? null;
}

function normalizeRank(rank: string): string {
  return rank.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map member rank → authorized category id. */
export function categoryIdForRank(
  rank: string,
  categories: AuthorizedStrength[],
): string | null {
  const key = normalizeRank(rank);
  if (!key) return null;

  const exact = categories.find((c) => c.label.trim().toLowerCase() === key);
  if (exact) return exact.id;

  for (const cat of categories) {
    const labelKey = cat.label.trim().toLowerCase();
    const aliases = RANK_ALIASES[labelKey] ?? [labelKey];
    if (aliases.some((a) => a === key || key.includes(a) || a.includes(key))) {
      return cat.id;
    }
  }

  return (
    categories.find((c) => c.label.trim().toLowerCase() === "rt")?.id ??
    null
  );
}

function exactWing(wings: string[], name: string): string | null {
  const key = name.trim().toLowerCase();
  return wings.find((w) => w.toLowerCase() === key) ?? null;
}

function mergeParentMap(
  live?: Record<string, string>,
): Record<string, string> {
  return { ...DEFAULT_WING_PARENT, ...(live ?? {}) };
}

function lookupParent(
  wing: string,
  parents: Record<string, string>,
): string {
  if (parents[wing]) return parents[wing];
  const key = wing.trim().toLowerCase();
  for (const [k, v] of Object.entries(parents)) {
    if (k.trim().toLowerCase() === key) return v;
  }
  return "";
}

function isAdminFamilyName(name: string): boolean {
  const key = name.trim().toLowerCase();
  return key === "admin" || key === "admin (new)" || key === "admin (old)";
}

function isHqBrName(name: string): boolean {
  return name.trim().toLowerCase() === "hq br";
}

export function manpowerWingFamily(
  wing: string,
  parents: Record<string, string> = DEFAULT_WING_PARENT,
): ManpowerWingGroupId {
  const raw = wing.trim();
  if (!raw) return "main";
  if (isAdminFamilyName(raw)) return "admin";
  if (isHqBrName(raw)) return "hq";
  if (HQ_SUB_WINGS.some((w) => w.toLowerCase() === raw.toLowerCase())) {
    return "hq";
  }
  if (ADMIN_SUB_WINGS.some((w) => w.toLowerCase() === raw.toLowerCase())) {
    return isHqBrName(raw) ? "hq" : "admin";
  }
  let cur = raw;
  const seen = new Set<string>([cur.toLowerCase()]);
  while (cur) {
    if (isHqBrName(cur)) return "hq";
    if (isAdminFamilyName(cur)) return "admin";
    const parent = lookupParent(cur, parents);
    if (!parent || seen.has(parent.toLowerCase())) break;
    seen.add(parent.toLowerCase());
    cur = parent;
  }
  return "main";
}

function pushUnique(
  out: string[],
  seen: Set<string>,
  name: string,
  catalog: string[],
) {
  const raw = name.trim();
  if (!raw || raw === "—" || isBannedWing(raw) || seen.has(raw.toLowerCase())) {
    return;
  }
  const spelled = exactWing(catalog, raw) ?? raw;
  out.push(spelled);
  seen.add(spelled.toLowerCase());
}

/** Form 1 tab — main Daily Cockpit wings only. Admin → Form 2, HQ Br → Form 3. */
function listForm1WingNames(
  catalog: string[],
  memberWings: string[],
  parents: Record<string, string>,
): string[] {
  const roots = catalog.length
    ? listAuthorizedRootWingsFrom(catalog)
    : listAuthorizedRootWings();
  const mainFixed = [
    ...roots.filter((w) => !isAdminFamilyName(w) && !isHqBrName(w)),
    "RFTS",
  ];

  const main: string[] = [];
  const seen = new Set<string>();

  for (const w of mainFixed) pushUnique(main, seen, w, catalog);

  const extras = [...catalog, ...memberWings].filter((w) => {
    const name = w.trim();
    return name && !seen.has(name.toLowerCase()) && !isBannedWing(name);
  });
  extras.sort((a, b) => {
    const ia = catalog.findIndex((w) => w.toLowerCase() === a.toLowerCase());
    const ib = catalog.findIndex((w) => w.toLowerCase() === b.toLowerCase());
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  for (const w of extras) {
    if (manpowerWingFamily(w, parents) !== "main") continue;
    pushUnique(main, seen, w, catalog);
  }

  return main;
}

function projectedTag(userId: string, date: string): DailyTag | "" {
  const direct = getAssignment(userId, date);
  if (direct) return direct.tag;
  if (isCarrySuppressed(userId, date)) return "";
  return findPriorTag(userId, date) ?? "";
}

function isAbsentTag(tag: DailyTag | ""): boolean {
  return !!tag && ABSENT_TAGS.has(tag);
}

function addCounts(
  a: ManpowerCounts,
  b: ManpowerCounts,
  categories: AuthorizedStrength[],
): ManpowerCounts {
  const out = emptyCounts(categories);
  for (const cat of categories) {
    out[cat.id] = (a[cat.id] ?? 0) + (b[cat.id] ?? 0);
  }
  return out;
}

/** উপস্থিত = প্রাপ্ত − অনুপস্থিত (never negative). */
function presentFromHeldAbsent(
  held: ManpowerCounts,
  absent: ManpowerCounts,
  categories: AuthorizedStrength[],
): ManpowerCounts {
  const out = emptyCounts(categories);
  for (const cat of categories) {
    out[cat.id] = Math.max(0, (held[cat.id] ?? 0) - (absent[cat.id] ?? 0));
  }
  return out;
}

function shortfallCounts(
  authorized: ManpowerCounts,
  held: ManpowerCounts,
  categories: AuthorizedStrength[],
): ManpowerCounts {
  const out = emptyCounts(categories);
  for (const cat of categories) {
    out[cat.id] = (authorized[cat.id] ?? 0) - (held[cat.id] ?? 0);
  }
  return out;
}

type WingBucket = {
  held: ManpowerCounts;
  present: ManpowerCounts;
  absent: ManpowerCounts;
  /** Detail cols; avgPresent = AWL + OSL. */
  absence: Omit<ManpowerAbsenceRow, "wing" | "total">;
};

function lookupDayWingCat(
  day: Record<string, Record<string, number>> | undefined,
  wingName: string,
  categoryId: string,
): number | undefined {
  if (!day) return undefined;
  const exact = day[wingName]?.[categoryId];
  if (typeof exact === "number" && Number.isFinite(exact)) return exact;
  const key = wingName.trim().toLowerCase();
  for (const [k, cats] of Object.entries(day)) {
    if (k.trim().toLowerCase() !== key) continue;
    const n = cats?.[categoryId];
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Daily Manpower Report for `date`.
 * প্রাধিকৃত = Settings → Authorized.
 * প্রাপ্ত = Daily Cockpit members (optional per-cell override).
 * অনুপস্থিত = cockpit tags, then optional per-cell input.
 * অনুপস্থিতির বিবরণ = cockpit tags (CL/PL/RL/ML/MOL/TRG/WIT/PE/LNK/CMH|RBH|BGH/AWL|OSL).
 * বৃদ্ধি/হ্রাস = প্রাধিকৃত − প্রাপ্ত; উপস্থিত = প্রাপ্ত − অনুপস্থিত.
 */
export function buildManpowerReport(
  date: string,
  snapshot?: ManpowerSnapshot,
): ManpowerReport {
  const state = getState();
  const categories = snapshot?.authorized?.length
    ? snapshot.authorized
    : listAuthorized();
  const officerCategoryId = officerIdOf(categories);
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;

  const hqAuth = emptyCounts(categories);
  for (const cat of categories) {
    hqAuth[cat.id] = cat.count;
  }

  const hqHeld = emptyCounts(categories);
  const hqAbsent = emptyCounts(categories);

  const catalogWings = snapshot?.wings?.length ? snapshot.wings : [];
  const memberWings = snapshot?.extraWings?.length
    ? snapshot.extraWings
    : sourceUsers.map((u) => u.wing);
  const parents = mergeParentMap(snapshot?.wingParent ?? state.wing_parent);
  const form1Wings = listForm1WingNames(catalogWings, memberWings, parents);
  const authWings = [...form1Wings];

  function toCockpitWing(userWing: string): string | null {
    const raw = userWing.trim();
    if (!raw || raw === "—" || isBannedWing(raw)) return null;
    if (manpowerWingFamily(raw, parents) !== "main") return null;
    return exactWing(authWings, raw) ?? raw;
  }

  const wingMap = new Map<string, WingBucket>();

  function makeBucket(): WingBucket {
    return {
      held: emptyCounts(categories),
      present: emptyCounts(categories),
      absent: emptyCounts(categories),
      absence: {
        cl: 0,
        pl: 0,
        rl: 0,
        ml: 0,
        maternity: 0,
        training: 0,
        witness: 0,
        exam: 0,
        other: 0,
        hospital: 0,
        avgPresent: 0,
      },
    };
  }

  for (const w of authWings) wingMap.set(w, makeBucket());

  function ensureWing(name: string): WingBucket {
    let block = wingMap.get(name);
    if (!block) {
      block = makeBucket();
      wingMap.set(name, block);
    }
    return block;
  }

  const active: User[] = sourceUsers.filter((u) => {
    if (u.status !== "1" || !isCockpitMember(u)) return false;
    if (u.approval_status && u.approval_status !== "approved") return false;
    if (snapshot?.prefiltered) return true;
    return canAssignOnDate(u, date);
  });

  for (const user of active) {
    const catId = categoryIdForRank(user.rank, categories);
    if (!catId) continue;

    const resolved = tagFor(user.id);
    const tag = (
      snapshot ? resolved : resolved || user.default_tag || ""
    ) as DailyTag | "";
    const authWing = toCockpitWing(user.wing);

    hqHeld[catId] = (hqHeld[catId] ?? 0) + 1;

    const wing = authWing ? ensureWing(authWing) : null;

    if (wing) {
      wing.held[catId] = (wing.held[catId] ?? 0) + 1;
    }

    if (!isAbsentTag(tag)) continue;

    hqAbsent[catId] = (hqAbsent[catId] ?? 0) + 1;
    if (!wing) continue;

    wing.absent[catId] = (wing.absent[catId] ?? 0) + 1;

    switch (tag) {
      case "CL":
        wing.absence.cl += 1;
        break;
      case "PL":
        wing.absence.pl += 1;
        break;
      case "RL":
        wing.absence.rl += 1;
        break;
      case "ML":
        wing.absence.ml += 1;
        break;
      case "MOL":
        wing.absence.maternity += 1;
        break;
      case "TRG":
        wing.absence.training += 1;
        break;
      case "WIT":
        wing.absence.witness += 1;
        break;
      case "PE":
        wing.absence.exam += 1;
        break;
      case "LNK":
        wing.absence.other += 1;
        break;
      case "CMH":
      case "RBH":
      case "BGH":
        wing.absence.hospital += 1;
        break;
      case "AWL":
      case "OSL":
        wing.absence.avgPresent += 1;
        break;
      default:
        break;
    }
  }

  const heldDay = state.manpower_held?.[date] ?? {};
  const absentDay = state.manpower_absent?.[date] ?? {};
  for (const wingName of [...wingMap.keys()]) {
    const bucket = wingMap.get(wingName);
    if (!bucket) continue;
    for (const cat of categories) {
      const heldOverride = lookupDayWingCat(heldDay, wingName, cat.id);
      if (heldOverride !== undefined) bucket.held[cat.id] = heldOverride;
      const absOverride = lookupDayWingCat(absentDay, wingName, cat.id);
      if (absOverride !== undefined) bucket.absent[cat.id] = absOverride;
    }
  }

  for (const block of wingMap.values()) {
    block.present = presentFromHeldAbsent(block.held, block.absent, categories);
  }

  const extraWingsInMap = [...wingMap.keys()].filter(
    (w) => !authWings.some((a) => a.toLowerCase() === w.toLowerCase()),
  );
  for (const extra of extraWingsInMap) {
    if (manpowerWingFamily(extra, parents) !== "main") {
      wingMap.delete(extra);
      continue;
    }
    form1Wings.push(extra);
    authWings.push(extra);
  }
  const wingOrder = [...form1Wings];

  function toWingBlock(wing: string): ManpowerWingBlock {
    const block = wingMap.get(wing) ?? makeBucket();
    const authorized = emptyCounts(categories);
    for (const cat of categories) {
      authorized[cat.id] = authorizedWingDisplayCount(cat.wings, wing);
    }
    return {
      wing,
      authorized,
      held: block.held,
      shortfall: shortfallCounts(authorized, block.held, categories),
      present: block.present,
      absent: block.absent,
    };
  }

  function toAbsenceRow(wing: string): ManpowerAbsenceRow {
    const block = wingMap.get(wing) ?? makeBucket();
    const absentTotal =
      block.absence.cl +
      block.absence.pl +
      block.absence.rl +
      block.absence.ml +
      block.absence.maternity +
      block.absence.training +
      block.absence.witness +
      block.absence.exam +
      block.absence.other +
      block.absence.hospital +
      block.absence.avgPresent;
    return {
      wing,
      ...block.absence,
      total: absentTotal,
    };
  }

  const wings: ManpowerWingBlock[] = wingOrder.map(toWingBlock);

  let hqHeldFromWings = emptyCounts(categories);
  let hqAbsentFromWings = emptyCounts(categories);
  for (const block of wings) {
    hqHeldFromWings = addCounts(hqHeldFromWings, block.held, categories);
    hqAbsentFromWings = addCounts(hqAbsentFromWings, block.absent, categories);
  }
  const hqPresent = presentFromHeldAbsent(
    hqHeldFromWings,
    hqAbsentFromWings,
    categories,
  );

  let grandAuth = emptyCounts(categories);
  let grandHeld = emptyCounts(categories);
  let grandPresent = emptyCounts(categories);
  let grandAbsent = emptyCounts(categories);
  for (const block of wings) {
    grandAuth = addCounts(grandAuth, block.authorized, categories);
    grandHeld = addCounts(grandHeld, block.held, categories);
    grandPresent = addCounts(grandPresent, block.present, categories);
    grandAbsent = addCounts(grandAbsent, block.absent, categories);
  }

  const absence: ManpowerAbsenceRow[] = wingOrder.map(toAbsenceRow);
  const groups: ManpowerWingGroup[] = [
    {
      id: "main",
      titleBn: "উইং",
      wings,
      absence,
    },
  ];

  return {
    date,
    categories,
    officerCategoryId,
    hq: {
      authorized: hqAuth,
      held: hqHeldFromWings,
      shortfall: shortfallCounts(hqAuth, hqHeldFromWings, categories),
      present: hqPresent,
      absent: hqAbsentFromWings,
    },
    wings,
    groups,
    grandTotal: {
      wing: "সর্বমোট",
      authorized: grandAuth,
      held: grandHeld,
      shortfall: shortfallCounts(grandAuth, grandHeld, categories),
      present: grandPresent,
      absent: grandAbsent,
    },
    absence,
  };
}

export function manpowerRowTotal(counts: ManpowerCounts): number {
  return sumCounts(counts);
}

/** Count cells hide minus; বৃদ্ধি/হ্রাস keeps the signed প্রাধিকৃত − প্রাপ্ত value. */
export function formatManpowerCell(
  value: number,
  opts?: { signed?: boolean },
): string {
  if (opts?.signed) return String(value);
  return String(Math.abs(value));
}
