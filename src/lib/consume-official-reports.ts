import {
  ADMIN_SUB_WINGS,
  CONSUME_REPORT_META,
  HQ_SUB_WINGS,
  wingOfficialName,
} from "@/lib/constants";
import { countedDaysInMonth, formatMonthDash } from "@/lib/date";
import { buildConsumeMonth } from "@/lib/reports";
import { compareUsers } from "@/lib/store/users";
import type { DailyTag, MemberType, User } from "@/lib/types";

export const CONSUME_OFFICIAL_SHEETS = [
  "wings",
  "fr",
  "cd",
  "leave",
] as const;

export type ConsumeOfficialSheet = (typeof CONSUME_OFFICIAL_SHEETS)[number];

export type OfficialConsumeRow = {
  id: string;
  sl: number;
  label: string;
  pageNo: string;
  manpower: number;
  /** Calendar days in the report month through today (e.g. 20 on 20 Sep). */
  days?: number;
  tagDays: Partial<Record<DailyTag, number>>;
  totalDays: number;
};

export type OfficialConsumeReport = {
  month: string;
  monthLabelBn: string;
  title: string;
  rows: OfficialConsumeRow[];
  totals: OfficialConsumeRow;
};

export type OfficialTableKind = "consume" | "consume-pages" | "tag" | "leave";

export type OfficialConsumeTable = {
  title: string;
  lines: string[];
  kind: OfficialTableKind;
  showPageNo: boolean;
  showManpower: boolean;
  remarks: boolean;
  tagLabel?: string;
  rows: OfficialConsumeRow[];
  totals: OfficialConsumeRow;
};

export type OfficialConsumePage = {
  id: string;
  tables: OfficialConsumeTable[];
};

export type OfficialConsumePack = {
  month: string;
  monthLabelBn: string;
  sheet: ConsumeOfficialSheet;
  pages: OfficialConsumePage[];
  summary: OfficialConsumeReport;
};

const REGISTER_PAGE_SIZE = 3;
const EMPTY_TEMPLATE_PAGES = 8;

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBnDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** `১২৩` / `123` → ASCII digits only. */
export function fromBnDigits(value: string) {
  return value.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

export function officialMsDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.MS ?? 0;
}

/** Consume ledger FR column — FR + MFR from Daily RR. */
export function officialFrDays(tagDays: Partial<Record<DailyTag, number>>) {
  return (tagDays.FR ?? 0) + (tagDays.MFR ?? 0);
}

export function officialWitDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.WIT ?? 0;
}

export function officialMedDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.MED ?? 0;
}

export function officialBghDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.BGH ?? 0;
}

export function officialLnkDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.LNK ?? 0;
}

export function officialWrDays(tagDays: Partial<Record<DailyTag, number>>) {
  return tagDays.WR ?? 0;
}

/** Visible monthly-consume columns from Daily RR / consume ledger. */
export function officialConsumeTotal(tagDays: Partial<Record<DailyTag, number>>) {
  return (
    officialMsDays(tagDays) +
    officialFrDays(tagDays) +
    (tagDays.CL ?? 0) +
    (tagDays.PL ?? 0) +
    (tagDays.CD ?? 0) +
    (tagDays.TRG ?? 0) +
    officialWitDays(tagDays) +
    officialMedDays(tagDays) +
    officialBghDays(tagDays) +
    officialLnkDays(tagDays) +
    officialWrDays(tagDays)
  );
}

/** @deprecated Use officialWitDays — kept for older leave sheets. */
export function officialLeaveDays(tagDays: Partial<Record<DailyTag, number>>) {
  return officialWitDays(tagDays);
}

/** @deprecated Use officialMedDays. */
export function officialHospitalDays(
  tagDays: Partial<Record<DailyTag, number>>,
) {
  return officialMedDays(tagDays);
}

function sumTags(
  tagDays: Partial<Record<DailyTag, number>>,
  tags: readonly DailyTag[],
) {
  return tags.reduce((s, tag) => s + (tagDays[tag] ?? 0), 0);
}

function addTagDays(
  into: Partial<Record<DailyTag, number>>,
  from: Partial<Record<DailyTag, number>>,
) {
  for (const [tag, days] of Object.entries(from) as [DailyTag, number][]) {
    if (!days) continue;
    into[tag] = (into[tag] ?? 0) + days;
  }
}

function totalOf(tagDays: Partial<Record<DailyTag, number>>) {
  return officialConsumeTotal(tagDays);
}

