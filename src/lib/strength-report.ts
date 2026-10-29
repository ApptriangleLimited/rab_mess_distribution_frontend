import {
  canonicalRankName,
  canonicalWingName,
  DEFAULT_WING_PARENT,
  HQ_SUB_WINGS,
  rankLabelBn,
  wingOfficialSerial,
} from "@/lib/constants";
import { manpowerRankLabelBn } from "@/lib/rank-labels";
import {
  ABSENCE_DETAIL_FIELDS,
  absenceFieldForTag,
  isManualAttachedWing,
  isManpowerCountableMember,
  isManpowerDutyAbsentTag,
  manpowerWingFamily,
  matchWingInList,
  type ManpowerSnapshot,
} from "@/lib/manpower-report";
import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { canAssignOnDate } from "@/lib/store/daily";
import {
  isBannedWing,
  isHqBranchName,
  listWingChildrenFrom,
} from "@/lib/store/org-options";
import type { DailyTag, User } from "@/lib/types";

/**
 * Form 2/3 — Admin Wing daily strength.
 * Form 2 = official এ্যাডমিন উইং sheet (HQ Br / mess / MT).
 * Form 3 = HQ Br office children. Do not mix the two lists.
 * প্রাপ্ত = Daily cockpit (all tags); উপস্থিত = MS+FR+MFR+CD;
 * অনুপস্থিত = remaining tags; উপস্থিত can also be প্রাপ্ত − অনুপস্থিত.
 * Counts স্থায়ী / permanent members only (same as Form 1).
 * Officer প্রাপ্ত = Daily members (same as other ranks), not Settings.
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
  { id: "con", labelEn: "Constable", labelBn: "কনস্টেবল" },
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
  /** AWL + OSL — গড় হাজির / গড় উপস্থিত. */
  avgPresent: number;
  total: number;
};

export function emptyAbsenceRow(wing: string): StrengthAbsenceRow {
  return {
    wing,
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
    avgPresent: 0,
    total: 0,
  };
}

export function sumAbsenceRows(
  rows: StrengthAbsenceRow[],
  wing = "সর্বমোট",
): StrengthAbsenceRow {
  return rows.reduce(
    (acc, row) => ({
      wing,
      cl: acc.cl + row.cl,
      pl: acc.pl + row.pl,
      rl: acc.rl + row.rl,
      ml: acc.ml + row.ml,
      maternity: acc.maternity + row.maternity,
      training: acc.training + row.training,
      remaining: acc.remaining + row.remaining,
      exam: acc.exam + row.exam,
      other: acc.other + row.other,
      hospital: acc.hospital + row.hospital,
      avgPresent: acc.avgPresent + row.avgPresent,
      total: acc.total + row.total,
    }),
    emptyAbsenceRow(wing),
  );
}

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
    avgPresent: 0,
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

function addAbsence(
  a: Omit<StrengthAbsenceRow, "wing" | "total">,
  b: Omit<StrengthAbsenceRow, "wing" | "total">,
): Omit<StrengthAbsenceRow, "wing" | "total"> {
  return {
    cl: a.cl + b.cl,
    pl: a.pl + b.pl,
    rl: a.rl + b.rl,
    ml: a.ml + b.ml,
    maternity: a.maternity + b.maternity,
    training: a.training + b.training,
    remaining: a.remaining + b.remaining,
    exam: a.exam + b.exam,
    other: a.other + b.other,
    hospital: a.hospital + b.hospital,
    avgPresent: a.avgPresent + b.avgPresent,
  };
}

