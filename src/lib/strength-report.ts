import { ADMIN_SUB_WINGS, HQ_SUB_WINGS } from "@/lib/constants";
import type { ManpowerSnapshot } from "@/lib/manpower-report";
import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { canAssignOnDate } from "@/lib/store/daily";
import {
  authorizedWingDisplayCount,
  isBannedWing,
  listWingChildren,
} from "@/lib/store/org-options";
import { isCockpitMember } from "@/lib/store/users";
import type { DailyTag, User } from "@/lib/types";

/**
 * Form 2/3 — Admin Wing daily strength.
 * Form 2 = Admin children. Form 3 = HQ Br children.
 * Ranks: Officer, DAD, RT, SI, ASI, Naik, Con, Cook, NC(E), Civil.
 * প্রাপ্ত = members; অনুপস্থিত = cockpit absent tags; উপস্থিত = প্রাপ্ত − অনুপস্থিত.
 * Officer: প্রাপ্ত = Settings held_wings; অনুপস্থিত = date overrides; উপস্থিত = প্রাপ্ত − অনুপস্থিত.
 * Form 2: সদর without record.
 */

export type StrengthScope = "admin" | "hq";

export type StrengthCategoryId =
  | "officer"
  | "dad"
  | "rt"
  | "si"
  | "asi"
  | "naik"
  | "con"
  | "cook"
  | "nce"
  | "civil";

export type StrengthCategory = {
  id: StrengthCategoryId;
  labelEn: string;
  labelBn: string;
};

export const STRENGTH_CATEGORIES: StrengthCategory[] = [
  { id: "officer", labelEn: "Officer", labelBn: "অফিসার" },
  { id: "dad", labelEn: "DAD", labelBn: "ডিএডি" },
  { id: "rt", labelEn: "RT", labelBn: "আরটি" },
  { id: "si", labelEn: "SI", labelBn: "এসআই" },
  { id: "asi", labelEn: "ASI", labelBn: "এএসআই" },
  { id: "naik", labelEn: "Naik", labelBn: "নায়েক" },
  { id: "con", labelEn: "Con", labelBn: "কন" },
  { id: "cook", labelEn: "Cook", labelBn: "পাচক" },
  { id: "nce", labelEn: "NC(E)", labelBn: "এনসি(ই)" },
  { id: "civil", labelEn: "Civil", labelBn: "সিভিল" },
];

export type StrengthCounts = Record<StrengthCategoryId, number>;

export type StrengthBranchBlock = {
  wing: string;
  withoutRecord: boolean;
  held: StrengthCounts;
  present: StrengthCounts;
  absent: StrengthCounts;
};

export type StrengthAbsenceRow = {
  wing: string;
  cl: number;
  pl: number;
  rl: number;
  ml: number;
  maternity: number;
  training: number;
  remaining: number;
  exam: number;
  other: number;
  hospital: number;
  total: number;
};

