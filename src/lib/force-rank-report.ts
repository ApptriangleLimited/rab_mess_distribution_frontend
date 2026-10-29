import {
  FORCES,
  canonicalForceName,
  canonicalForceServiceRank,
  canonicalWingName,
  defaultForceRankForSrb,
  forceLabelBn,
} from "@/lib/constants";
import {
  isManualPresentWing,
  isManpowerCountableMember,
  type ManpowerSnapshot,
} from "@/lib/manpower-report";
import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { canAssignOnDate } from "@/lib/store/daily";
import { manpowerPaperWingLabel } from "@/lib/rank-labels";
import {
  listForces,
  listWingChildren,
  memberFormWing,
  memberMatchesWingFilter,
} from "@/lib/store/org-options";
import type { DailyTag } from "@/lib/types";

/** RAB columns on the paper (Settings ranks). */
export const FORCE_RANK_RANKS = [
  { id: "dad", rab: "DAD", labelBn: "ডিএডি" },
  { id: "rt", rab: "RT", labelBn: "আরটি" },
  { id: "si", rab: "SI", labelBn: "এসআই" },
  { id: "asi", rab: "ASI", labelBn: "এএসআই" },
  { id: "naik", rab: "Naik", labelBn: "নায়েক" },
  { id: "constable", rab: "Constable", labelBn: "কনস্টেবল" },
  { id: "cook", rab: "Cook", labelBn: "কুক" },
  { id: "nce", rab: "NCE", labelBn: "এনসিই" },
  { id: "civil", rab: "Civil", labelBn: "সিভিল" },
] as const;

const PAPER_FORCE_BN: Record<string, string> = {
  Army: "সেনাবাহিনী",
  Navy: "নৌবাহিনী",
  "Air Force": "বিমানবাহিনী",
  BGB: "বিজিবি",
  Police: "পুলিশ",
  Ansar: "আনসার",
  "Coast Guard": "কোস্ট গার্ড",
  Civilian: "বেসামরিক",
};

const PAPER_FORCES = [
  "Army",
  "Navy",
  "Air Force",
  "BGB",
  "Police",
  "Ansar",
  "Civilian",
] as const;

/** Paper RAB column → force ranks (same slots as the printed form). */
const DEFAULT_EQUIV: Record<string, Record<string, string[]>> = {
  Army: {
    DAD: ["SWO", "WO"],
    RT: [],
    SI: ["SI", "Sgt", "Cpl"],
    ASI: ["L/Cpl"],
    Naik: [],
    Constable: ["Sainik"],
    Cook: ["CK"],
    NCE: ["NCE"],
    Civil: ["Msg", "MW", "Msl", "Mali", "LA", "WB", "Civ"],
  },
  Navy: {
    DAD: ["SCPO", "CPO", "CEA"],
    RT: [],
    SI: ["PO", "LS/MA", "REA-IV", "LEN", "LREN", "LRO(G)", "LSA", "LNP/LPM"],
    ASI: ["AB/MA-1", "SA-I"],
    Naik: [],
    Constable: ["OD"],
    Cook: ["LCK/CK"],
    NCE: ["NCE/Top"],
    Civil: ["L/Std"],
  },
  "Air Force": {
    DAD: ["SWO", "WO"],
    RT: [],
    SI: ["Sgt", "Cpl"],
    ASI: ["LAC"],
    Naik: [],
    Constable: ["Sainik"],
    Cook: ["CK"],
    NCE: ["NCE"],
    Civil: ["MW", "Civ"],
  },
  Police: {
    DAD: ["Inspector"],
    RT: [],
    SI: ["SI"],
    ASI: ["ASI"],
    Naik: ["Naik"],
    Constable: ["Constable"],
    Cook: [],
    NCE: [],
    Civil: [],
  },
  BGB: {
    DAD: ["Sub", "Nb Sub"],
    RT: [],
    SI: ["Havildar"],
    ASI: ["Naik"],
    Naik: ["Lance Naik"],
    Constable: ["Sepoy"],
    Cook: ["CK"],
    NCE: ["NCE"],
    Civil: ["MLSS", "MW", "Mali"],
  },
  Ansar: {
    DAD: ["CD"],
    RT: [],
    SI: ["PC"],
    ASI: ["APC"],
    Naik: ["Havildar", "Naik"],
    Constable: ["Lance Naik", "Sepoy"],
    Cook: [],
    NCE: [],
    Civil: ["MLSS", "Civ"],
  },
  "Coast Guard": {
    DAD: ["SCPO", "CPO"],
    RT: [],
    SI: ["PO", "LS/MA"],
    ASI: ["AB/MA-1"],
    Naik: [],
    Constable: ["OD"],
    Cook: ["LCK/CK"],
    NCE: ["NCE/Top"],
    Civil: ["L/Std"],
  },
  Civilian: {
    DAD: ["S A EB"],
    RT: [],
    SI: [],
    ASI: [],
    Naik: [],
    Constable: [],
    Cook: [],
    NCE: [],
    Civil: ["Office Assistant", "UDC"],
  },
};