/** Paper সদর row = sum of Form 3 offices (not নতুন অস্থায়ী সংযুক্ত). */
function fillForm3Sadar(map: Map<string, Bucket>) {
  const sadar = map.get(FORM3_SADAR);
  if (!sadar) return;
  let held = emptyCounts();
  let present = emptyCounts();
  let absent = emptyCounts();
  let absence = emptyAbsence();
  for (const [wing, row] of map.entries()) {
    if (isSadarWing(wing) || isManualAttachedWing(wing)) continue;
    held = addCounts(held, row.held);
    present = addCounts(present, row.present);
    absent = addCounts(absent, row.absent);
    absence = addAbsence(absence, row.absence);
  }
  sadar.held = held;
  sadar.present = present;
  sadar.absent = absent;
  sadar.absence = absence;
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

export function strengthCategoryLabelBn(
  cat: StrengthCategory,
  overrides?: Record<string, string>,
): string {
  if (cat.id === "officer") return cat.labelBn;
  if (cat.id === "asi") return "এএসআই";
  return manpowerRankLabelBn(
    rankLabelBn(cat.labelEn, overrides ?? getState().rank_labels_bn),
  );
}

export function strengthCategoryForRank(
  rank: string,
): StrengthCategoryId | null {
  const key = normalize(canonicalRankName(rank) || rank);
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
    key === "aasi" ||
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
  if (key === "constable" || key === "const" || key === "con") return "con";
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
  return isManpowerDutyAbsentTag(tag);
}

function isSadarWing(name: string): boolean {
  const key = normalize(name);
  // Form 2 placeholder only — not HQ Br children (Form 3).
  return key === "সদর" || key === "sadar" || key === "hq";
}

function bumpAbsence(
  row: Omit<StrengthAbsenceRow, "wing" | "total">,
  tag: DailyTag | "",
) {
  const field = absenceFieldForTag(tag);
  if (!field) return;
  if (field === "witness") row.remaining += 1;
  else row[field] += 1;
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
    row.hospital +
    row.avgPresent
  );
}

type Bucket = {
  held: StrengthCounts;
  present: StrengthCounts;
  absent: StrengthCounts;
  absence: Omit<StrengthAbsenceRow, "wing" | "total">;
};

/** Official Form 2 এ্যাডমিন উইং rows — Record Branch is crossed off the paper. */
const FORM2_ADMIN_BRANCHES = [
  "HQ Br",
  "HQ Office",
  "SY Br",
  "Forces Mess",
  "Fd Mess",
  "MT Br",
  "New Temp Att",
] as const;

/**
 * Daily → Admin wings (Form 3) — paper order from দৈনিক জনবলের প্রতিবেদন.
 * সদর is the subtotal of the offices above; নতুন অস্থায়ী সংযুক্ত stays after it.
 */
const FORM3_ADMIN_WINGS = [
  "DG Office",
  "ADG (Ops) Office",
  "ADG (Admin) Office",
  "Dir Office",
  "Sup Br",
  "Per Br",
  "Gen Br",
  "Med Br",
  "Rec Br",
  "Fin Br",
  "Proc Br",
  "Proj Br",
  "Dev Br",
  "Wksp Br",
  "সদর",
  "New Temp Att",
] as const;

const FORM3_SADAR = "সদর";

const FORM2_WING_ALIASES: Record<string, string> = {
  "hq br": "HQ Br",
  "headquarters branch": "HQ Br",
  "headquarters office": "HQ Office",
  "hq office": "HQ Office",
  "security branch": "SY Br",
  "sy br": "SY Br",
  "forces mess": "Forces Mess",
  "field mess": "Fd Mess",
  "fd mess": "Fd Mess",
  "mt br": "MT Br",
  "mt branch": "MT Br",
  "new / temporary attached": "New Temp Att",
  "new temp att": "New Temp Att",
};

function resolveForm2Branch(wing: string): string | null {
  const canon = canonicalWingName(wing);
  return (
    FORM2_WING_ALIASES[normalize(canon)] ??
    FORM2_WING_ALIASES[normalize(wing)] ??
    matchWingInList(canon, [...FORM2_ADMIN_BRANCHES])
  );
}

