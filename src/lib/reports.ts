import { getState } from "@/lib/store";
import {
  FR_FUEL_RATE_PER_DAY,
  RATION_REPORT_META,
} from "@/lib/constants";
import { daysInMonth, todayISO } from "@/lib/date";
import { listAllTags } from "@/lib/store/rates";
import { compareUsers } from "@/lib/store/users";
import type {
  DailyAssignment,
  DailyTag,
  SenderAccount,
  User,
} from "@/lib/types";

export type UserMonthRow = {
  user: User;
  tagDays: Partial<Record<DailyTag, number>>;
  totalDays: number;
  allowanceDays: number;
  amount: number;
};

export type TagAggregate = {
  tag: DailyTag;
  days: number;
  users: number;
  amount: number;
};

export type TagBillRow = {
  sl: number;
  user: User;
  days: number;
  rate: number;
  amount: number;
  fuelRate: number;
  fuelAmount: number;
  grandTotal: number;
  remarks: string;
};

export type WingSummaryRow = {
  wing: string;
  manpower: number;
  tagDays: Partial<Record<DailyTag, number>>;
  totalDays: number;
};

export type LedgerDayCell = DailyTag | "";

export type LedgerRow = {
  user: User;
  days: LedgerDayCell[];
  tagCounts: Partial<Record<DailyTag, number>>;
  totalDays: number;
};

export type RationLine = {
  user: User;
  tag: DailyTag;
  days: number;
  rate: number;
  amount: number;
};

export type SenderReportGroup = {
  sender: SenderAccount;
  lines: RationLine[];
  total: number;
};

function assignmentsInMonth(month: string): DailyAssignment[] {
  return getState().assignments.filter((a) => a.date.startsWith(month));
}

function rateMap() {
  const map = new Map<DailyTag, number>();
  for (const r of getState().rates) map.set(r.tag, r.amount_per_day);
  return map;
}

function sortUsersForBill(a: User, b: User) {
  return compareUsers(a, b);
}

export function buildConsumeMonth(month: string) {
  const assignments = assignmentsInMonth(month);
  const users = getState().users;
  const rates = rateMap();

  const byUser = new Map<string, Partial<Record<DailyTag, number>>>();
  for (const a of assignments) {
    const cur = byUser.get(a.user_id) ?? {};
    cur[a.tag] = (cur[a.tag] ?? 0) + 1;
    byUser.set(a.user_id, cur);
  }

  const rows: UserMonthRow[] = [];
  for (const [userId, tagDays] of byUser) {
    const user = users.find((u) => u.id === userId);
    if (!user) continue;
    let totalDays = 0;
    let allowanceDays = 0;
    let amount = 0;
    for (const [tag, days] of Object.entries(tagDays) as [DailyTag, number][]) {
      totalDays += days;
      const rate = rates.get(tag) ?? 0;
      if (rate > 0) {
        allowanceDays += days;
        amount += days * rate;
      }
    }
    rows.push({ user, tagDays, totalDays, allowanceDays, amount });
  }
  rows.sort((a, b) => sortUsersForBill(a.user, b.user));

  const tagAggMap = new Map<DailyTag, { days: number; userIds: Set<string> }>();
  for (const a of assignments) {
    const cur = tagAggMap.get(a.tag) ?? { days: 0, userIds: new Set() };
    cur.days += 1;
    cur.userIds.add(a.user_id);
    tagAggMap.set(a.tag, cur);
  }
  const byTag: TagAggregate[] = [...tagAggMap.entries()].map(([tag, v]) => ({
    tag,
    days: v.days,
    users: v.userIds.size,
    amount: v.days * (rates.get(tag) ?? 0),
  }));
  byTag.sort((a, b) => b.days - a.days);

  return {
    month,
    assignmentCount: assignments.length,
    rows,
    byTag,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
  };
}

