/** Demo Pritibhoj feast manpower — mirrors HQ farewell sheet layout. */

import type { DailyTag, PritibhojEvent, PritibhojRow } from "@/lib/types";

export type { PritibhojEvent, PritibhojRow };

/** Printed-sheet wing row: Bengali label + catalog wings used for cockpit counts. */
export type PritibhojWingDef = {
  label: string;
  wings: readonly string[];
  /** Older printed or catalog spellings that map onto this row. */
  aliases?: readonly string[];
  /** When set, counts members with this cockpit tag (any wing). */
  tag?: DailyTag;
};

/** Main sheet — exact labels from the HQ Pritibhoj form. */
export const PRITIBHOJ_MAIN_WING_DEFS: readonly PritibhojWingDef[] = [
  {
    label: "অপারেশনস্ উইং",
    wings: ["Ops Wg"],
    aliases: ["অপারেশনস উইং", "Operations Wing"],
  },
  {
    label: "ইন্টেলিজেন্স উইং",
    wings: ["Int Wg"],
    aliases: ["Intelligence Wing"],
  },
  {
    label: "যোগাযোগ উইং",
    wings: ["Comm & MIS Wg"],
    aliases: ["Communication & MIS Wing"],
  },
  {
    label: "লিঃ এন্ড মিডিঃ উইং",
    wings: ["L & M Wg"],
    aliases: ["এল এন্ড এম উইং", "Legal & Media Wing"],
  },
  {
    label: "ট্রেনিং উইং",
    wings: ["Trg Wg", "Training School", "RFTS"],
    aliases: ["Training & Orientation Wing"],
  },
  {
    label: "তদন্ত উইং",
    wings: ["Inv Wg"],
    aliases: ["Investigation & Forensic Wing"],
  },
  {
    label: "আরএন্ডডি সেল",
    wings: ["R & D Cell"],
    aliases: ["আর এন্ড ডি সেল"],
  },
  { label: "এয়ার উইং", wings: ["Air Wg"], aliases: ["Air Wing"] },
  {
    label: "প্রশাসন ও অর্থ উইং",
    wings: ["Admin"],
    aliases: ["Admin (New)", "Admin (Old)", "Administration & Finance Wing"],
  },
  {
    label: "সিএমএইচ ভর্তি রোগী",
    wings: [],
    tag: "CMH",
    aliases: ["সিএমএইচ রোগী"],
  },
];

/** Admin & Finance sheet — exact labels from the HQ Pritibhoj form. */
export const PRITIBHOJ_ADMIN_WING_DEFS: readonly PritibhojWingDef[] = [
  { label: "ডিজি দপ্তর", wings: ["DG Office"] },
  { label: "এডিজি (অপস) দপ্তর", wings: ["ADG (Ops) Office"] },
  { label: "এডিজি (এ্যাডমিন) দপ্তর", wings: ["ADG (Admin) Office"] },
  { label: "পরিচালক এ্যাডমিন দপ্তর", wings: ["Director (Admin) Office"] },
  { label: "জেনারেল শাখা", wings: ["Gen Br"] },
  {
    label: "পার্সোনাল শাখা",
    wings: ["Per Br"],
    aliases: ["পার্সোনেল শাখা"],
  },
  { label: "রেকর্ড শাখা", wings: ["Rec Br", "Record Branch"] },
  {
    label: "সরবরাহ শাখা",
    wings: ["Sup Br"],
    aliases: ["সাপ্লাই শাখা"],
  },
  {
    label: "উন্নয়ন শাখা",
    wings: ["Dev Br"],
    aliases: ["ডেভেলপমেন্ট শাখা"],
  },
  {
    label: "প্রকল্প শাখা",
    wings: ["Proj Br"],
    aliases: ["প্রজেক্ট শাখা"],
  },
  { label: "ওয়ার্কশপ শাখা", wings: ["Wksp Br"] },
  {
    label: "অর্থ শাখা",
    wings: ["Fin Br"],
    aliases: ["ফিন্যান্স শাখা"],
  },
  {
    label: "প্রকিউরমেন্ট",
    wings: ["Proc Br"],
    aliases: ["প্রকিউরমেন্ট শাখা"],
  },
  {
    label: "চিকিৎসা শাখা",
    wings: ["Med Br"],
    aliases: ["মেডিকেল শাখা"],
  },
  {
    label: "নিরাপত্তা শাখা",
    wings: ["Security Branch", "Security Branch - IEC Cell"],
  },
  {
    label: "সদর দপ্তর শাখা",
    wings: ["HQ Br", "Headquarters Branch", "Headquarters Office"],
    aliases: ["এইচকিউ শাখা"],
  },
  { label: "এ্যাডমিন এমটি", wings: ["MT Br", "MT Branch"] },
  { label: "নতুন সদস্য ও সংযুক্ত", wings: ["New / Temporary Attached"] },
];