const FORM3_WING_ALIASES: Record<string, string> = {
  "director (admin) office": "Dir Office",
  "dir office": "Dir Office",
  "new / temporary attached": "New Temp Att",
  "new temp att": "New Temp Att",
};

function resolveForm3Branch(wing: string): string | null {
  const canon = canonicalWingName(wing);
  return (
    FORM3_WING_ALIASES[normalize(canon)] ??
    FORM3_WING_ALIASES[normalize(wing)] ??
    matchWingInList(canon, [...FORM3_ADMIN_WINGS])
  );
}

function listForm2Branches(snapshot?: ManpowerSnapshot): string[] {
  const state = getState();
  const wings = snapshot?.wings?.length ? snapshot.wings : state.wings;
  const parents = {
    ...DEFAULT_WING_PARENT,
    ...(snapshot?.wingParent ?? state.wing_parent),
  };
  const kids = [
    ...listWingChildrenFrom(wings, parents, "HQ Br"),
    ...listWingChildrenFrom(wings, parents, "Headquarters Branch"),
  ];
  const official = FORM2_ADMIN_BRANCHES.map((w) => w.toLowerCase());
  const seen = new Set<string>();
  const out: string[] = [];
  function push(name: string) {
    const canon = canonicalWingName(name);
    if (!canon || isBannedWing(canon)) return;
    const key = canon.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(canon);
  }
  push("HQ Br");
  const rest = [
    ...FORM2_ADMIN_BRANCHES.filter((w) => w !== "HQ Br"),
    ...kids,
  ].sort((a, b) => {
    const ai = official.indexOf(canonicalWingName(a).toLowerCase());
    const bi = official.indexOf(canonicalWingName(b).toLowerCase());
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return (
      (wingOfficialSerial(a, state.wing_serials) ?? 10_000) -
      (wingOfficialSerial(b, state.wing_serials) ?? 10_000)
    );
  });
  for (const w of rest) push(w);
  if (!out.some((w) => isManualAttachedWing(w))) push("New Temp Att");
  return out.length ? out : [...FORM2_ADMIN_BRANCHES];
}

function listForm3Branches(snapshot?: ManpowerSnapshot): string[] {
  const state = getState();
  const wings = snapshot?.wings?.length ? snapshot.wings : state.wings;
  const parents = {
    ...DEFAULT_WING_PARENT,
    ...(snapshot?.wingParent ?? state.wing_parent),
  };
  const kids = listWingChildrenFrom(wings, parents, "Admin");
  const hqKids = new Set(HQ_SUB_WINGS.map((w) => w.toLowerCase()));
  const official = FORM3_ADMIN_WINGS.map((w) => w.toLowerCase());
  const seen = new Set<string>();
  const out: string[] = [];
  function push(name: string) {
    const canon = name === "সদর" ? "সদর" : canonicalWingName(name);
    if (!canon || isBannedWing(canon)) return;
    const key = canon.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(canon);
  }
  const offices = FORM3_ADMIN_WINGS.filter(
    (w) => w !== "সদর" && w !== "New Temp Att",
  );
  for (const w of offices) push(w);
  const extra = kids
    .filter((w) => {
      const canon = canonicalWingName(w);
      return (
        !isManualAttachedWing(canon) &&
        !isSadarWing(canon) &&
        !isHqBranchName(canon) &&
        !hqKids.has(canon.toLowerCase())
      );
    })
    .sort((a, b) => {
      const ai = official.indexOf(canonicalWingName(a).toLowerCase());
      const bi = official.indexOf(canonicalWingName(b).toLowerCase());
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return (
        (wingOfficialSerial(a, state.wing_serials) ?? 10_000) -
        (wingOfficialSerial(b, state.wing_serials) ?? 10_000)
      );
    });
  for (const w of extra) push(w);
  push("সদর");
  const attached = [
    ...kids,
    ...HQ_SUB_WINGS,
    ...wings,
  ].filter((w) => isManualAttachedWing(w));
  if (attached.length) {
    for (const w of attached) push(w);
  } else {
    push("New Temp Att");
  }
  return out.length ? out : [...FORM3_ADMIN_WINGS];
}

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