const IEC_WINGS = new Set(["security branch - iec cell"]);
const ATTACHED_WINGS = new Set([
  "new / temporary attached",
  "new temp att",
]);

const WING_ALIASES: Record<string, string[]> = {
  admin: [
    "admin",
    "admin (new)",
    "admin (old)",
    "administration & finance wing",
    "প্রশাসন ও অর্থ উইং",
    ...ADMIN_SUB_WINGS.filter((w) => !IEC_WINGS.has(w.toLowerCase())).map(
      (w) => w.toLowerCase(),
    ),
    ...HQ_SUB_WINGS.filter((w) => !ATTACHED_WINGS.has(w.toLowerCase())).map(
      (w) => w.toLowerCase(),
    ),
  ],
  ops: ["ops wg", "operations wing", "অপস উইং", "অপারেশনস্ উইং"],
  int: ["int wg", "intelligence wing", "ইন্টেলিজেন্স উইং", "ইন্ট উইং"],
  inv: ["inv wg", "investigation & forensic wing", "তদন্ত উইং"],
  trg: [
    "trg wg",
    "training & orientation wing",
    "training school",
    "rfts",
    "ট্রেনিং উইং",
    "ট্রেনিং স্কুল",
    "আরএফটিএস",
  ],
  iec: ["security branch - iec cell", "আইইসি সেল", "আইসি সেল"],
  lm: ["l & m wg", "legal & media wing", "লিঃ এন্ড মিডিঃ উইং", "এল এন্ড এম উইং"],
  comm: ["comm & mis wg", "communication & mis wing", "যোগাযোগ উইং"],
  rd: ["r & d cell", "আরএন্ডডি সেল", "আর এন্ড ডি সেল"],
  air: ["air wg", "air wing", "এয়ার উইং"],
};

const WING_DEFS: { id: string; label: string }[] = [
  { id: "admin", label: "Admin & Finance Wing" },
  { id: "ops", label: "Operations Wing" },
  { id: "int", label: "Intelligence Wing" },
  { id: "inv", label: "Investigation & Forensic Wing" },
  { id: "trg", label: "Training & Orientation Wing" },
  { id: "iec", label: "IEC Cell" },
  { id: "lm", label: "Legal & Media Wing" },
  { id: "comm", label: "Communication & MIS Wing" },
  { id: "rd", label: "Research & Development Cell" },
  { id: "air", label: "Air Wing" },
  { id: "new", label: "New members" },
  { id: "attached", label: "Attached members" },
];

const WING_LOOKUP = new Map<string, string>();
for (const [id, aliases] of Object.entries(WING_ALIASES)) {
  for (const alias of aliases) WING_LOOKUP.set(alias, id);
}

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const ATTACHED_TYPES = new Set<MemberType>(["attached", "guest"]);

function officialRowId(user: User): string {
  if (user.member_type === "new") return "new";
  if (ATTACHED_TYPES.has(user.member_type) || ATTACHED_WINGS.has(norm(user.wing))) {
    return "attached";
  }
  return WING_LOOKUP.get(norm(user.wing)) ?? "admin";
}

function emptyBucket() {
  return { userIds: new Set<string>(), tagDays: {} as Partial<Record<DailyTag, number>> };
}

function bucketsFromMonth(month: string) {
  const consume = buildConsumeMonth(month);
  const buckets = new Map(WING_DEFS.map((d) => [d.id, emptyBucket()]));
  for (const row of consume.rows) {
    const id = officialRowId(row.user);
    const cur = buckets.get(id) ?? emptyBucket();
    cur.userIds.add(row.user.id);
    addTagDays(cur.tagDays, row.tagDays);
    buckets.set(id, cur);
  }
  return buckets;
}

function rowFromBucket(
  def: { id: string; label: string },
  sl: number,
  bucket: ReturnType<typeof emptyBucket>,
  pageNo = "",
): OfficialConsumeRow {
  return {
    id: def.id,
    sl,
    label: def.label,
    pageNo,
    manpower: bucket.userIds.size,
    tagDays: bucket.tagDays,
    totalDays: totalOf(bucket.tagDays),
  };
}

function totalsRow(rows: OfficialConsumeRow[], label = "Total"): OfficialConsumeRow {
  const tagDays: Partial<Record<DailyTag, number>> = {};
  let manpower = 0;
  let totalDays = 0;
  for (const row of rows) {
    manpower += row.manpower;
    totalDays += row.totalDays;
    addTagDays(tagDays, row.tagDays);
  }
  return {
    id: "total",
    sl: 0,
    label,
    pageNo: "",
    manpower,
    tagDays,
    totalDays,
  };
}

