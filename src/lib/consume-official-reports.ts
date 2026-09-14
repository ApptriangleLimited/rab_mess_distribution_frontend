import {
  ADMIN_SUB_WINGS,
  CONSUME_REPORT_META,
  HQ_SUB_WINGS,
} from "@/lib/constants";
import { formatMonthDash } from "@/lib/date";
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

/** ছুটি — leave besides CL / PL (not WR; WR is রেশন বিহীন). */
const LEAVE_TAGS: DailyTag[] = ["RL", "JL", "OSL", "AWL", "MOL"];
const HOSPITAL_TAGS: DailyTag[] = ["MED", "CMH", "BGH", "RBH"];

export function officialLeaveDays(tagDays: Partial<Record<DailyTag, number>>) {
  return sumTags(tagDays, LEAVE_TAGS);
}

export function officialHospitalDays(
  tagDays: Partial<Record<DailyTag, number>>,
) {
  return sumTags(tagDays, HOSPITAL_TAGS);
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
  return Object.values(tagDays).reduce<number>((s, n) => s + (n ?? 0), 0);
}

const IEC_WINGS = new Set(["security branch - iec cell"]);
const ATTACHED_WINGS = new Set(["new / temporary attached"]);

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
  { id: "admin", label: "প্রশাসন ও অর্থ উইং" },
  { id: "ops", label: "অপস উইং" },
  { id: "int", label: "ইন্টেলিজেন্স উইং" },
  { id: "inv", label: "তদন্ত উইং" },
  { id: "trg", label: "ট্রেনিং উইং" },
  { id: "iec", label: "আইইসি সেল" },
  { id: "lm", label: "লিগ্যাল এন্ড মিডিয়া উইং" },
  { id: "comm", label: "যোগাযোগ উইং" },
  { id: "rd", label: "আরএন্ডডি সেল" },
  { id: "air", label: "এয়ার উইং" },
  { id: "new", label: "নতুন সদস্য" },
  { id: "attached", label: "সংযুক্ত সদস্য" },
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

function totalsRow(rows: OfficialConsumeRow[], label = "মোট ="): OfficialConsumeRow {
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
  if (!pages) return "-";
  return `${toBnDigits(1)} হতে ${toBnDigits(pages)}`;
}

function orgLine() {
  return `${CONSUME_REPORT_META.orgNameBn}, ${CONSUME_REPORT_META.stationBn}`;
}

export function buildOfficialWingConsume(month: string): OfficialConsumeReport {
  const buckets = bucketsFromMonth(month);
  const byWing = membersByWing(month);
  const rows = WING_DEFS.map((def, i) =>
    rowFromBucket(
      def,
      i + 1,
      buckets.get(def.id) ?? emptyBucket(),
      pageRangeBn(registerPages(byWing.get(def.id)?.length ?? 0)),
    ),
  );
  return {
    month,
    monthLabelBn: officialMonthLabelBn(month),
    title: `সকল উইং এর অনুযায়ী কনজিউম হিসাবের সারাংশ ${officialMonthLabelBn(month)}`,
    rows,
    totals: totalsRow(rows),
  };
}

export function buildOfficialCampConsume(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  const hq = wings.rows.filter((r) => r.id === "admin");
  const ashkona = wings.rows.filter((r) => r.id !== "admin");
  const rows: OfficialConsumeRow[] = [
    { ...totalsRow(hq, "এসআরবি সদর ক্যাম্প"), id: "hq", sl: 1, pageNo: "" },
    { ...totalsRow(ashkona, "আশকোনা ক্যাম্প"), id: "ashkona", sl: 2, pageNo: "" },
  ];
  return {
    month,
    monthLabelBn: officialMonthLabelBn(month),
    title: `মাসিক কনজিউম সারাংশ ${officialMonthLabelBn(month)}`,
    rows,
    totals: { ...totalsRow(rows), sl: 3, pageNo: "" },
  };
}

export function buildOfficialFrBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `সকল উইং এর এফআর বিলের সারাংশ ${officialMonthLabelBn(month)}`,
  };
}

export function buildOfficialCdBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `সকল উইং এর সিডি বিলের সারাংশ ${officialMonthLabelBn(month)}`,
  };
}

export function buildOfficialLeaveBill(month: string): OfficialConsumeReport {
  const wings = buildOfficialWingConsume(month);
  return {
    ...wings,
    title: `সকল উইং এর সিএল, পিএল, ট্রেনিং, ছুটি ও হাসপাতাল বিলের সারাংশ ${officialMonthLabelBn(month)}`,
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
    officialLeaveDays(tagDays) +
    officialHospitalDays(tagDays)
  );
}

function pageLabel(n: number) {
  return `পাতা নং-${toBnDigits(n)}`;
}