/** Short Bangla names as printed on the form (not the long Settings titles). */
const PAPER_CELL_BN: Record<string, string> = {
  mwo: "এমডব্লিউও",
  swo: "সিওও",
  wo: "ওও",
  sgt: "সার্জেন্ট",
  cpl: "কর্পোরাল",
  "l/cpl": "ল্যান্স কর্পোরাল",
  sainik: "সৈনিক",
  ck: "কুক",
  nce: "এনসিই",
  "office assistant": "অফিস সহকারী",
  udc: "ইউডিসি",
  scpo: "এসসিপিও",
  cpo: "সিপিও",
  po: "পিও",
  "ls/ma": "এলএস/এমএ",
  ls: "এলএস",
  "ab/ma-1": "এবি/এমএ-১",
  ab: "এবি",
  od: "ওডি",
  "lck/ck": "এলসিকে/সিকে কুক",
  "nce/top": "এনসিই/টপ",
  lac: "এলএসি",
  ac: "এসি",
  inspector: "ইন্সপেক্টর",
  si: "এসআই",
  asi: "এএসআই",
  naik: "নায়েক",
  constable: "কনস্টেবল",
  sub: "সুবেদার",
  "nb sub": "নায়েব সুবেদার",
  havildar: "হাবিলদার",
  "lance naik": "ল্যান্স নায়েক",
  sepoy: "সিপাহী",
  cd: "সার্কেল এডি",
  pc: "পিসি",
  apc: "এপিসি",
  "s a eb": "এসএ ইবি",
};

/** Fixed সিভিল sub-columns on the paper. */
const CIVIL_SLOTS = [
  { keys: ["msg", "mlss", "mlss/messenger"], emptyBn: "-" },
  { keys: ["mw", "l/std", "l steward", "leading steward"], emptyBn: "-" },
  { keys: ["msl"], emptyBn: "-" },
  { keys: ["mali"], emptyBn: "-" },
  { keys: ["la"], emptyBn: "-" },
  { keys: ["wb"], emptyBn: "-" },
  { keys: ["civ"], emptyBn: "-" },
] as const;

const CIVIL_LABEL_BN: Record<string, string> = {
  msg: "বার্তাবাহক",
  mlss: "এমএলএসএস",
  mw: "মেস ওয়েটার",
  "l/std": "এল স্টুয়ার্ড",
  "l steward": "এল স্টুয়ার্ড",
  "leading steward": "এল স্টুয়ার্ড",
  msl: "মসালচি",
  mali: "মালি",
  la: "ল্যাব অ্যা",
  wb: "ওয়ার্ড বয়",
  civ: "সিভিল",
};

export type ForceRankCell = {
  rank: string;
  labelBn: string;
  count: number;
  span?: number;
};

export type ForceRankForceRow = {
  force: string;
  labelBn: string;
  cells: Record<string, ForceRankCell[]>;
  total: number;
};