export function officialMonthLabelBn(month: string) {
  return formatMonthDash(month, "bn-BD");
}

export function parseOfficialSheet(
  raw: string | null,
): ConsumeOfficialSheet {
  if (raw === "camp") return "wings";
  if (raw && (CONSUME_OFFICIAL_SHEETS as readonly string[]).includes(raw)) {
    return raw as ConsumeOfficialSheet;
  }
  return "wings";
}

export function officialSheetOrientation(
  _sheet?: ConsumeOfficialSheet,
): "portrait" | "landscape" {
  return "portrait";
}

function membersByWing(month: string) {
  const consume = buildConsumeMonth(month);
  const byWing = new Map<string, typeof consume.rows>();
  for (const def of WING_DEFS) byWing.set(def.id, []);
  for (const row of consume.rows) {
    const id = officialRowId(row.user);
    const list = byWing.get(id) ?? [];
    list.push(row);
    byWing.set(id, list);
  }
  for (const list of byWing.values()) {
    list.sort((a, b) => compareUsers(a.user, b.user));
  }
  return byWing;
}

function registerPages(memberCount: number) {
  if (!memberCount) return 0;
  return Math.ceil(memberCount / REGISTER_PAGE_SIZE);
}

export function pageRangeBn(pages: number) {
  return pageRangeEn(pages);
}

export function pageRangeEn(pages: number) {
  if (!pages) return "-";
  if (pages === 1) return "1";
  return `1 to ${pages}`;
}

function orgLine() {
  return `${CONSUME_REPORT_META.orgName}, ${CONSUME_REPORT_META.station}`;
}

function monthLabelEn(month: string) {
  return formatMonthDash(month);
}

export function buildOfficialWingConsume(month: string): OfficialConsumeReport {
  const buckets = bucketsFromMonth(month);
  const byWing = membersByWing(month);
  const rows = WING_DEFS.map((def, i) =>
    rowFromBucket(
      def,
      i + 1,
      buckets.get(def.id) ?? emptyBucket(),
      pageRangeEn(registerPages(byWing.get(def.id)?.length ?? 0)),
    ),
  );
  return {
    month,
    monthLabelBn: officialMonthLabelBn(month),
    title: `Consume summary by wing — ${monthLabelEn(month)}`,
    rows,
    totals: totalsRow(rows),
  };
}

export function buildOfficialCampConsume(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  const hq = wings.rows.filter((r) => r.id === "admin");
  const ashkona = wings.rows.filter((r) => r.id !== "admin");
  const rows: OfficialConsumeRow[] = [
    { ...totalsRow(hq, "SRB HQ Camp"), id: "hq", sl: 1, pageNo: "" },
    { ...totalsRow(ashkona, "Ashkona Camp"), id: "ashkona", sl: 2, pageNo: "" },
  ];
  return {
    month,
    monthLabelBn: officialMonthLabelBn(month),
    title: `Monthly consume summary — ${monthLabelEn(month)}`,
    rows,
    totals: { ...totalsRow(rows), sl: 3, pageNo: "" },
  };
}

export function buildOfficialFrBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `FR bill summary by wing — ${monthLabelEn(month)}`,
  };
}

export function buildOfficialCdBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `CD bill summary by wing — ${monthLabelEn(month)}`,
  };
}

export function buildOfficialLeaveBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `CL, PL, Training, WT, MED, BGH and LNK bill summary by wing — ${monthLabelEn(month)}`,
  };
}

export function buildOfficialConsumeSheet(
  month: string,
  sheet: ConsumeOfficialSheet,
): OfficialConsumeReport {
  if (sheet === "fr") return buildOfficialFrBill(month);
  if (sheet === "cd") return buildOfficialCdBill(month);
  if (sheet === "leave") return buildOfficialLeaveBill(month);
  return buildOfficialWingConsume(month);
}

export function officialLeaveTotal(tagDays: Partial<Record<DailyTag, number>>) {
  return (
    (tagDays.CL ?? 0) +
    (tagDays.PL ?? 0) +
    (tagDays.TRG ?? 0) +
    officialWitDays(tagDays) +
    officialMedDays(tagDays) +
    officialBghDays(tagDays) +
    officialLnkDays(tagDays)
  );
}

function pageLabel(n: number, english = false) {
  return english ? String(n) : `পাতা নং-${n}`;
}