/** Per-tag formal bill rows (rank → dropdown → name). */
export function buildTagBill(month: string, tag: DailyTag): {
  month: string;
  tag: DailyTag;
  rate: number;
  fuelRate: number;
  rows: TagBillRow[];
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
} {
  const consume = buildConsumeMonth(month);
  const rate = rateMap().get(tag) ?? 0;
  const fuelRate = tag === "FR" ? FR_FUEL_RATE_PER_DAY : 0;

  const rows: TagBillRow[] = consume.rows
    .map((row) => {
      const days = row.tagDays[tag] ?? 0;
      if (!days) return null;
      const amount = days * rate;
      const fuelAmount = days * fuelRate;
      return {
        sl: 0,
        user: row.user,
        days,
        rate,
        amount,
        fuelRate,
        fuelAmount,
        grandTotal: amount + fuelAmount,
        remarks: "",
      };
    })
    .filter((row): row is TagBillRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user))
    .map((row, i) => ({ ...row, sl: i + 1 }));

  return {
    month,
    tag,
    rate,
    fuelRate,
    rows,
    totalDays: rows.reduce((s, r) => s + r.days, 0),
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    totalFuel: rows.reduce((s, r) => s + r.fuelAmount, 0),
    grandTotal: rows.reduce((s, r) => s + r.grandTotal, 0),
  };
}

/** Wing × tag day counts for summary sheet. */
export function buildWingSummary(month: string): {
  month: string;
  tagCodes: DailyTag[];
  rows: WingSummaryRow[];
  totals: {
    manpower: number;
    tagDays: Partial<Record<DailyTag, number>>;
    totalDays: number;
  };
} {
  const consume = buildConsumeMonth(month);
  const tagCodes = listAllTags();
  const byWing = new Map<
    string,
    { userIds: Set<string>; tagDays: Partial<Record<DailyTag, number>> }
  >();

  for (const row of consume.rows) {
    const wing = row.user.wing || "—";
    const cur = byWing.get(wing) ?? { userIds: new Set(), tagDays: {} };
    cur.userIds.add(row.user.id);
    for (const [tag, days] of Object.entries(row.tagDays) as [
      DailyTag,
      number,
    ][]) {
      if (!days) continue;
      cur.tagDays[tag] = (cur.tagDays[tag] ?? 0) + days;
    }
    byWing.set(wing, cur);
  }

  const rows: WingSummaryRow[] = [...byWing.entries()]
    .map(([wing, v]) => {
      const totalDays = Object.values(v.tagDays).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      return {
        wing,
        manpower: v.userIds.size,
        tagDays: v.tagDays,
        totalDays,
      };
    })
    .sort((a, b) => a.wing.localeCompare(b.wing));

  const totalsTag: Partial<Record<DailyTag, number>> = {};
  let manpower = 0;
  let totalDays = 0;
  for (const row of rows) {
    manpower += row.manpower;
    totalDays += row.totalDays;
    for (const [tag, days] of Object.entries(row.tagDays) as [
      DailyTag,
      number,
    ][]) {
      totalsTag[tag] = (totalsTag[tag] ?? 0) + days;
    }
  }

  return {
    month,
    tagCodes,
    rows,
    totals: { manpower, tagDays: totalsTag, totalDays },
  };
}

/** Members × day-of-month tag marks for ledger print. */
export function buildMonthLedger(month: string): {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
} {
  const dayCount = daysInMonth(month);
  const assignments = assignmentsInMonth(month);
  const users = getState().users;
  const tagCodes = listAllTags();

  const byUser = new Map<string, Map<number, DailyTag>>();
  const tagCounts = new Map<string, Partial<Record<DailyTag, number>>>();

  for (const a of assignments) {
    const day = Number(a.date.slice(8, 10));
    if (!day) continue;
    let dayMap = byUser.get(a.user_id);
    if (!dayMap) {
      dayMap = new Map();
      byUser.set(a.user_id, dayMap);
    }
    dayMap.set(day, a.tag);
    const counts = tagCounts.get(a.user_id) ?? {};
    counts[a.tag] = (counts[a.tag] ?? 0) + 1;
    tagCounts.set(a.user_id, counts);
  }

  const rows: LedgerRow[] = [...byUser.entries()]
    .map(([userId, dayMap]) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return null;
      const days: LedgerDayCell[] = [];
      for (let d = 1; d <= dayCount; d++) {
        days.push(dayMap.get(d) ?? "");
      }
      const counts = tagCounts.get(userId) ?? {};
      const totalDays = Object.values(counts).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      return { user, days, tagCounts: counts, totalDays };
    })
    .filter((row): row is LedgerRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user));

  return { month, dayCount, tagCodes, rows };
}