function branchesForScope(
  scope: StrengthScope,
  snapshot?: ManpowerSnapshot,
): {
  branches: string[];
  roots: string[];
  skipSadarFill: boolean;
  formNo: 2 | 3;
  wingLabel: string;
} {
  if (scope === "hq") {
    return {
      branches: listForm3Branches(snapshot),
      roots: ["HQ Br"],
      skipSadarFill: false,
      formNo: 3,
      wingLabel: "এ্যাডমিন উইং",
    };
  }

  return {
    branches: listForm2Branches(snapshot),
    roots: ["Admin", "Admin (New)", "Admin (Old)"],
    skipSadarFill: false,
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
  const cfg = branchesForScope(scope, snapshot);
  const { branches } = cfg;
  const branchSet = new Set(branches);
  const wingParent = {
    ...DEFAULT_WING_PARENT,
    ...(snapshot?.wingParent ?? state.wing_parent),
  };
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;
  const authorizedRows = snapshot?.authorized?.length
    ? snapshot.authorized
    : state.authorized;

  const map = new Map<string, Bucket>();
  for (const b of branches) {
    map.set(b, {
      held: emptyCounts(),
      present: emptyCounts(),
      absent: emptyCounts(),
      absence: emptyAbsence(),
    });
  }

  const active: User[] = sourceUsers.filter((u) => {
    if (!isManpowerCountableMember(u)) return false;
    if (u.status !== "1") return false;
    if (u.approval_status && u.approval_status !== "approved") return false;
    return canAssignOnDate(u, date);
  });

  function listedBranch(rawWing: string): string | null {
    let cur = canonicalWingName(rawWing.trim());
    const seen = new Set<string>();
    while (cur && !seen.has(cur.toLowerCase())) {
      seen.add(cur.toLowerCase());
      const resolved =
        scope === "admin"
          ? resolveForm2Branch(cur)
          : resolveForm3Branch(cur);
      if (resolved && map.has(resolved)) return resolved;
      const exact = matchWingInList(cur, [...branchSet]);
      if (exact && map.has(exact)) return exact;
      const parent = wingParent[cur] || "";
      if (!parent) {
        const key = cur.toLowerCase();
        for (const [child, p] of Object.entries(wingParent)) {
          if (child.trim().toLowerCase() === key && p) {
            cur = p;
            break;
          }
        }
        if (cur.toLowerCase() === key) break;
        continue;
      }
      if (isSadarWing(parent)) break;
      cur = parent;
    }
    return null;
  }

  for (const user of active) {
    const cat = strengthCategoryForRank(user.rank);
    if (!cat) continue;

    const rawWing = user.wing.trim();
    const family = manpowerWingFamily(rawWing, wingParent);
    if (scope === "hq" && family !== "hq" && family !== "admin") continue;
    if (scope === "hq" && isSadarWing(rawWing)) continue;

    const branch = listedBranch(rawWing);
    if (!branch || !map.has(branch)) continue;
    if (cfg.skipSadarFill && isSadarWing(branch)) continue;

    const bucket = map.get(branch);
    if (!bucket) continue;

    const resolved = tagFor(user.id);
    const tag = (
      snapshot ? resolved : resolved || user.default_tag || ""
    ) as DailyTag | "";
    if (!tag) continue;

    bucket.held[cat] += 1;
    const field = absenceFieldForTag(tag);
    if (field) {
      bucket.absent[cat] += 1;
      bumpAbsence(bucket.absence, tag);
    }
  }

  const heldDay = state.manpower_held?.[date] ?? {};
  const absentDay = state.manpower_absent?.[date] ?? {};
  const presentDay = state.manpower_present?.[date] ?? {};
  const absenceDay = state.manpower_absence_detail?.[date] ?? {};
  for (const [wingName, bucket] of map.entries()) {
    const manualWing = isManualAttachedWing(wingName);
    for (const cat of STRENGTH_CATEGORIES) {
      if (!manualWing && cat.id !== "officer" && cat.id !== "dad") continue;
      const heldOverride = lookupDayWingCat(heldDay, wingName, cat.id);
      if (heldOverride !== undefined) bucket.held[cat.id] = heldOverride;
      const absOverride = lookupDayWingCat(absentDay, wingName, cat.id);
      if (absOverride !== undefined) bucket.absent[cat.id] = absOverride;
    }
    if (!manualWing) continue;
    let hasDetail = false;
    for (const field of ABSENCE_DETAIL_FIELDS) {
      const storeKey = field === "witness" ? "witness" : field;
      const override = lookupDayWingCat(absenceDay, wingName, storeKey);
      if (override === undefined) continue;
      hasDetail = true;
      if (field === "witness") bucket.absence.remaining = override;
      else bucket.absence[field] = override;
    }
    const detailTotal =
      bucket.absence.cl +
      bucket.absence.pl +
      bucket.absence.rl +
      bucket.absence.ml +
      bucket.absence.maternity +
      bucket.absence.training +
      bucket.absence.remaining +
      bucket.absence.exam +
      bucket.absence.other +
      bucket.absence.hospital +
      bucket.absence.avgPresent;
    const rankTotal = STRENGTH_CATEGORIES.reduce(
      (s, c) => s + (bucket.absent[c.id] ?? 0),
      0,
    );
    if (detailTotal !== rankTotal) {
      if (hasDetail) {
        bucket.absent.officer = Math.max(
          0,
          (bucket.absent.officer ?? 0) + (detailTotal - rankTotal),
        );
      } else {
        bucket.absence.other = Math.max(
          0,
          bucket.absence.other + (rankTotal - detailTotal),
        );
      }
    }
  }

  for (const [wing, b] of map.entries()) {
    if (scope === "hq" && isSadarWing(wing)) continue;
    b.present = presentFromHeldAbsent(b.held, b.absent);
    const manualWing = isManualAttachedWing(wing);
    for (const cat of STRENGTH_CATEGORIES) {
      if (!manualWing && cat.id !== "officer" && cat.id !== "dad") continue;
      const presentOverride = lookupDayWingCat(presentDay, wing, cat.id);
      if (presentOverride !== undefined) b.present[cat.id] = presentOverride;
    }
  }

  const officerRow = authorizedRows.find((r) => {
    const key = r.label.trim().toLowerCase();
    return key === "officer" || key.startsWith("officer");
  });
  const officerAuthorizedId = officerRow?.id ?? null;

  if (scope === "hq") fillForm3Sadar(map);

  const branchBlocks: StrengthBranchBlock[] = branches.map((wing) => {
    const b = map.get(wing)!;
    const withoutRecord = cfg.skipSadarFill && isSadarWing(wing);
    if (withoutRecord) {
      const held = emptyCounts();
      const present = emptyCounts();
      const absent = emptyCounts();
      held.officer = b.held.officer ?? 0;
      present.officer = b.present.officer ?? 0;
      absent.officer = b.absent.officer ?? 0;
      return {
        wing,
        withoutRecord: true,
        held,
        present,
        absent,
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
    if (scope === "hq" && isSadarWing(wing)) continue;
    const b = map.get(wing)!;
    summaryHeld = addCounts(summaryHeld, b.held);
    summaryPresent = addCounts(summaryPresent, b.present);
    summaryAbsent = addCounts(summaryAbsent, b.absent);
  }

  let grandHeld = emptyCounts();
  let grandPresent = emptyCounts();
  let grandAbsent = emptyCounts();
  for (const block of branchBlocks) {
    if (scope === "hq" && isSadarWing(block.wing)) continue;
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