export function officialWingIdForName(wing: string) {
  const key = norm(wing);
  if (ATTACHED_WINGS.has(key)) return "attached";
  return WING_LOOKUP.get(key) ?? "admin";
}

function settingsWingTitle(
  wing: string,
  overrides?: Record<string, string>,
) {
  const named = wingOfficialName(wing, overrides);
  if (named && named.toLowerCase() !== wing.toLowerCase()) return named;
  const match = Object.keys(overrides ?? {}).find(
    (k) => k.toLowerCase() === wing.trim().toLowerCase(),
  );
  return match ? wingOfficialName(match, overrides) : named || wing;
}

/** Page-wise food list for one consume wing filter (paper Admin Wing sheet). */
export function buildWingFoodList(
  month: string,
  wingName: string,
  labelOverrides?: Record<string, string>,
): OfficialConsumeTable {
  const consume = buildConsumeMonth(month);
  const members = consume.rows
    .filter((row) => row.user.wing === wingName)
    .sort((a, b) => compareUsers(a.user, b.user));
  const monthDays = countedDaysInMonth(month);
  const rows = members.length
    ? wingPageRows(norm(wingName).replace(/\s+/g, "-") || "wing", members, {
        monthDays,
        english: true,
      })
    : [];
  const monthLabel = formatMonthDash(month);
  return consumeTable(
    settingsWingTitle(wingName, labelOverrides),
    [
      `Forces Mess food consumption list — ${monthLabel}`,
      `${CONSUME_REPORT_META.orgName}, ${CONSUME_REPORT_META.station}`,
    ],
    rows,
    {
      kind: "consume-pages",
      showPageNo: false,
      remarks: false,
      totals: { ...totalsRow(rows, "Total"), days: monthDays },
    },
  );
}

function wingPageRows(
  wingId: string,
  members: ReturnType<typeof buildConsumeMonth>["rows"],
  extras?: { monthDays?: number; english?: boolean },
): OfficialConsumeRow[] {
  const english = extras?.english ?? false;
  const monthDays = extras?.monthDays;
  if (!members.length) {
    return Array.from({ length: EMPTY_TEMPLATE_PAGES }, (_, i) => ({
      id: `${wingId}-p${i + 1}`,
      sl: i + 1,
      label: pageLabel(i + 1, english),
      pageNo: "",
      manpower: 0,
      days: monthDays,
      tagDays: {},
      totalDays: 0,
    }));
  }
  const pages = registerPages(members.length);
  const rows: OfficialConsumeRow[] = [];
  for (let i = 0; i < pages; i++) {
    const chunk = members.slice(
      i * REGISTER_PAGE_SIZE,
      (i + 1) * REGISTER_PAGE_SIZE,
    );
    const tagDays: Partial<Record<DailyTag, number>> = {};
    for (const member of chunk) addTagDays(tagDays, member.tagDays);
    rows.push({
      id: `${wingId}-p${i + 1}`,
      sl: i + 1,
      label: pageLabel(i + 1, english),
      pageNo: String(i + 1),
      manpower: chunk.length,
      days: monthDays,
      tagDays,
      totalDays: totalOf(tagDays),
    });
  }
  return rows;
}

function consumeTable(
  title: string,
  lines: string[],
  rows: OfficialConsumeRow[],
  extras: Partial<OfficialConsumeTable> = {},
): OfficialConsumeTable {
  return {
    title,
    lines,
    kind: extras.kind ?? "consume",
    showPageNo: extras.showPageNo ?? false,
    showManpower: extras.showManpower ?? true,
    remarks: extras.remarks ?? true,
    tagLabel: extras.tagLabel,
    rows,
    totals: extras.totals ?? totalsRow(rows),
  };
}

function oneTablePages(
  prefix: string,
  tables: OfficialConsumeTable[],
): OfficialConsumePage[] {
  return tables.map((table, i) => ({
    id: `${prefix}-${i + 1}`,
    tables: [table],
  }));
}

function wingCampLine(wingId: string) {
  if (wingId === "admin") {
    return `SRB HQ Camp, ${CONSUME_REPORT_META.orgName}`;
  }
  return `Ashkona Camp, ${CONSUME_REPORT_META.orgName}`;
}