function wingPageRows(
  wingId: string,
  members: ReturnType<typeof buildConsumeMonth>["rows"],
): OfficialConsumeRow[] {
  if (!members.length) {
    return Array.from({ length: EMPTY_TEMPLATE_PAGES }, (_, i) => ({
      id: `${wingId}-p${i + 1}`,
      sl: i + 1,
      label: pageLabel(i + 1),
      pageNo: "",
      manpower: 0,
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
      label: pageLabel(i + 1),
      pageNo: "",
      manpower: chunk.length,
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

function pairPages(
  prefix: string,
  tables: OfficialConsumeTable[],
): OfficialConsumePage[] {
  const pages: OfficialConsumePage[] = [];
  for (let i = 0; i < tables.length; i += 2) {
    pages.push({
      id: `${prefix}-${i / 2 + 1}`,
      tables: tables.slice(i, i + 2),
    });
  }
  return pages;
}

function wingCampLine(wingId: string) {
  if (wingId === "admin") {
    return "এসআরবি সদর ক্যাম্প, এসআরবি-স্পেশাল রেসপন্স ব্যাটালিয়ন সদর দপ্তর";
  }
  return "আশকোনা ক্যাম্প, এসআরবি-স্পেশাল রেসপন্স ব্যাটালিয়ন সদর দপ্তর";
}

export function buildOfficialConsumePack(
  month: string,
  sheet: ConsumeOfficialSheet,
): OfficialConsumePack {
  const monthLabelBn = officialMonthLabelBn(month);
  const org = orgLine();
  const wings = buildOfficialWingConsume(month);
  const byWing = membersByWing(month);

  if (sheet === "fr" || sheet === "cd") {
    const tag = sheet === "fr" ? "FR" : "CD";
    const tagLabel = sheet === "fr" ? "সর্বমোট এফআর" : "সর্বমোট সিডি";
    const word = sheet === "fr" ? "এফআর" : "সিডি";
    const summary = sheet === "fr" ? buildOfficialFrBill(month) : buildOfficialCdBill(month);
    const perWing = WING_DEFS.map((def) => {
      const row = wings.rows.find((r) => r.id === def.id) ?? rowFromBucket(def, 1, emptyBucket());
      return consumeTable(
        `উইং অনুযায়ী ${word} বিলের সারাংশ ${monthLabelBn}`,
        [org],
        [{ ...row, sl: 1 }],
        {
          kind: "tag",
          showPageNo: true,
          remarks: true,
          tagLabel,
          totals: { ...row, id: "total", sl: 0, label: "মোট =", pageNo: "" },
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
              totals: { ...summary.totals, label: "মোট =" },
            }),
          ],
        },
        ...pairPages(sheet, perWing),
      ],
    };
  }

  if (sheet === "leave") {
    const summary = buildOfficialLeaveBill(month);
    const perWing = WING_DEFS.map((def) => {
      const row = wings.rows.find((r) => r.id === def.id) ?? rowFromBucket(def, 1, emptyBucket());
      return consumeTable(
        `উইং অনুযায়ী সিএল, পিএল, ট্রেনিং, ছুটি ও হাসপাতাল বিলের সারাংশ ${monthLabelBn}`,
        [org],
        [{ ...row, sl: 1 }],
        {
          kind: "leave",
          showPageNo: true,
          showManpower: true,
          remarks: true,
          totals: { ...row, id: "total", sl: 0, label: "মোট =", pageNo: "" },
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
              totals: { ...summary.totals, label: "সর্বমোট =" },
            }),
          ],
        },
        ...pairPages("leave", perWing),
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
          totals: { ...wings.totals, label: "মোট =" },
        }),
      ],
    },
    {
      id: "monthly-camp",
      tables: [
        consumeTable(camp.title, [org], camp.rows, {
          showPageNo: false,
          remarks: true,
          totals: { ...camp.totals, label: "মোট =" },
        }),
      ],
    },
    {
      id: "monthly-hq",
      tables: [
        consumeTable(`উইং অনুযায়ী কনজিউম হিসাব ${monthLabelBn}`, [org, "এসআরবি সদর দপ্তর ক্যাম্প"], hqRows, {
          showPageNo: false,
          remarks: true,
        }),
      ],
    },
    {
      id: "monthly-ashkona",
      tables: [
        consumeTable(
          `উইং অনুযায়ী কনজিউম হিসাব ${monthLabelBn}`,
          [org, "আশকোনা ক্যাম্প"],
          ashkona.map((row, i) => ({ ...row, sl: i + 1, pageNo: "" })),
          { showPageNo: false, remarks: true },
        ),
      ],
    },
    ...WING_DEFS.map((def) => {
      const rows = wingPageRows(def.id, byWing.get(def.id) ?? []);
      return {
        id: `monthly-pages-${def.id}`,
        tables: [
          consumeTable(
            `উইং অনুযায়ী কনজিউম হিসাব ${monthLabelBn} (${def.label})`,
            [wingCampLine(def.id)],
            rows,
            { kind: "consume-pages", showPageNo: false, remarks: true },
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