export type ForceRankCol = {
  id: string;
  rab: string;
  labelBn: string;
  span: number;
};

export type ForceRankWingBlock = {
  wing: string;
  labelBn: string;
  forces: ForceRankForceRow[];
  total: number;
};

export type ForceRankReport = {
  date: string;
  orgBn: string;
  titleBn: string;
  filterWing: string;
  columns: ForceRankCol[];
  wings: ForceRankWingBlock[];
  forces: ForceRankForceRow[];
  officerHeld: number;
  officerTotal: number;
  grandTotal: number;
};

function forceTitleBn(
  force: string,
  overrides?: Record<string, string>,
): string {
  return PAPER_FORCE_BN[force] ?? forceLabelBn(force, overrides);
}

function paperForceList(): string[] {
  const live = listForces().length ? listForces() : [...FORCES];
  return PAPER_FORCES.map(
    (paper) =>
      live.find((force) => force.toLowerCase() === paper.toLowerCase()) ?? paper,
  );
}

function ranksForRab(force: string, colId: string): string[] {
  const rab =
    FORCE_RANK_RANKS.find((col) => col.id === colId)?.rab ?? colId;
  return DEFAULT_EQUIV[force]?.[rab] ?? [];
}

function paperLabelBn(force: string, rank: string, custom?: string): string {
  if (custom?.trim()) return custom.trim();
  const key = rank.trim().toLowerCase();
  if (force === "BGB" && (key === "ck" || key === "cook")) return "বাবুর্চি";
  return PAPER_CELL_BN[key] ?? rank;
}

function civilSlotKey(rank: string): string {
  return rank.trim().toLowerCase().replace(/\s+/g, " ");
}

function civilLabelBn(rank: string): string {
  const key = civilSlotKey(rank);
  return CIVIL_LABEL_BN[key] ?? rank;
}

function placeCivilCells(
  ranks: string[],
  countFor: (rank: string) => number,
): ForceRankCell[] {
  const slots: ForceRankCell[] = CIVIL_SLOTS.map(() => ({
    rank: "",
    labelBn: "-",
    count: 0,
  }));
  const leftover: string[] = [];
  for (const rank of ranks) {
    const key = civilSlotKey(rank);
    const slot = CIVIL_SLOTS.findIndex((s) =>
      (s.keys as readonly string[]).includes(key),
    );
    if (slot >= 0 && !slots[slot].rank) {
      slots[slot] = {
        rank,
        labelBn: civilLabelBn(rank),
        count: countFor(rank),
      };
    } else {
      leftover.push(rank);
    }
  }
  for (const rank of leftover) {
    const empty = slots.findIndex((s) => !s.rank);
    if (empty < 0) break;
    slots[empty] = {
      rank,
      labelBn: civilLabelBn(rank),
      count: countFor(rank),
    };
  }
  return slots;
}

const RANK_ALIASES: Record<string, string> = {
  sergeant: "sgt",
  sgt: "sgt",
  corporal: "cpl",
  cpl: "cpl",
  "lance corporal": "l/cpl",
  "l/cpl": "l/cpl",
  "l cpl": "l/cpl",
  "leading seaman": "ls",
  ls: "ls",
  "able seaman": "ab",
  ab: "ab",
  "ordinary seaman": "od",
  od: "od",
  "leading aircraftman": "lac",
  lac: "lac",
  aircraftman: "ac",
  ac: "ac",
  inspector: "inspector",
  insp: "inspector",
  "subedar major": "sm",
  subedar: "sub",
  "naib subedar": "nb sub",
  "nb subedar": "nb sub",
  "lance naik": "lance naik",
  "l/naik": "lance naik",
  "circle adjutant": "cd",
  "circle ad": "cd",
  "platoon commander": "pc",
  "assistant platoon commander": "apc",
  cook: "ck",
  ck: "ck",
  messenger: "msg",
  "mess waiter": "mw",
};