export function buildOfficialConsumePack(
  month: string,
  sheet: ConsumeOfficialSheet,
): OfficialConsumePack {
  const monthLabelBn = officialMonthLabelBn(month);
  const monthLabel = monthLabelEn(month);
  const org = orgLine();
  const wings = buildOfficialWingConsume(month);
  const byWing = membersByWing(month);

  if (sheet === "fr" || sheet === "cd") {
    const tagLabel = sheet === "fr" ? "Total FR" : "Total CD";
    const word = sheet === "fr" ? "FR" : "CD";
    const summary = sheet === "fr" ? buildOfficialFrBill(month) : buildOfficialCdBill(month);
    const perWing = WING_DEFS.map((def) => {
      const row = wings.rows.find((r) => r.id === def.id) ?? rowFromBucket(def, 1, emptyBucket());
      return consumeTable(
        `${word} bill — ${def.label} — ${monthLabel}`,
        [org],
        [{ ...row, sl: 1 }],
        {
          kind: "tag",
          showPageNo: true,
          remarks: true,
          tagLabel,
          totals: { ...row, id: "total", sl: 0, label: "Total", pageNo: "" },
        },
      );
    });
    return {
      month,
      monthLabelBn,
      sheet,
      summary,
      pages: [
        {
          id: `${sheet}-all`,
          tables: [
            consumeTable(summary.title, [org], summary.rows, {
              kind: "tag",
              showPageNo: true,
              remarks: true,
              tagLabel,
              totals: { ...summary.totals, label: "Total" },
            }),
          ],
        },
        ...oneTablePages(sheet, perWing),
      ],
    };
  }

  if (sheet === "leave") {
    const summary = buildOfficialLeaveBill(month);
    const perWing = WING_DEFS.map((def) => {
      const row = wings.rows.find((r) => r.id === def.id) ?? rowFromBucket(def, 1, emptyBucket());
      return consumeTable(
        `CL, PL, Training, WT, MED, BGH and LNK bill — ${def.label} — ${monthLabel}`,
        [org],
        [{ ...row, sl: 1 }],
        {
          kind: "leave",
          showPageNo: true,
          showManpower: true,
          remarks: true,
          totals: { ...row, id: "total", sl: 0, label: "Total", pageNo: "" },
        },
      );
    });
    return {
      month,
      monthLabelBn,
      sheet,
      summary,
      pages: [
        {
          id: "leave-all",
          tables: [
            consumeTable(summary.title, [org], summary.rows, {
              kind: "leave",
              showPageNo: true,
              showManpower: false,
              remarks: true,
              totals: { ...summary.totals, label: "Total" },
            }),
          ],
        },
        ...oneTablePages("leave", perWing),
      ],
    };
  }

  const camp = buildOfficialCampConsume(month);
  const admin = wings.rows.find((r) => r.id === "admin");
  const ashkona = wings.rows.filter((r) => r.id !== "admin");
  const hqRows = admin
    ? [{ ...admin, sl: 1, pageNo: "" }]
    : [];

  const pages: OfficialConsumePage[] = [
    {
      id: "monthly-all",
      tables: [
        consumeTable(wings.title, [org], wings.rows, {
          showPageNo: true,
          remarks: false,
          totals: { ...wings.totals, label: "Total" },
        }),
      ],
    },
    {
      id: "monthly-camp",
      tables: [
        consumeTable(camp.title, [org], camp.rows, {
          showPageNo: false,
          remarks: true,
          totals: { ...camp.totals, label: "Total" },
        }),
      ],
    },
    {
      id: "monthly-hq",
      tables: [
        consumeTable(`Consume account by wing — ${monthLabel}`, [org, "SRB HQ Camp"], hqRows, {
          showPageNo: false,
          remarks: true,
        }),
      ],
    },
    {
      id: "monthly-ashkona",
      tables: [
        consumeTable(
          `Consume account by wing — ${monthLabel}`,
          [org, "Ashkona Camp"],
          ashkona.map((row, i) => ({ ...row, sl: i + 1, pageNo: "" })),
          { showPageNo: false, remarks: true },
        ),
      ],
    },
    ...WING_DEFS.map((def) => {
      const rows = wingPageRows(def.id, byWing.get(def.id) ?? [], {
        english: true,
      });
      return {
        id: `monthly-pages-${def.id}`,
        tables: [
          consumeTable(
            `Consume account by wing — ${monthLabel} (${def.label})`,
            [wingCampLine(def.id)],
            rows,
            {
              kind: "consume-pages",
              showPageNo: false,
              remarks: true,
              totals: { ...totalsRow(rows), label: "Total" },
            },
          ),
        ],
      };
    }),
  ];

  return {
    month,
    monthLabelBn,
    sheet: "wings",
    summary: wings,
    pages,
  };
}