export type StrengthReport = {
  date: string;
  scope: StrengthScope;
  formNo: 2 | 3;
  titleBn: string;
  wingLabel: string;
  categories: StrengthCategory[];
  /** Settings Officer row — for editable প্রাপ্ত on web. */
  officerAuthorizedId: string | null;
  summary: {
    held: StrengthCounts;
    present: StrengthCounts;
    absent: StrengthCounts;
  };
  branches: StrengthBranchBlock[];
  grandTotal: StrengthBranchBlock;
  absence: StrengthAbsenceRow[];
  /** Handwritten movement footer on Form 3 paper. */
  movement: { going: number; coming: number };
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

function emptyCounts(): StrengthCounts {
  return {
    officer: 0,
    dad: 0,
    rt: 0,
    si: 0,
    asi: 0,
    naik: 0,
    con: 0,
    cook: 0,
    nce: 0,
    civil: 0,
  };
}

function emptyAbsence(): Omit<StrengthAbsenceRow, "wing" | "total"> {
  return {
    cl: 0,
    pl: 0,
    rl: 0,
    ml: 0,
    maternity: 0,
    training: 0,
    remaining: 0,
    exam: 0,
    other: 0,
    hospital: 0,
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function addCounts(a: StrengthCounts, b: StrengthCounts): StrengthCounts {
  const out = emptyCounts();
  for (const cat of STRENGTH_CATEGORIES) {
    out[cat.id] = (a[cat.id] ?? 0) + (b[cat.id] ?? 0);
  }
  return out;
}

/** উপস্থিত = প্রাপ্ত − অনুপস্থিত. */
function presentFromHeldAbsent(
  held: StrengthCounts,
  absent: StrengthCounts,
): StrengthCounts {
  const out = emptyCounts();
  for (const cat of STRENGTH_CATEGORIES) {
    out[cat.id] = Math.max(0, (held[cat.id] ?? 0) - (absent[cat.id] ?? 0));
  }
  return out;
}

export function strengthMetricTotal(
  counts: StrengthCounts,
  skipOfficer = false,
): number {
  let n = 0;
  for (const cat of STRENGTH_CATEGORIES) {
    if (skipOfficer && cat.id === "officer") continue;
    n += counts[cat.id] ?? 0;
  }
  return n;
}

export function strengthCategoryForRank(
  rank: string,
): StrengthCategoryId | null {
  const key = normalize(rank);
  if (!key) return null;
  if (
    key === "dad" ||
    key.startsWith("dad ") ||
    key.includes("deputy assistant")
  ) {
    return "dad";
  }
  if (
    key === "rt" ||
    key === "wrt" ||
    key === "wo" ||
    key === "swo" ||
    key.includes("warrant")
  ) {
    return "rt";
  }
  if (key === "si" || key === "s.i" || key === "sub inspector") return "si";
  if (
    key === "asi" ||
    key === "a.s.i" ||
    key === "assistant sub inspector"
  ) {
    return "asi";
  }
  if (
    key === "naik" ||
    key === "nayek" ||
    key === "naiek" ||
    key === "nayak" ||
    key === "lnco" ||
    key === "l/cpl" ||
    key === "lcpl" ||
    key === "cpl"
  ) {
    return "naik";
  }
  if (key === "cook") return "cook";
  if (
    key === "nce" ||
    key === "nc(e)" ||
    key === "nc (e)" ||
    key === "lp(e)" ||
    key === "lpe" ||
    key === "ance"
  ) {
    return "nce";
  }
  if (key === "civil" || key === "civill" || key === "civilian") return "civil";
  if (
    key === "officer" ||
    key === "ad" ||
    key === "director" ||
    key === "co" ||
    key === "oc" ||
    key.includes("capt") ||
    key.includes("maj") ||
    key.includes("col") ||
    key.startsWith("lt")
  ) {
    return "officer";
  }
  return "con";
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

function isSadarWing(name: string): boolean {
  const key = normalize(name);
  // Form 2 placeholder only — not HQ Br children (Form 3).
  return key === "সদর" || key === "sadar" || key === "hq";
}

function isAdminFamilyRoot(name: string): boolean {
  const key = normalize(name);
  return key === "admin" || key === "admin (new)" || key === "admin (old)";
}

function isHqBrRoot(name: string): boolean {
  const key = normalize(name);
  return key === "hq br" || key === "headquarters branch";
}

function walkWingRoot(
  wing: string,
  wingParent: Record<string, string>,
): string {
  let cur = wing.trim();
  if (!cur) return cur;
  const seen = new Set<string>([cur.toLowerCase()]);
  while (wingParent[cur]) {
    const p = wingParent[cur];
    if (seen.has(p.toLowerCase())) break;
    seen.add(p.toLowerCase());
    cur = p;
  }
  return cur;
}

function pathIncludesHqBr(
  wing: string,
  wingParent: Record<string, string>,
): boolean {
  let cur = wing.trim();
  const seen = new Set<string>();
  while (cur) {
    if (isHqBrRoot(cur)) return true;
    if (seen.has(cur.toLowerCase())) break;
    seen.add(cur.toLowerCase());
    cur = wingParent[cur] ?? "";
  }
  return false;
}

/** Stable sub-wing pick when member sits on parent root (not a listed child). */
function pickSubWing(userId: string, branches: string[]): string | null {
  const real = branches.filter((b) => !isSadarWing(b));
  if (real.length === 0) return null;
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return real[h % real.length]!;
}


function bumpAbsence(
  row: Omit<StrengthAbsenceRow, "wing" | "total">,
  tag: DailyTag | "",
) {
  switch (tag) {
    case "CL":
      row.cl += 1;
      break;
    case "PL":
      row.pl += 1;
      break;
    case "WR":
    case "RL":
      row.rl += 1;
      break;
    case "MED":
      row.ml += 1;
      break;
    case "MOL":
      row.maternity += 1;
      break;
    case "TRG":
      row.training += 1;
      break;
    case "CD":
    case "PE":
      row.exam += 1;
      break;
    case "CMH":
    case "RBH":
    case "BGH":
      row.hospital += 1;
      break;
    case "WIT":
      row.remaining += 1;
      break;
    default:
      if (tag) row.other += 1;
      break;
  }
}

function absenceTotal(
  row: Omit<StrengthAbsenceRow, "wing" | "total">,
): number {
  return (
    row.cl +
    row.pl +
    row.rl +
    row.ml +
    row.maternity +
    row.training +
    row.remaining +
    row.exam +
    row.other +
    row.hospital
  );
}

type Bucket = {
  held: StrengthCounts;
  present: StrengthCounts;
  absent: StrengthCounts;
  absence: Omit<StrengthAbsenceRow, "wing" | "total">;
};

function resolveBranch(
  wing: string,
  wingParent: Record<string, string>,
  branchSet: Set<string>,
  rootNames: string[],
): string | null {
  if (!wing.trim()) return null;
  let cur = wing.trim();
  const seen = new Set<string>([cur.toLowerCase()]);
  if (branchSet.has(cur)) return cur;
  while (wingParent[cur]) {
    const parent = wingParent[cur];
    if (branchSet.has(cur) && rootNames.some((r) => normalize(r) === normalize(parent))) {
      return cur;
    }
    if (branchSet.has(parent)) return parent;
    if (seen.has(parent.toLowerCase())) break;
    seen.add(parent.toLowerCase());
    cur = parent;
  }
  if (rootNames.some((r) => normalize(r) === normalize(wing.trim()) || normalize(r) === normalize(cur))) {
    for (const b of branchSet) {
      if (isSadarWing(b)) return b;
    }
  }
  return null;
}

function branchesForScope(scope: StrengthScope): {
  branches: string[];
  roots: string[];
  skipSadarFill: boolean;
  formNo: 2 | 3;
  wingLabel: string;
} {
  if (scope === "hq") {
    let branches = listWingChildren("HQ Br");
    if (branches.length === 0) {
      branches = [...HQ_SUB_WINGS];
    }
    branches = branches.filter((w) => !isBannedWing(w));
    return {
      branches,
      roots: ["HQ Br", "Headquarters Branch"],
      skipSadarFill: false,
      formNo: 3,
      wingLabel: "এ্যাডমিন উইং · সদর দপ্তর শাখা",
    };
  }

  let branches = listWingChildren("Admin");
  if (branches.length === 0) branches = listWingChildren("Admin (New)");
  if (branches.length === 0) branches = [...ADMIN_SUB_WINGS];
  branches = branches.filter((w) => !isBannedWing(w));
  const branchSet = new Set(branches);
  if (![...branchSet].some(isSadarWing)) {
    branches = ["সদর", ...branches];
  }
  return {
    branches,
    roots: ["Admin", "Admin (New)", "Admin (Old)"],
    skipSadarFill: true,
    formNo: 2,
    wingLabel: "এ্যাডমিন উইং",
  };
}

/** Form 2 (`admin`) or Form 3 (`hq`) daily strength. */
export function buildStrengthReport(
  date: string,
  scope: StrengthScope = "admin",
  snapshot?: ManpowerSnapshot,
): StrengthReport {
  const state = getState();
  const cfg = branchesForScope(scope);
  let { branches } = cfg;
  const branchSet = new Set(branches);
  const wingParent = snapshot?.wingParent ?? state.wing_parent;
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;

  const map = new Map<string, Bucket>();
  for (const b of branches) {
    map.set(b, {
      held: emptyCounts(),
      present: emptyCounts(),
      absent: emptyCounts(),
      absence: emptyAbsence(),
    });
  }

  const active: User[] = sourceUsers.filter(
    (u) =>
      u.approval_status === "approved" &&
      u.status === "1" &&
      isCockpitMember(u) &&
      canAssignOnDate(u, date),
  );

  for (const user of active) {
    const cat = strengthCategoryForRank(user.rank);
    if (!cat) continue;

    let branch = resolveBranch(
      user.wing,
      wingParent,
      branchSet,
      cfg.roots,
    );
    // Parent-root members (Admin / HQ Br) → spread onto real sub-wings so forms fill.
    if (scope === "admin") {
      if (
        (branch && cfg.skipSadarFill && isSadarWing(branch)) ||
        (!branch && isAdminFamilyRoot(user.wing.trim()))
      ) {
        const root = walkWingRoot(user.wing, wingParent);
        if (isAdminFamilyRoot(root) || isAdminFamilyRoot(user.wing.trim())) {
          branch = pickSubWing(user.id, branches);
        }
      }
    } else if (scope === "hq" && !branch) {
      const root = walkWingRoot(user.wing, wingParent);
      const onHq =
        isHqBrRoot(user.wing.trim()) ||
        pathIncludesHqBr(user.wing, wingParent) ||
        isAdminFamilyRoot(user.wing.trim()) ||
        isAdminFamilyRoot(root);
      if (onHq) {
        branch = pickSubWing(user.id, branches);
      }
    }
    if (!branch) continue;
    if (cfg.skipSadarFill && isSadarWing(branch)) continue;

    const bucket = map.get(branch);
    if (!bucket) continue;

    const tag = tagFor(user.id);

    bucket.held[cat] += 1;
    if (isAbsentTag(tag)) {
      bucket.absent[cat] += 1;
      bumpAbsence(bucket.absence, tag);
    }
  }

  for (const b of map.values()) {
    b.present = presentFromHeldAbsent(b.held, b.absent);
  }

  // Officer প্রাপ্ত = Settings held_wings; অনুপস্থিত = date overrides; উপস্থিত = প্রাপ্ত − অনুপস্থিত.
  const officerRow = state.authorized.find((r) => {
    const key = r.label.trim().toLowerCase();
    return key === "officer" || key.startsWith("officer");
  });
  const officerAuthorizedId = officerRow?.id ?? null;
  const officerAbsentDay = state.manpower_officer_absent?.[date] ?? {};
  if (officerRow) {
    for (const wing of branches) {
      if (cfg.skipSadarFill && isSadarWing(wing)) continue;
      const bucket = map.get(wing);
      if (!bucket) continue;
      const heldN = authorizedWingDisplayCount(officerRow.held_wings, wing);
      const absN = Math.min(
        authorizedWingDisplayCount(officerAbsentDay, wing),
        heldN,
      );
      bucket.held.officer = heldN;
      bucket.absent.officer = absN;
      bucket.present.officer = Math.max(0, heldN - absN);
    }
  } else {
    for (const bucket of map.values()) {
      bucket.held.officer = 0;
      bucket.absent.officer = 0;
      bucket.present.officer = 0;
    }
  }

  const branchBlocks: StrengthBranchBlock[] = branches.map((wing) => {
    const b = map.get(wing)!;
    const withoutRecord = cfg.skipSadarFill && isSadarWing(wing);
    if (withoutRecord) {
      return {
        wing,
        withoutRecord: true,
        held: emptyCounts(),
        present: emptyCounts(),
        absent: emptyCounts(),
      };
    }
    return {
      wing,
      withoutRecord: false,
      held: { ...b.held },
      present: { ...b.present },
      absent: { ...b.absent },
    };
  });

  let summaryHeld = emptyCounts();
  let summaryPresent = emptyCounts();
  let summaryAbsent = emptyCounts();
  for (const wing of branches) {
    if (cfg.skipSadarFill && isSadarWing(wing)) continue;
    const b = map.get(wing)!;
    summaryHeld = addCounts(summaryHeld, b.held);
    summaryPresent = addCounts(summaryPresent, b.present);
    summaryAbsent = addCounts(summaryAbsent, b.absent);
  }

  let grandHeld = emptyCounts();
  let grandPresent = emptyCounts();
  let grandAbsent = emptyCounts();
  for (const block of branchBlocks) {
    grandHeld = addCounts(grandHeld, block.held);
    grandPresent = addCounts(grandPresent, block.present);
    grandAbsent = addCounts(grandAbsent, block.absent);
  }

  const absence: StrengthAbsenceRow[] = branches.map((wing) => {
    const raw =
      cfg.skipSadarFill && isSadarWing(wing)
        ? emptyAbsence()
        : map.get(wing)!.absence;
    return { wing, ...raw, total: absenceTotal(raw) };
  });

  return {
    date,
    scope,
    formNo: cfg.formNo,
    titleBn: "দৈনিক জনবলের প্রতিবেদন",
    wingLabel: cfg.wingLabel,
    categories: STRENGTH_CATEGORIES,
    officerAuthorizedId,
    summary: {
      held: summaryHeld,
      present: summaryPresent,
      absent: summaryAbsent,
    },
    branches: branchBlocks,
    grandTotal: {
      wing: "সর্বমোট",
      withoutRecord: false,
      held: grandHeld,
      present: grandPresent,
      absent: grandAbsent,
    },
    absence,
    movement: { going: 0, coming: 0 },
  };
}