/**
 * Daily Cockpit attendance register rows for filtered members.
 * Includes members with no tags (blank day cells) — like paper register.
 */
export function buildDailyRegister(
  month: string,
  users: User[],
): {
  month: string;
  dayCount: number;
  rows: LedgerRow[];
} {
  const dayCount = daysInMonth(month);
  const assignments = assignmentsInMonth(month);
  const byUser = new Map<string, Map<number, DailyTag>>();

  for (const a of assignments) {
    const day = Number(a.date.slice(8, 10));
    if (!day) continue;
    let dayMap = byUser.get(a.user_id);
    if (!dayMap) {
      dayMap = new Map();
      byUser.set(a.user_id, dayMap);
    }
    dayMap.set(day, a.tag);
  }

  const rows: LedgerRow[] = [...users]
    .sort(sortUsersForBill)
    .map((user) => {
      const dayMap = byUser.get(user.id);
      const days: LedgerDayCell[] = [];
      const counts: Partial<Record<DailyTag, number>> = {};
      for (let d = 1; d <= dayCount; d++) {
        const tag = dayMap?.get(d) ?? "";
        days.push(tag);
        if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
      }
      const totalDays = Object.values(counts).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      return { user, days, tagCounts: counts, totalDays };
    });

  return { month, dayCount, rows };
}

/** Consecutive same-tag runs for register print spans (empty = one cell each). */
export function registerDayRuns(
  days: LedgerDayCell[],
): { tag: LedgerDayCell; len: number }[] {
  const runs: { tag: LedgerDayCell; len: number }[] = [];
  let i = 0;
  while (i < days.length) {
    const tag = days[i] ?? "";
    if (!tag) {
      runs.push({ tag: "", len: 1 });
      i += 1;
      continue;
    }
    let len = 1;
    while (i + len < days.length && days[i + len] === tag) len += 1;
    runs.push({ tag, len });
    i += len;
  }
  return runs;
}

/** Paper register stroke marks for single-day duty tags. */
export function registerCellMark(tag: LedgerDayCell, len: number): string {
  if (!tag) return "";
  if (len > 1) return tag;
  if (
    tag === "FR" ||
    tag === "CD" ||
    tag === "MS" ||
    tag === "WR" ||
    tag === "TRG" ||
    tag === "WIT" ||
    tag === "MED"
  ) {
    return "|";
  }
  return tag;
}

export function buildRationMonth(month: string) {
  const consume = buildConsumeMonth(month);
  const rates = rateMap();
  const eligibleRows = consume.rows
    .map((row) => {
      const parts: {
        tag: DailyTag;
        days: number;
        rate: number;
        amount: number;
      }[] = [];
      for (const [tag, days] of Object.entries(row.tagDays) as [
        DailyTag,
        number,
      ][]) {
        const rate = rates.get(tag) ?? 0;
        if (rate <= 0 || !days) continue;
        parts.push({ tag, days, rate, amount: days * rate });
      }
      return { ...row, parts };
    })
    .filter((r) => r.parts.length > 0);

  return {
    month,
    rows: eligibleRows,
    byTag: consume.byTag.filter((t) => t.amount > 0),
    totalAmount: eligibleRows.reduce((s, r) => s + r.amount, 0),
  };
}