const ALL_WING_DEFS = [
  ...PRITIBHOJ_MAIN_WING_DEFS,
  ...PRITIBHOJ_ADMIN_WING_DEFS,
];

function wingKeys(def: PritibhojWingDef): string[] {
  return [def.label, ...def.wings, ...(def.aliases ?? [])];
}

export function pritibhojWingDef(label: string): PritibhojWingDef | undefined {
  const key = label.trim();
  return ALL_WING_DEFS.find((row) => wingKeys(row).includes(key));
}

/** Catalog wing keys (plus the printed label) that count for this sheet row. */
export function pritibhojLookupWings(label: string): string[] {
  const key = label.trim();
  const def = pritibhojWingDef(key);
  if (!def) return key ? [key] : [];
  return wingKeys(def);
}

export function lockPritibhojRows(
  defs: readonly PritibhojWingDef[],
  existing: PritibhojRow[] = [],
): PritibhojRow[] {
  return defs.map((def) => {
    const keys = new Set(wingKeys(def));
    const found = existing.find((row) => keys.has(row.wing.trim()));
    return finalizePritibhojRow({
      ...(found ?? emptyPritibhojRow(def.label)),
      wing: def.label,
    });
  });
}

export function lockPritibhojSheets<
  T extends { main_rows: PritibhojRow[]; admin_rows: PritibhojRow[] },
>(value: T): T {
  return {
    ...value,
    main_rows: lockPritibhojRows(PRITIBHOJ_MAIN_WING_DEFS, value.main_rows),
    admin_rows: lockPritibhojRows(PRITIBHOJ_ADMIN_WING_DEFS, value.admin_rows),
  };
}

/** Main wings — demo from ADG Admin farewell sheet (06 Jul 2023). */
export const PRITIBHOJ_MAIN_ROWS: PritibhojRow[] = [
  {
    wing: "অপারেশনস্ উইং",
    officer: 7,
    dad: 16,
    azadHall: 12,
    distribution: 4,
    others: 205,
    civilian: 11,
    nonMuslim: 6,
    total: 222,
    azadHallDist: 45,
    distribution2: 177,
    totalDistribution: 181,
  },
  {
    wing: "ইন্টেলিজেন্স উইং",
    officer: 13,
    dad: 11,
    azadHall: 5,
    distribution: 6,
    others: 369,
    civilian: 2,
    nonMuslim: 0,
    total: 371,
    azadHallDist: 45,
    distribution2: 326,
    totalDistribution: 332,
  },
  {
    wing: "যোগাযোগ উইং",
    officer: 3,
    dad: 8,
    azadHall: 3,
    distribution: 5,
    others: 137,
    civilian: 2,
    nonMuslim: 5,
    total: 144,
    azadHallDist: 25,
    distribution2: 119,
    totalDistribution: 124,
  },
  {
    wing: "লিঃ এন্ড মিডিঃ উইং",
    officer: 7,
    dad: 8,
    azadHall: 1,
    distribution: 4,
    others: 71,
    civilian: 0,
    nonMuslim: 1,
    total: 79,
    azadHallDist: 15,
    distribution2: 64,
    totalDistribution: 68,
  },
  {
    wing: "ট্রেনিং উইং",
    officer: 2,
    dad: 4,
    azadHall: 0,
    distribution: 2,
    others: 29,
    civilian: 1,
    nonMuslim: 0,
    total: 32,
    azadHallDist: 8,
    distribution2: 24,
    totalDistribution: 26,
  },
  {
    wing: "তদন্ত উইং",
    officer: 5,
    dad: 4,
    azadHall: 1,
    distribution: 3,
    others: 51,
    civilian: 0,
    nonMuslim: 0,
    total: 56,
    azadHallDist: 10,
    distribution2: 46,
    totalDistribution: 49,
  },
  {
    wing: "আরএন্ডডি সেল",
    officer: 2,
    dad: 3,
    azadHall: 0,
    distribution: 2,
    others: 22,
    civilian: 1,
    nonMuslim: 0,
    total: 25,
    azadHallDist: 5,
    distribution2: 20,
    totalDistribution: 22,
  },
  {
    wing: "এয়ার উইং",
    officer: 6,
    dad: 3,
    azadHall: 2,
    distribution: 3,
    others: 51,
    civilian: 1,
    nonMuslim: 1,
    total: 58,
    azadHallDist: 12,
    distribution2: 46,
    totalDistribution: 49,
  },
  {
    wing: "প্রশাসন ও অর্থ উইং",
    officer: 17,
    dad: 34,
    azadHall: 10,
    distribution: 15,
    others: 723,
    civilian: 16,
    nonMuslim: 24,
    total: 773,
    azadHallDist: 75,
    distribution2: 698,
    totalDistribution: 713,
  },
  {
    wing: "সিএমএইচ ভর্তি রোগী",
    officer: 0,
    dad: 0,
    azadHall: 0,
    distribution: 0,
    others: 0,
    civilian: 0,
    nonMuslim: 0,
    total: 0,
    azadHallDist: 0,
    distribution2: 0,
    totalDistribution: 0,
  },
];