function rankMatchKey(rank: string): string {
  const canon = canonicalForceServiceRank(rank)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return RANK_ALIASES[canon] ?? canon;
}

function rabColumnName(rank: string): string {
  const key = rank.trim().toLowerCase();
  if (!key) return "";
  return (
    FORCE_RANK_RANKS.find(
      (col) => col.rab.toLowerCase() === key || col.id === key,
    )?.rab ?? ""
  );
}

function resolveMemberRank(force: string, forceRank: string, rabRank: string): string {
  const service = rankMatchKey(forceRank);
  if (service && !rabColumnName(forceRank)) return service;
  const rab = rabColumnName(forceRank) || rabColumnName(rabRank) || "";
  const paper = rab ? DEFAULT_EQUIV[force]?.[rab] ?? [] : [];
  if (paper[0]) return rankMatchKey(paper[0]);
  const mapped = rab ? defaultForceRankForSrb(force, rab) : "";
  return rankMatchKey(mapped || service || rabRank);
}

function cellRankKeys(rank: string): string[] {
  const full = rankMatchKey(rank);
  const parts = rank
    .split("/")
    .map((part) => rankMatchKey(part))
    .filter(Boolean);
  return [...new Set([full, ...parts].filter(Boolean))];
}

function projectedTag(userId: string, date: string): DailyTag | "" {
  const direct = getAssignment(userId, date);
  if (direct) return direct.tag;
  if (isCarrySuppressed(userId, date)) return "";
  return findPriorTag(userId, date) ?? "";
}