export function buildRationReport(month: string): {
  month: string;
  groups: SenderReportGroup[];
  unmapped: RationLine[];
  total: number;
} {
  const { users, senders, rates } = getState();
  const rateByTag = new Map(rates.map((r) => [r.tag, r.amount_per_day]));
  const assignments = assignmentsInMonth(month);

  const daysMap = new Map<string, number>();
  for (const a of assignments) {
    const rate = rateByTag.get(a.tag) ?? 0;
    if (rate <= 0) continue;
    const key = `${a.user_id}::${a.tag}`;
    daysMap.set(key, (daysMap.get(key) ?? 0) + 1);
  }

  const lines: RationLine[] = [];
  for (const [key, days] of daysMap) {
    const [userId, tag] = key.split("::") as [string, DailyTag];
    const user = users.find((u) => u.id === userId);
    if (!user) continue;
    const rate = rateByTag.get(tag) ?? 0;
    lines.push({ user, tag, days, rate, amount: days * rate });
  }

  const groups: SenderReportGroup[] = senders.map((sender) => {
    const senderLines = lines.filter((l) =>
      sender.mapped_tags.includes(l.tag),
    );
    return {
      sender,
      lines: senderLines.sort((a, b) => a.user.name.localeCompare(b.user.name)),
      total: senderLines.reduce((s, l) => s + l.amount, 0),
    };
  });

  const mappedTags = new Set(senders.flatMap((s) => s.mapped_tags));
  const unmapped = lines.filter((l) => !mappedTags.has(l.tag));

  return {
    month,
    groups,
    unmapped,
    total: lines.reduce((s, l) => s + l.amount, 0),
  };
}

export function buildRationReportClean(month: string) {
  const raw = buildRationReport(month);
  return {
    ...raw,
    groups: raw.groups.filter((g) => g.lines.length > 0),
  };
}

export type RationStaffLine = {
  ser: number;
  user: User;
  amount: number;
  tags: DailyTag[];
  days: number;
  missingBank: boolean;
  remarks: string;
};

export type RationStaffSheet = {
  month: string;
  sender: SenderAccount;
  lines: RationStaffLine[];
  total: number;
};

export type RationTransferLine = {
  ser: number;
  date: string;
  refNo: string;
  senderAccountNo: string;
  receiverRouting: string;
  senderRouting: string;
  type: string;
  customerAccountName: string;
  customerAccountNo: string;
  amount: number;
  institute: string;
  entryDescription: string;
  paymentInfo: string;
  currency: string;
  user: User;
  missingBank: boolean;
};

export type RationTransferSheet = {
  month: string;
  sender: SenderAccount;
  lines: RationTransferLine[];
  total: number;
  reportDate: string;
};

function rollLinesPerUser(lines: RationLine[]): {
  user: User;
  amount: number;
  tags: DailyTag[];
  days: number;
}[] {
  const map = new Map<
    string,
    { user: User; amount: number; tags: Set<DailyTag>; days: number }
  >();
  for (const line of lines) {
    const cur = map.get(line.user.id) ?? {
      user: line.user,
      amount: 0,
      tags: new Set<DailyTag>(),
      days: 0,
    };
    cur.amount += line.amount;
    cur.days += line.days;
    cur.tags.add(line.tag);
    map.set(line.user.id, cur);
  }
  return [...map.values()]
    .map((v) => ({
      user: v.user,
      amount: v.amount,
      tags: [...v.tags],
      days: v.days,
    }))
    .sort((a, b) => sortUsersForBill(a.user, b.user));
}

function missingBank(user: User) {
  return !user.account_number?.trim() || !user.routing?.trim();
}

/** Staff payout rows (PDF p2 shape), rolled per member. Optional sender / tag filter. */
export function buildRationStaffLines(
  month: string,
  senderId?: string,
  tag?: DailyTag,
): RationStaffSheet[] {
  // Tag + bank letter: count days for tag even when rate is 0 / tag not on mapped_tags.
  if (tag && senderId) {
    const { users, senders, rates } = getState();
    const sender = senders.find((s) => s.id === senderId);
    if (!sender) return [];
    const rate =
      rates.find((r) => r.tag === tag)?.amount_per_day ?? 0;
    const daysMap = new Map<string, number>();
    for (const a of assignmentsInMonth(month)) {
      if (a.tag !== tag) continue;
      daysMap.set(a.user_id, (daysMap.get(a.user_id) ?? 0) + 1);
    }
    const rolled = [...daysMap.entries()]
      .map(([userId, days]) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return null;
        return {
          user,
          days,
          amount: days * rate,
          tags: [tag] as DailyTag[],
        };
      })
      .filter(
        (
          row,
        ): row is {
          user: User;
          days: number;
          amount: number;
          tags: DailyTag[];
        } => Boolean(row),
      )
      .sort((a, b) => sortUsersForBill(a.user, b.user));

    if (!rolled.length) return [];

    const lines: RationStaffLine[] = rolled.map((row, i) => ({
      ser: i + 1,
      user: row.user,
      amount: row.amount,
      tags: row.tags,
      days: row.days,
      missingBank: missingBank(row.user),
      remarks: "",
    }));

    return [
      {
        month,
        sender,
        lines,
        total: lines.reduce((s, l) => s + l.amount, 0),
      },
    ];
  }

  const report = buildRationReportClean(month);
  const groups = senderId
    ? report.groups.filter((g) => g.sender.id === senderId)
    : report.groups;

  return groups
    .map((group) => {
      const scoped = tag
        ? group.lines.filter((l) => l.tag === tag)
        : group.lines;
      const rolled = rollLinesPerUser(scoped);
      const lines: RationStaffLine[] = rolled.map((row, i) => ({
        ser: i + 1,
        user: row.user,
        amount: row.amount,
        tags: row.tags,
        days: row.days,
        missingBank: missingBank(row.user),
        remarks: "",
      }));
      return {
        month,
        sender: group.sender,
        lines,
        total: lines.reduce((s, l) => s + l.amount, 0),
      };
    })
    .filter((sheet) => sheet.lines.length > 0);
}