/** Admin & Finance wing branches — demo breakdown. */
export const PRITIBHOJ_ADMIN_ROWS: PritibhojRow[] = [
  {
    wing: "ডিজি দপ্তর",
    officer: 2,
    dad: 1,
    azadHall: 0,
    distribution: 1,
    others: 47,
    civilian: 1,
    nonMuslim: 2,
    total: 50,
    azadHallDist: 3,
    distribution2: 47,
    totalDistribution: 48,
  },
  {
    wing: "এডিজি (অপস) দপ্তর",
    officer: 1,
    dad: 1,
    azadHall: 0,
    distribution: 1,
    others: 11,
    civilian: 3,
    nonMuslim: 0,
    total: 14,
    azadHallDist: 1,
    distribution2: 13,
    totalDistribution: 14,
  },
  {
    wing: "এডিজি (এ্যাডমিন) দপ্তর",
    officer: 1,
    dad: 0,
    azadHall: 0,
    distribution: 0,
    others: 11,
    civilian: 0,
    nonMuslim: 0,
    total: 11,
    azadHallDist: 2,
    distribution2: 9,
    totalDistribution: 9,
  },
  {
    wing: "জেনারেল শাখা",
    officer: 1,
    dad: 2,
    azadHall: 1,
    distribution: 1,
    others: 20,
    civilian: 1,
    nonMuslim: 1,
    total: 22,
    azadHallDist: 4,
    distribution2: 18,
    totalDistribution: 19,
  },
  {
    wing: "পার্সোনেল শাখা",
    officer: 1,
    dad: 2,
    azadHall: 1,
    distribution: 2,
    others: 35,
    civilian: 2,
    nonMuslim: 2,
    total: 39,
    azadHallDist: 6,
    distribution2: 33,
    totalDistribution: 35,
  },
  {
    wing: "সাপ্লাই শাখা",
    officer: 1,
    dad: 1,
    azadHall: 0,
    distribution: 1,
    others: 13,
    civilian: 1,
    nonMuslim: 0,
    total: 15,
    azadHallDist: 2,
    distribution2: 13,
    totalDistribution: 14,
  },
  {
    wing: "ফিন্যান্স শাখা",
    officer: 2,
    dad: 1,
    azadHall: 1,
    distribution: 1,
    others: 17,
    civilian: 1,
    nonMuslim: 1,
    total: 20,
    azadHallDist: 3,
    distribution2: 17,
    totalDistribution: 18,
  },
  {
    wing: "এইচকিউ শাখা",
    officer: 2,
    dad: 1,
    azadHall: 1,
    distribution: 1,
    others: 19,
    civilian: 1,
    nonMuslim: 1,
    total: 22,
    azadHallDist: 4,
    distribution2: 18,
    totalDistribution: 19,
  },
  {
    wing: "এ্যাডমিন এমটি",
    officer: 0,
    dad: 0,
    azadHall: 0,
    distribution: 1,
    others: 30,
    civilian: 1,
    nonMuslim: 1,
    total: 32,
    azadHallDist: 5,
    distribution2: 27,
    totalDistribution: 28,
  },
  {
    wing: "মেডিকেল শাখা",
    officer: 1,
    dad: 3,
    azadHall: 1,
    distribution: 1,
    others: 55,
    civilian: 1,
    nonMuslim: 2,
    total: 60,
    azadHallDist: 8,
    distribution2: 52,
    totalDistribution: 53,
  },
  {
    wing: "রেকর্ড শাখা",
    officer: 1,
    dad: 4,
    azadHall: 1,
    distribution: 1,
    others: 80,
    civilian: 1,
    nonMuslim: 3,
    total: 86,
    azadHallDist: 10,
    distribution2: 76,
    totalDistribution: 77,
  },
  {
    wing: "প্রকিউরমেন্ট শাখা",
    officer: 1,
    dad: 3,
    azadHall: 1,
    distribution: 1,
    others: 45,
    civilian: 1,
    nonMuslim: 2,
    total: 50,
    azadHallDist: 6,
    distribution2: 44,
    totalDistribution: 45,
  },
  {
    wing: "বাজেট শাখা",
    officer: 1,
    dad: 4,
    azadHall: 1,
    distribution: 1,
    others: 70,
    civilian: 1,
    nonMuslim: 3,
    total: 76,
    azadHallDist: 8,
    distribution2: 68,
    totalDistribution: 69,
  },
  {
    wing: "ডেভেলপমেন্ট শাখা",
    officer: 1,
    dad: 3,
    azadHall: 0,
    distribution: 1,
    others: 40,
    civilian: 0,
    nonMuslim: 1,
    total: 43,
    azadHallDist: 5,
    distribution2: 38,
    totalDistribution: 39,
  },
  {
    wing: "ওয়ার্কশপ শাখা",
    officer: 0,
    dad: 2,
    azadHall: 0,
    distribution: 0,
    others: 35,
    civilian: 0,
    nonMuslim: 1,
    total: 37,
    azadHallDist: 3,
    distribution2: 34,
    totalDistribution: 34,
  },
  {
    wing: "রেশন অফিস",
    officer: 0,
    dad: 2,
    azadHall: 1,
    distribution: 0,
    others: 38,
    civilian: 0,
    nonMuslim: 2,
    total: 41,
    azadHallDist: 4,
    distribution2: 37,
    totalDistribution: 37,
  },
  {
    wing: "প্রজেক্ট শাখা",
    officer: 1,
    dad: 4,
    azadHall: 1,
    distribution: 1,
    others: 87,
    civilian: 1,
    nonMuslim: 2,
    total: 93,
    azadHallDist: 1,
    distribution2: 92,
    totalDistribution: 93,
  },
];

