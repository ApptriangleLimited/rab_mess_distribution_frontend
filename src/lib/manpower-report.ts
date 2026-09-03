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
  isAdminAuthorizedRoot,
  isBannedWing,
  listAuthorized,
  listAuthorizedRootWings,
} from "@/lib/store/org-options";
import type { AuthorizedStrength, DailyTag, User } from "@/lib/types";
import type { AssignmentCell } from "@/lib/api/assignments";

/** Optional daily-cockpit snapshot (API mode). Else use local store. */
export type ManpowerSnapshot = {
  users: User[];
  /** Projected tag for member on report date (stored/carry). */
  tagFor: (userId: string) => DailyTag | "";
  wingParent?: Record<string, string>;
};

/** Build tag resolver from assignment cells for one date. */
export function tagForFromCells(
  cells: AssignmentCell[],
  date: string,
): (userId: string) => DailyTag | "" {
  const byMember = new Map<string, AssignmentCell>();
  for (const cell of cells) {
    if (cell.date !== date) continue;
    byMember.set(cell.member_id, cell);
  }
  return (userId: string): DailyTag | "" => {
    const cell = byMember.get(userId);
    if (!cell) return "";
    if (cell.source === "stored" || cell.source === "carry") {
      return (cell.tag as DailyTag) ?? "";
    }
    return "";
  };
}

export type ManpowerCounts = Record<string, number>;

export type ManpowerWingBlock = {
  wing: string;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
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
  /** Sum of wing blocks — print after all wings. */
  grandTotal: ManpowerWingBlock;
  absence: ManpowerAbsenceRow[];
};

const ABSENT_TAGS = new Set<string>([
  "CL",
  "PL",
  "WR",
  "WIT",
  "MED",
  "TRG",
  "CMH",
  "RBH",
  "BGH",
  "AWL",
  "OSL",
  "MOL",
  "CD",
  "RL",
  "JL",
  "PE",
  "LNK",
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

function rootWing(wing: string, wingParent: Record<string, string>): string {
  if (!wing.trim()) return "—";
  let cur = wing.trim();
  const seen = new Set<string>([cur.toLowerCase()]);
  while (wingParent[cur]) {
    const parent = wingParent[cur];
    if (seen.has(parent.toLowerCase())) break;
    seen.add(parent.toLowerCase());
    cur = parent;
  }
  return cur;
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

/**
 * Daily Manpower Report for `date`.
 * প্রাধিকৃত = Settings → Authorized (rank total = wing sum; wing cells = per-wing).
 * প্রাপ্ত = active members; অনুপস্থিত = cockpit absent tags;
 * উপস্থিত = প্রাপ্ত − অনুপস্থিত. Wing rows: Officer blank for প্রাপ্ত/উপস্থিত/অনুপস্থিত.
 */
export function buildManpowerReport(
  date: string,
  snapshot?: ManpowerSnapshot,
): ManpowerReport {
  const state = getState();
  const categories = listAuthorized();
  const officerCategoryId = officerIdOf(categories);
  const wingParent = snapshot?.wingParent ?? state.wing_parent;
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;

  const hqAuth = emptyCounts(categories);
  for (const cat of categories) {
    hqAuth[cat.id] = cat.count;
  }

  const hqHeld = emptyCounts(categories);
  const hqAbsent = emptyCounts(categories);

  /** Same short wing list as Settings → Authorized. */
  const authWings = listAuthorizedRootWings();
  const authWingSet = new Set(authWings.map((w) => w.toLowerCase()));

  function toAuthWing(root: string): string | null {
    if (!root || root === "—" || isBannedWing(root)) return null;
    if (isAdminAuthorizedRoot(root) || root === "Admin") {
      return authWingSet.has("admin") ? "Admin" : null;
    }
    return authWingSet.has(root.toLowerCase()) ? root : null;
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

  const active: User[] = sourceUsers.filter(
    (u) =>
      u.approval_status === "approved" &&
      u.status === "1" &&
      isCockpitMember(u) &&
      canAssignOnDate(u, date),
  );

  for (const user of active) {
    const catId = categoryIdForRank(user.rank, categories);
    if (!catId) continue;

    const tag = tagFor(user.id);
    const root = rootWing(user.wing, wingParent);
    const authWing = toAuthWing(root);

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
      case "WR":
      case "RL":
        wing.absence.rl += 1;
        break;
      case "MED":
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
      case "CD":
      case "PE":
        wing.absence.exam += 1;
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
        wing.absence.other += 1;
        break;
    }
  }

  // Officer প্রাপ্ত = Settings held_wings; অনুপস্থিত = date overrides; উপস্থিত = প্রাপ্ত − অনুপস্থিত.
  const officerCat = officerCategoryId
    ? categories.find((c) => c.id === officerCategoryId)
    : undefined;
  const officerAbsentDay = state.manpower_officer_absent?.[date] ?? {};
  if (officerCategoryId && officerCat) {
    let hqOfficerHeld = 0;
    let hqOfficerAbsent = 0;
    for (const wingName of authWings) {
      const heldN = authorizedWingDisplayCount(
        officerCat.held_wings,
        wingName,
      );
      const absN = authorizedWingDisplayCount(officerAbsentDay, wingName);
      hqOfficerHeld += heldN;
      hqOfficerAbsent += absN;
      const bucket = wingMap.get(wingName);
      if (bucket) {
        bucket.held[officerCategoryId] = heldN;
        bucket.absent[officerCategoryId] = absN;
        bucket.present[officerCategoryId] = Math.max(0, heldN - absN);
      }
    }
    hqHeld[officerCategoryId] = hqOfficerHeld;
    hqAbsent[officerCategoryId] = hqOfficerAbsent;
  }

  const hqPresent = presentFromHeldAbsent(hqHeld, hqAbsent, categories);
  for (const block of wingMap.values()) {
    block.present = presentFromHeldAbsent(block.held, block.absent, categories);
    // Keep Officer present from held − absent (re-apply after presentFromHeldAbsent).
    if (officerCategoryId) {
      const h = block.held[officerCategoryId] ?? 0;
      const a = block.absent[officerCategoryId] ?? 0;
      block.present[officerCategoryId] = Math.max(0, h - a);
    }
  }

  const wings: ManpowerWingBlock[] = authWings.map((wing) => {
    const block = wingMap.get(wing)!;
    const authorized = emptyCounts(categories);
    for (const cat of categories) {
      authorized[cat.id] = authorizedWingDisplayCount(cat.wings, wing);
    }
    return {
      wing,
      authorized,
      held: block.held,
      present: block.present,
      absent: block.absent,
    };
  });

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

  const absence: ManpowerAbsenceRow[] = authWings.map((wing) => {
    const block = wingMap.get(wing)!;
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
  });

  return {
    date,
    categories,
    officerCategoryId,
    hq: {
      authorized: hqAuth,
      held: hqHeld,
      shortfall: shortfallCounts(hqAuth, hqHeld, categories),
      present: hqPresent,
      absent: hqAbsent,
    },
    wings,
    grandTotal: {
      wing: "সর্বমোট",
      authorized: grandAuth,
      held: grandHeld,
      present: grandPresent,
      absent: grandAbsent,
    },
    absence,
  };
}

export function manpowerRowTotal(counts: ManpowerCounts): number {
  return sumCounts(counts);
}

/** Print cell value — never show minus (e.g. shortfall −12 → 12). */
export function formatManpowerCell(value: number): string {
  return String(Math.abs(value));
}