/** 14-col bank transfer rows (PDF p1 shape). Optional sender filter. */
export function buildRationTransferLines(
  month: string,
  senderId?: string,
  reportDate = todayISO(),
): RationTransferSheet[] {
  const staffSheets = buildRationStaffLines(month, senderId);

  return staffSheets.map((sheet) => {
    const compactDate = reportDate.replace(/-/g, "");
    const lines: RationTransferLine[] = sheet.lines.map((row, i) => {
      const refNo = `${compactDate}${String(i + 1).padStart(6, "0")}`;
      return {
        ser: i + 1,
        date: reportDate,
        refNo,
        senderAccountNo: sheet.sender.account_number || "0",
        receiverRouting: row.user.routing?.trim() || "0",
        senderRouting: sheet.sender.routing || "0",
        type: RATION_REPORT_META.transferType,
        customerAccountName:
          row.user.account_name?.trim() || row.user.name,
        customerAccountNo: row.user.account_number?.trim() || "0",
        amount: row.amount,
        institute: RATION_REPORT_META.institute,
        entryDescription: RATION_REPORT_META.entryDescription,
        paymentInfo: RATION_REPORT_META.paymentInfo,
        currency: RATION_REPORT_META.currency,
        user: row.user,
        missingBank: row.missingBank,
      };
    });
    return {
      month,
      sender: sheet.sender,
      lines,
      total: sheet.total,
      reportDate,
    };
  });
}

/** Single-member FR transfer letter (14-col) for selected bank + member. */
export function buildFrMemberTransferSheet(
  month: string,
  senderId: string,
  userId: string,
  reportDate = todayISO(),
): RationTransferSheet | null {
  const sheets = buildRationStaffLines(month, senderId, "FR");
  const sheet = sheets[0];
  if (!sheet) return null;
  const row = sheet.lines.find((l) => l.user.id === userId);
  if (!row) return null;

  const compactDate = reportDate.replace(/-/g, "");
  const line: RationTransferLine = {
    ser: 1,
    date: reportDate,
    refNo: `${compactDate}${String(1).padStart(6, "0")}`,
    senderAccountNo: sheet.sender.account_number || "0",
    receiverRouting: row.user.routing?.trim() || "0",
    senderRouting: sheet.sender.routing || "0",
    type: RATION_REPORT_META.transferType,
    customerAccountName: row.user.account_name?.trim() || row.user.name,
    customerAccountNo: row.user.account_number?.trim() || "0",
    amount: row.amount,
    institute: RATION_REPORT_META.institute,
    entryDescription: RATION_REPORT_META.entryDescription,
    paymentInfo: RATION_REPORT_META.paymentInfo,
    currency: RATION_REPORT_META.currency,
    user: row.user,
    missingBank: row.missingBank,
  };

  return {
    month,
    sender: sheet.sender,
    lines: [line],
    total: line.amount,
    reportDate,
  };
}

export function formatBdt(amount: number) {
  return `৳${amount.toLocaleString("en-BD")}`;
}