export const PRITIBHOJ_DEMO_META = {
  titleBn:
    "এডিজি এ্যাডমিন (প্রশাসন) এর বিদায়ী উপলক্ষে প্রীতিভোজের পরিসংখ্যান",
  orgBn: "স্পেশাল রেসপন্স ব্যাটালিয়ন (এসআরবি) সদর দপ্তর",
  dateISO: "2023-07-06",
  adminTitleBn: "প্রশাসন ও অর্থ উইং",
  grandTotalManpower: 1913,
};

function asFiniteNumber(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function firstNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return asFiniteNumber(row[key]);
  }
  return 0;
}

/** Accept camelCase or snake_case rows from the API / JSONB store. */
export function normalizePritibhojRow(raw: unknown): PritibhojRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const wing = String(row.wing ?? "").trim();
  if (!wing) return null;
  return finalizePritibhojRow({
    wing,
    officer: firstNumber(row, "officer"),
    dad: firstNumber(row, "dad"),
    azadHall: firstNumber(row, "azadHall", "azad_hall"),
    distribution: firstNumber(row, "distribution"),
    others: firstNumber(row, "others"),
    civilian: firstNumber(row, "civilian"),
    nonMuslim: firstNumber(row, "nonMuslim", "non_muslim"),
    total: firstNumber(row, "total"),
    azadHallDist: firstNumber(row, "azadHallDist", "azad_hall_dist"),
    distribution2: firstNumber(row, "distribution2", "distribution_2"),
    totalDistribution: firstNumber(
      row,
      "totalDistribution",
      "total_distribution",
    ),
  });
}