function countTaggedByForceRank(
  date: string,
  snapshot?: ManpowerSnapshot,
  filterWing = "all",
): Map<string, number> {
  const state = getState();
  const tagFor =
    snapshot?.tagFor ?? ((userId: string) => projectedTag(userId, date));
  const sourceUsers = snapshot?.users ?? state.users;
  const buckets = new Map<string, number>();

  for (const user of sourceUsers) {
    if (!snapshot?.prefiltered) {
      if (!isManpowerCountableMember(user)) continue;
      if (user.status !== "1") continue;
      if (user.approval_status && user.approval_status !== "approved") continue;
      if (!canAssignOnDate(user, date)) continue;
    } else if (!isManpowerCountableMember(user)) {
      continue;
    }
    if (!memberMatchesWingFilter(user.wing, filterWing)) continue;
    const resolved = tagFor(user.id);
    const tag = (
      snapshot ? resolved : resolved || user.default_tag || ""
    ) as DailyTag | "";
    if (!tag) continue;
    const stored = snapshot
      ? state.users.find((row) => row.id === user.id)
      : undefined;
    const forceRaw = user.force || stored?.force || "";
    const forceName =
      forceRaw.trim()
        ? canonicalForceName(forceRaw, user.rank, user.member_type)
        : user.member_type === "civilian"
          ? "Civilian"
          : "";
    if (!forceName) continue;
    const rank = resolveMemberRank(
      forceName,
      user.force_rank || stored?.force_rank || "",
      user.rank || stored?.rank || "",
    );
    if (!rank) continue;
    const wingKey = (
      memberFormWing(user.wing) ||
      user.wing ||
      "—"
    ).trim();
    const key = `${wingKey.toLowerCase()}||${forceName.trim().toLowerCase()}||${rank}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return buckets;
}

function countForCell(
  buckets: Map<string, number>,
  force: string,
  rank: string,
  wing: string,
): number {
  if (!rank) return 0;
  const forceKey = force.trim().toLowerCase();
  const wingKey = wing.trim().toLowerCase();
  let total = 0;
  for (const rankKey of cellRankKeys(rank)) {
    total += buckets.get(`${wingKey}||${forceKey}||${rankKey}`) ?? 0;
  }
  return total;
}

function padCells(
  cells: ForceRankCell[],
  span: number,
  mergeSingle = false,
  mergeEmpty = true,
): ForceRankCell[] {
  const filled = cells.filter((cell) => cell.rank);
  if (mergeSingle && span > 1 && filled.length === 1) {
    return [{ ...filled[0], span }];
  }
  if (mergeSingle && mergeEmpty && span > 1 && filled.length === 0) {
    return [{ rank: "", labelBn: "-", count: 0, span }];
  }
  const out = cells.map((cell) => ({ ...cell, span: cell.span ?? 1 }));
  while (out.length < span) {
    out.push({ rank: "", labelBn: "-", count: 0, span: 1 });
  }
  return out;
}

function buildForceRowsForWing(
  tagged: Map<string, number>,
  rabOrder: { id: string; rab: string; labelBn: string }[],
  wing: string,
): ForceRankForceRow[] {
  const state = getState();
  return paperForceList().map((force) => {
    const cells: Record<string, ForceRankCell[]> = {};
    for (const col of rabOrder) {
      const ranks = ranksForRab(force, col.id);
      if (col.id === "civil") {
        cells[col.id] = placeCivilCells(ranks, (rank) =>
          countForCell(tagged, force, rank, wing),
        );
        continue;
      }
      cells[col.id] = ranks.map((rank) => {
        const custom =
          col.id === "si" ||
          col.id === "asi" ||
          col.id === "naik" ||
          col.id === "constable" ||
          col.id === "cook" ||
          col.id === "nce"
            ? undefined
            : state.force_rank_labels_bn?.[force]?.[rank]?.trim();
        return {
          rank,
          labelBn: paperLabelBn(force, rank, custom),
          count: countForCell(tagged, force, rank, wing),
        };
      });
    }
    return {
      force,
      labelBn: forceTitleBn(force, state.force_labels_bn),
      cells,
      total: 0,
    };
  });
}

export function forceRankCellKey(
  force: string,
  colId: string,
  index: number,
  rank: string,
): string {
  return `${force.trim().toLowerCase()}||${colId}||${index}||${rank.trim().toLowerCase()}`;
}

function savedForceRankCells(
  date: string,
  wing: string,
): Record<string, number> {
  const day = getState().force_rank_cells?.[date];
  if (!day) return {};
  const names = [wing, canonicalWingName(wing)];
  for (const name of names) {
    const hit = day[name];
    if (hit) return hit;
  }
  const want = canonicalWingName(wing).trim().toLowerCase();
  for (const [key, value] of Object.entries(day)) {
    if (canonicalWingName(key).trim().toLowerCase() === want) return value;
  }
  return {};
}

function applyManualForceRankCounts(
  date: string,
  wing: string,
  rows: ForceRankForceRow[],
  columns: ForceRankCol[],
) {
  const manual = isManualPresentWing(wing);
  const saved = savedForceRankCells(date, wing);
  for (const row of rows) {
    for (const col of columns) {
      if (!manual && col.id !== "dad") continue;
      const cells = row.cells[col.id] ?? [];
      row.cells[col.id] = cells.map((cell, index) => {
        const key = forceRankCellKey(row.force, col.id, index, cell.rank);
        if (!Object.prototype.hasOwnProperty.call(saved, key)) return cell;
        const count = saved[key];
        return Number.isFinite(count) ? { ...cell, count } : cell;
      });
    }
    row.total = Object.values(row.cells).reduce(
      (sum, list) => sum + list.reduce((n, cell) => n + (cell.count || 0), 0),
      0,
    );
  }
}

function finishForceRows(rows: ForceRankForceRow[], columns: ForceRankCol[]) {
  for (const row of rows) {
    for (const col of columns) {
      row.cells[col.id] = padCells(
        row.cells[col.id] ?? [],
        col.span,
        col.id === "dad" ||
          col.id === "si" ||
          col.id === "naik" ||
          col.id === "constable",
      );
    }
    row.total = Object.values(row.cells).reduce(
      (sum, list) => sum + list.reduce((n, cell) => n + (cell.count || 0), 0),
      0,
    );
  }
}

export function buildForceRankReport(
  date: string,
  snapshot?: ManpowerSnapshot,
  filterWing = "all",
): ForceRankReport {
  const state = getState();
  const tagged = countTaggedByForceRank(date, snapshot, filterWing);
  const rabOrder = FORCE_RANK_RANKS.map((col) => {
    const fromCatalog = state.ranks.find(
      (r) => r.toLowerCase() === col.rab.toLowerCase(),
    );
    return {
      ...col,
      rab: fromCatalog ?? col.rab,
      labelBn: col.labelBn,
    };
  });

  const official = listWingChildren(null);
  const foundWings = new Set<string>();
  for (const key of tagged.keys()) {
    const wing = key.split("||")[0] ?? "";
    if (wing) foundWings.add(wing);
  }
  const matchedOfficial = official.filter((wing) =>
    memberMatchesWingFilter(wing, filterWing),
  );
  const extraFound = [...foundWings].filter(
    (wing) =>
      memberMatchesWingFilter(wing, filterWing) &&
      !official.some((row) => row.toLowerCase() === wing),
  );
  const uniqueWings = [
    ...new Set(
      (matchedOfficial.length ? matchedOfficial : extraFound).concat(
        matchedOfficial.length ? extraFound : [],
      ),
    ),
  ];
  if (!uniqueWings.length) {
    uniqueWings.push(
      filterWing && filterWing !== "all" ? filterWing : official[0] || "—",
    );
  }

  const draftWings = uniqueWings.map((wing) => ({
    wing,
    rows: buildForceRowsForWing(tagged, rabOrder, wing),
  }));

  const columns: ForceRankCol[] = rabOrder.map((col) => {
    if (col.id === "civil") {
      return { id: col.id, rab: col.rab, labelBn: col.labelBn, span: CIVIL_SLOTS.length };
    }
    if (col.id === "cook" || col.id === "nce") {
      return { id: col.id, rab: col.rab, labelBn: col.labelBn, span: 1 };
    }
    if (col.id === "si" || col.id === "naik" || col.id === "constable") {
      return { id: col.id, rab: col.rab, labelBn: col.labelBn, span: 2 };
    }
    let span = 1;
    for (const block of draftWings) {
      for (const row of block.rows) {
        span = Math.max(span, row.cells[col.id]?.length || 1);
      }
    }
    return { id: col.id, rab: col.rab, labelBn: col.labelBn, span };
  });

  const wings: ForceRankWingBlock[] = draftWings.map((block) => {
    finishForceRows(block.rows, columns);
    applyManualForceRankCounts(date, block.wing, block.rows, columns);
    return {
      wing: block.wing,
      labelBn: manpowerPaperWingLabel(block.wing, state.wing_labels_bn),
      forces: block.rows,
      total: block.rows.reduce((sum, row) => sum + row.total, 0),
    };
  });

  const officerHeld = state.force_rank_officer?.[date]?.held ?? 0;
  const officerTotal = state.force_rank_officer?.[date]?.total ?? 0;
  const forceSum = wings.reduce((sum, row) => sum + row.total, 0);
  const forces = wings[0]?.forces ?? [];

  return {
    date,
    orgBn: "স্পেশাল রেসপন্স ব্যাটালিয়ন (এসআরবি) সদর দপ্তর",
    titleBn: "দৈনিক শক্তি প্রতিবেদন",
    filterWing: filterWing || "all",
    columns,
    wings,
    forces,
    officerHeld,
    officerTotal,
    grandTotal: forceSum + (officerTotal || officerHeld),
  };
}

export function parseManpowerWingFilter(raw: string | null | undefined): string {
  const wing = raw?.trim() ?? "";
  return !wing || wing.toLowerCase() === "all" ? "all" : wing;
}

export function forceRankCells(
  row: ForceRankForceRow,
  col: ForceRankCol,
): ForceRankCell[] {
  return padCells(
    row.cells[col.id] ?? [],
    col.span,
    col.id === "dad" ||
      col.id === "si" ||
      col.id === "naik" ||
      col.id === "constable",
  );
}
