import {
  ADMIN_SUB_WINGS,
  canonicalRankName,
  canonicalWingName,
  DEFAULT_WING_PARENT,
  HQ_SUB_WINGS,
  WING_LABELS,
  WING_LABELS_BN,
  WINGS,
} from "@/lib/constants";
import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { canAssignOnDate } from "@/lib/store/daily";
import { wingPrintOrder, wingPrintOrderFrom } from "@/lib/daily-register-wings";
import { isForm1RankColumn } from "@/lib/rank-labels";
import {
  authorizedWingDisplayCount,
  isBannedWing,
  listAuthorized,
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
  const source = manpowerSource || cell?.source || "";
  if (source === "suppressed") return "";
  const painted = (manpowerTag || cell?.tag || "").toUpperCase();
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

/** Daily cockpit tags that count as উপস্থিত (all tabs). */
export const MANPOWER_PRESENT_TAGS = new Set<string>([
  "MS",
  "FR",
  "MFR",
  "CD",
]);

export function isManpowerPresentTag(tag: string | "" | undefined): boolean {
  return MANPOWER_PRESENT_TAGS.has((tag ?? "").toUpperCase());
}

/** অনুপস্থিত = cockpit tags that are not MS / FR / MFR / CD. */
export function isManpowerDutyAbsentTag(tag: string | "" | undefined): boolean {
  return !isManpowerPresentTag(tag);
}

/** All three manpower tabs count স্থায়ী / permanent members only. */
export function isManpowerCountableMember(
  user: Pick<User, "member_type">,
): boolean {
  return user.member_type === "permanent";
}

export const ABSENCE_DETAIL_FIELDS = [
  "cl",
  "pl",
  "rl",
  "ml",
  "maternity",
  "training",
  "witness",
  "exam",
  "other",
  "hospital",
  "avgPresent",
] as const;

export type AbsenceDetailField = (typeof ABSENCE_DETAIL_FIELDS)[number];

/** Daily RR absent tags → অনুপস্থিতির বিবরণ columns. */
export function absenceFieldForTag(
  tag: string | "" | undefined,
): AbsenceDetailField | null {
  switch ((tag ?? "").toUpperCase()) {
    case "CL":
      return "cl";
    case "PL":
      return "pl";
    case "RL":
      return "rl";
    case "ML":
      return "ml";
    case "MOL":
      return "maternity";
    case "TRG":
      return "training";
    case "WIT":
      return "witness";
    case "PE":
      return "exam";
    case "LNK":
      return "other";
    case "MED":
    case "CMH":
    case "RBH":
    case "BGH":
      return "hospital";
    case "AWL":
    case "OSL":
      return "avgPresent";
    default:
      return null;
  }
}

export function emptyAbsenceDetail(): Omit<ManpowerAbsenceRow, "wing" | "total"> {
  return {
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
  };
}

export function absenceDetailTotal(
  row: Omit<ManpowerAbsenceRow, "wing" | "total">,
): number {
  return ABSENCE_DETAIL_FIELDS.reduce((sum, key) => sum + (row[key] ?? 0), 0);
}

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
  si: ["si", "s.i", "sub inspector"],
  asi: ["asi", "aasi", "a.s.i", "assistant sub inspector"],
  aasi: ["aasi"],
  naik: ["naik", "nayek", "naiek", "nayak"],
  constable: ["constable", "co", "or", "const", "ab", "od", "sepoy", "soldier"],
  cook: ["cook"],
  nce: ["nce", "ance", "nc(e)", "nc (e)", "lp(e)", "lpe", "lp (e)"],
  ance: ["ance", "nc(e)", "nce", "lp(e)", "lpe", "lp (e)"],
  civil: ["civil", "civill", "civilian"],
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

/** Form 1 DAD column — same editable override as Officer. */
export function isDadCategory(
  cat: AuthorizedStrength | undefined,
): boolean {
  if (!cat) return false;
  const key = cat.label.trim().toLowerCase();
  const id = cat.id.trim().toLowerCase();
  return (
    key === "dad" ||
    key.startsWith("dad ") ||
    key.includes("deputy assistant") ||
    key === "ডিএডি" ||
    id === "dad" ||
    id.endsWith("_dad") ||
    id.endsWith("-dad")
  );
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
  const canon = canonicalRankName(rank).toLowerCase();

  const exact = categories.find((c) => {
    const labelKey = c.label.trim().toLowerCase();
    return (
      labelKey === key ||
      canonicalRankName(c.label).toLowerCase() === canon
    );
  });
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

/** Match Daily RR wing onto a Settings / paper row (short, full, Bangla). */
export function matchWingInList(
  name: string,
  wings: string[],
  labels: Record<string, string> = {},
): string | null {
  const raw = name.trim();
  if (!raw) return null;
  const canon = canonicalWingName(raw).toLowerCase();
  const compact = canon.replace(/[^a-z0-9]+/g, "");
  for (const w of wings) {
    const wc = canonicalWingName(w).toLowerCase();
    if (w.toLowerCase() === raw.toLowerCase() || wc === canon) return w;
    if (compact && wc.replace(/[^a-z0-9]+/g, "") === compact) return w;
    const full = (WING_LABELS[w] || labels[w] || "").toLowerCase();
    if (full && (full === canon || full === raw.toLowerCase())) return w;
    const bn = (WING_LABELS_BN[w] || "").trim();
    if (bn && bn === raw) return w;
  }
  return null;
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
  const key = name.trim().toLowerCase();
  return key === "hq br" || key === "headquarters branch";
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

const MANUAL_PRESENT_WINGS = new Set([
  "air wg",
  "air wing",
  "training school",
  "rfts",
  "এয়ার উইং",
  "এসআরবি ফোর্সেস ট্রেনিং স্কুল",
  "srb forces training school",
]);

/** Air Wg + Training School only — type প্রাপ্ত / উপস্থিত / অনুপস্থিত. */
export function isManualPresentWing(wing: string): boolean {
  const key = wing.trim().toLowerCase();
  if (MANUAL_PRESENT_WINGS.has(key)) return true;
  const compact = key.replace(/[^a-z0-9\u0980-\u09ff]+/g, " ").trim();
  return (
    compact === "air wg" ||
    compact === "air wing" ||
    compact === "training school" ||
    compact === "rfts"
  );
}

/** Form 2/3 — নতুন অস্থায়ী সংযুক্ত is typed like Air / Training. */
export function isManualAttachedWing(wing: string): boolean {
  const key = wing.trim().toLowerCase();
  const compact = key.replace(/[^a-z0-9\u0980-\u09ff]+/g, " ").trim();
  return (
    compact === "new temp att" ||
    compact === "new temporary attached" ||
    compact === "newly temporary attach" ||
    key.includes("temporary attach") ||
    key.includes("নতুন অস্থায়ী") ||
    key.includes("নতুন / অস্থায়ী")
  );
}

/** Form 1 tab — Settings wings in the serial the user stored. */
function listForm1WingNames(snapshot?: ManpowerSnapshot): string[] {
  const state = getState();
  const wings = snapshot?.wings?.length ? snapshot.wings : state.wings;
  const parents = snapshot?.wingParent ?? state.wing_parent;
  const ordered = wingPrintOrderFrom(wings, parents, state.wing_serials ?? {});
  return ordered.length ? ordered : wingPrintOrder().length ? wingPrintOrder() : [...WINGS];
}

function projectedTag(userId: string, date: string): DailyTag | "" {
  const direct = getAssignment(userId, date);
  if (direct) return direct.tag;
  if (isCarrySuppressed(userId, date)) return "";
  return findPriorTag(userId, date) ?? "";
}

function isAbsentTag(tag: DailyTag | ""): boolean {
  return isManpowerDutyAbsentTag(tag);
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
 * Daily Manpower Report for `date` (all tabs).
 * প্রাধিকৃত = Settings → Authorized.
 * প্রাপ্ত = Daily Cockpit members of that wing + rank (all tags).
 * উপস্থিত = MS + FR + MFR + CD (or প্রাপ্ত − অনুপস্থিত).
 * অনুপস্থিত = all other cockpit tags for that wing + rank.
 * অনুপস্থিতির বিবরণ = leave/hospital tag split.
 * বৃদ্ধি/হ্রাস = প্রাধিকৃত − প্রাপ্ত.
 */
export function buildManpowerReport(
  date: string,
  snapshot?: ManpowerSnapshot,
): ManpowerReport {
  const state = getState();
  const categories = (
    snapshot?.authorized?.length ? snapshot.authorized : listAuthorized()
  ).filter((cat) => isForm1RankColumn(cat.label));
  const officerCategoryId = officerIdOf(categories);
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;

  const hqAuth = emptyCounts(categories);

  const hqHeld = emptyCounts(categories);
  const hqAbsent = emptyCounts(categories);

  const parents = mergeParentMap(snapshot?.wingParent ?? state.wing_parent);
  const form1Wings = listForm1WingNames(snapshot);
  const authWings = [...form1Wings];
  const wingLabels = state.wing_labels ?? {};
  for (const cat of categories) {
    hqAuth[cat.id] = form1Wings.reduce(
      (sum, wing) => sum + authorizedWingDisplayCount(cat.wings, wing),
      0,
    );
  }

  function toCockpitWing(userWing: string): string | null {
    const raw = canonicalWingName(userWing.trim());
    if (!raw || raw === "—") return null;
    if (isBannedWing(raw)) return null;
    const family = manpowerWingFamily(raw, parents);
    if (family === "admin" || family === "hq") {
      return matchWingInList("Admin", authWings, wingLabels) ?? "Admin";
    }
    let cur = raw;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.toLowerCase())) {
      seen.add(cur.toLowerCase());
      const hit = matchWingInList(cur, authWings, wingLabels);
      if (hit) return hit;
      const parent = lookupParent(cur, parents);
      if (!parent) break;
      if (isAdminFamilyName(parent) || isHqBrName(parent)) {
        return matchWingInList("Admin", authWings, wingLabels) ?? "Admin";
      }
      cur = parent;
    }
    return null;
  }

  const wingMap = new Map<string, WingBucket>();

  function makeBucket(): WingBucket {
    return {
      held: emptyCounts(categories),
      present: emptyCounts(categories),
      absent: emptyCounts(categories),
      absence: emptyAbsenceDetail(),
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
    if (!isManpowerCountableMember(u)) return false;
    if (u.status !== "1") return false;
    if (u.approval_status && u.approval_status !== "approved") return false;
    return canAssignOnDate(u, date);
  });

  for (const user of active) {
    const catId = categoryIdForRank(user.rank, categories);
    if (!catId) continue;

    const resolved = tagFor(user.id);
    const tag = (
      snapshot ? resolved : resolved || user.default_tag || ""
    ) as DailyTag | "";
    if (!tag) continue;
    const authWing = toCockpitWing(user.wing);

    hqHeld[catId] = (hqHeld[catId] ?? 0) + 1;

    const wing = authWing ? ensureWing(authWing) : null;

    if (wing) {
      wing.held[catId] = (wing.held[catId] ?? 0) + 1;
    }

    const field = absenceFieldForTag(tag);
    if (!field) continue;

    hqAbsent[catId] = (hqAbsent[catId] ?? 0) + 1;
    if (!wing) continue;

    wing.absent[catId] = (wing.absent[catId] ?? 0) + 1;
    wing.absence[field] += 1;
  }

  const heldDay = state.manpower_held?.[date] ?? {};
  const absentDay = state.manpower_absent?.[date] ?? {};
  const presentDay = state.manpower_present?.[date] ?? {};
  const absenceDay = state.manpower_absence_detail?.[date] ?? {};
  for (const wingName of [...wingMap.keys()]) {
    const bucket = wingMap.get(wingName);
    if (!bucket) continue;
    const manualWing = isManualPresentWing(wingName);
    for (const cat of categories) {
      if (!manualWing && !isOfficerCategory(cat) && !isDadCategory(cat)) continue;
      const heldOverride = lookupDayWingCat(heldDay, wingName, cat.id);
      if (heldOverride !== undefined) bucket.held[cat.id] = heldOverride;
      const absOverride = lookupDayWingCat(absentDay, wingName, cat.id);
      if (absOverride !== undefined) bucket.absent[cat.id] = absOverride;
    }
    if (!manualWing) continue;
    const detail = { ...bucket.absence };
    let hasDetailOverride = false;
    for (const field of ABSENCE_DETAIL_FIELDS) {
      const override = lookupDayWingCat(absenceDay, wingName, field);
      if (override === undefined) continue;
      detail[field] = override;
      hasDetailOverride = true;
    }
    bucket.absence = detail;
    const detailTotal = absenceDetailTotal(detail);
    const rankTotal = manpowerRowTotalFor(bucket.absent, categories);
    if (detailTotal !== rankTotal) {
      const prefer =
        officerCategoryId ?? categories[0]?.id ?? null;
      if (prefer) {
        if (hasDetailOverride) {
          bucket.absent[prefer] = Math.max(
            0,
            (bucket.absent[prefer] ?? 0) + (detailTotal - rankTotal),
          );
        } else {
          const delta = rankTotal - detailTotal;
          bucket.absence.other = Math.max(0, bucket.absence.other + delta);
        }
      }
    }
  }

  for (const [wingName, block] of wingMap.entries()) {
    block.present = presentFromHeldAbsent(block.held, block.absent, categories);
    const manualWing = isManualPresentWing(wingName);
    for (const cat of categories) {
      if (!manualWing && !isOfficerCategory(cat) && !isDadCategory(cat)) continue;
      const presentOverride = lookupDayWingCat(presentDay, wingName, cat.id);
      if (presentOverride !== undefined) block.present[cat.id] = presentOverride;
    }
  }

  const extraWingsInMap = [...wingMap.keys()].filter(
    (w) => !authWings.some((a) => a.toLowerCase() === w.toLowerCase()),
  );
  for (const extra of extraWingsInMap) {
    wingMap.delete(extra);
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
    const detail = { ...block.absence };
    return {
      wing,
      ...detail,
      total: absenceDetailTotal(detail),
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

export function manpowerRowTotalFor(
  counts: ManpowerCounts,
  categories: AuthorizedStrength[],
): number {
  return categories.reduce((sum, cat) => sum + (counts[cat.id] ?? 0), 0);
}

/** Count cells hide minus; বৃদ্ধি/হ্রাস keeps the signed প্রাধিকৃত − প্রাপ্ত value. */
export function formatManpowerCell(
  value: number,
  opts?: { signed?: boolean },
): string {
  if (opts?.signed) return String(value);
  return String(Math.abs(value));
}