export function normalizePritibhojEvent(raw: unknown): PritibhojEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as Record<string, unknown>;
  const id = String(event.id ?? "").trim();
  if (!id) return null;
  const date = String(event.date ?? "").trim().slice(0, 10);
  return lockPritibhojSheets({
    id,
    title: String(event.title ?? "").trim() || "Pritibhoj",
    occasion: String(event.occasion ?? "").trim(),
    date,
    org: String(event.org ?? "").trim(),
    created_at: String(event.created_at ?? ""),
    main_rows: Array.isArray(event.main_rows)
      ? event.main_rows
          .map(normalizePritibhojRow)
          .filter((row): row is PritibhojRow => row !== null)
      : [],
    admin_rows: Array.isArray(event.admin_rows)
      ? event.admin_rows
          .map(normalizePritibhojRow)
          .filter((row): row is PritibhojRow => row !== null)
      : [],
  });
}

export function emptyPritibhojRow(wing: string): PritibhojRow {
  return {
    wing,
    officer: 0,
    dad: 0,
    azadHall: 0,
    distribution: 0,
    others: 0,
    civilian: 0,
    nonMuslim: 0,
    total: 0,
    azadHallDist: 0,
    distribution2: 0,
    totalDistribution: 0,
  };
}

export function finalizePritibhojRow(row: PritibhojRow): PritibhojRow {
  const distribution = Math.max(0, row.dad - row.azadHall);
  const total = row.others + row.civilian + row.nonMuslim;
  const distribution2 = Math.max(0, total - row.azadHallDist);
  return {
    ...row,
    distribution,
    total,
    distribution2,
    totalDistribution: distribution + distribution2,
  };
}

export function demoPritibhojEvent(): PritibhojEvent {
  return lockPritibhojSheets({
    id: "pb_demo_20230706",
    title: PRITIBHOJ_DEMO_META.titleBn,
    occasion: PRITIBHOJ_DEMO_META.titleBn,
    date: PRITIBHOJ_DEMO_META.dateISO,
    org: PRITIBHOJ_DEMO_META.orgBn,
    created_at: "2023-07-06T00:00:00.000Z",
    main_rows: PRITIBHOJ_MAIN_ROWS,
    admin_rows: PRITIBHOJ_ADMIN_ROWS,
  });
}

function cloneDemoSheets(event: PritibhojEvent): Pick<PritibhojEvent, "main_rows" | "admin_rows"> {
  return {
    main_rows: event.main_rows.map((row) => ({ ...row })),
    admin_rows: event.admin_rows.map((row) => ({ ...row })),
  };
}

/** Sample feast sheets shown when the list is empty. */
export function demoPritibhojEvents(): PritibhojEvent[] {
  const farewell = demoPritibhojEvent();
  return [
    farewell,
    lockPritibhojSheets({
      id: "pb_demo_20251216",
      title: "বিজয় দিবস উপলক্ষে প্রীতিভোজের পরিসংখ্যান",
      occasion: "বিজয় দিবস",
      date: "2025-12-16",
      org: PRITIBHOJ_DEMO_META.orgBn,
      created_at: "2025-12-16T00:00:00.000Z",
      ...cloneDemoSheets(farewell),
    }),
    lockPritibhojSheets({
      id: "pb_demo_20260326",
      title: "স্বাধীনতা দিবস উপলক্ষে প্রীতিভোজের পরিসংখ্যান",
      occasion: "স্বাধীনতা দিবস",
      date: "2026-03-26",
      org: PRITIBHOJ_DEMO_META.orgBn,
      created_at: "2026-03-26T00:00:00.000Z",
      ...cloneDemoSheets(farewell),
    }),
  ];
}

export function sumPritibhojRows(rows: PritibhojRow[]): PritibhojRow {
  return rows.reduce(
    (acc, r) => ({
      wing: "মোট",
      officer: acc.officer + r.officer,
      dad: acc.dad + r.dad,
      azadHall: acc.azadHall + r.azadHall,
      distribution: acc.distribution + r.distribution,
      others: acc.others + r.others,
      civilian: acc.civilian + r.civilian,
      nonMuslim: acc.nonMuslim + r.nonMuslim,
      total: acc.total + r.total,
      azadHallDist: acc.azadHallDist + r.azadHallDist,
      distribution2: acc.distribution2 + r.distribution2,
      totalDistribution: acc.totalDistribution + r.totalDistribution,
    }),
    {
      wing: "মোট",
      officer: 0,
      dad: 0,
      azadHall: 0,
      distribution: 0,
      others: 0,
      civilian: 0,
      nonMuslim: 0,
      total: 0,
      azadHallDist: 0,
      distribution2: 0,
      totalDistribution: 0,
    },
  );
}
