import type { AssignmentCell } from "@/lib/api/assignments";
import { getState } from "@/lib/store";
import {
  CL_FR_MONTHLY_TAG,
  DAILY_TAGS,
  FR_FUEL_RATE_PER_DAY,
  FUEL_RATE_TAG,
  isRateOnlyTag,
  RATE_ONLY_TAGS,
  RATION_REPORT_META,
} from "@/lib/constants";
import { isFrFuelTag, sameBankName } from "@/lib/official-senders";
import {
  dateInMonth,
  daysInMonth,
  eachISODate,
  todayISO,
} from "@/lib/date";
import { projectedCockpitTag } from "@/lib/store/pritibhoj-counts";
import { canAssignOnDate, isMfrLocked, MFR_TAG } from "@/lib/store/daily";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import { isTrgRationPayable, isTrgTag } from "@/lib/trg-tone";
import { activeSenders } from "@/lib/store/senders";
import { parseMoney, roundPaisa } from "@/lib/money";
import type {
  AllowanceRate,
  DailyAssignment,
  DailyTag,
  SenderAccount,
  User,
} from "@/lib/types";

export { formatBdt } from "@/lib/money";

/** Fixed generate-report Ref. No — same on every row. */
export function rationTransferRefNo(_ser?: number) {
  return `${RATION_REPORT_META.transferRefPrefix}00001`;
}

/** Live DB snapshot for consume / ration / ledger builders. */
export type ReportSource = {
  users: User[];
  assignments: DailyAssignment[];
  rates?: AllowanceRate[];
  senders?: SenderAccount[];
  suppressed_carries?: string[];
};

let currentSource: ReportSource | undefined;

export function withReportSource<T>(
  source: ReportSource | undefined,
  fn: () => T,
): T {
  const prev = currentSource;
  currentSource = source;
  try {
    return fn();
  } finally {
    currentSource = prev;
  }
}

function reportState() {
  const state = getState();
  if (!currentSource) return state;
  return {
    ...state,
    users: currentSource.users,
    assignments: currentSource.assignments,
    rates: currentSource.rates ?? state.rates,
    senders: currentSource.senders ?? state.senders,
    suppressed_carries:
      currentSource.suppressed_carries ?? state.suppressed_carries,
  };
}

function listAllTags(): DailyTag[] {
  const rates = reportState().rates;
  const seen = new Set<string>();
  const out: DailyTag[] = [];
  for (const builtIn of DAILY_TAGS) {
    const fromRate = rates.find(
      (r) => r.tag.toLowerCase() === builtIn.code.toLowerCase(),
    );
    const code = (fromRate?.tag ?? builtIn.code) as DailyTag;
    seen.add(code.toLowerCase());
    out.push(code);
  }
  for (const rate of rates) {
    const key = rate.tag.toLowerCase();
    if (seen.has(key) || isRateOnlyTag(rate.tag)) continue;
    seen.add(key);
    out.push(rate.tag);
  }
  return out;
}

function getFuelRatePerDay(): number {
  const rate = reportState().rates.find(
    (r) => r.tag.toLowerCase() === FUEL_RATE_TAG.toLowerCase(),
  );
  if (rate) return Math.max(0, roundPaisa(rate.amount_per_day));
  return FR_FUEL_RATE_PER_DAY;
}

function getClFrMonthlyAmount(): number {
  const rate = reportState().rates.find(
    (r) => r.tag.toLowerCase() === CL_FR_MONTHLY_TAG.toLowerCase(),
  );
  if (rate) return parseMoney(rate.amount_per_day);
  const fallback = RATE_ONLY_TAGS.find((t) => t.code === CL_FR_MONTHLY_TAG);
  return fallback ? parseMoney(fallback.defaultAmount) : 0;
}

function findPriorTag(userId: string): DailyTag | null {
  const user = reportState().users.find((row) => row.id === userId);
  return user?.default_tag ?? null;
}

function isCarrySuppressed(userId: string, date: string) {
  return (reportState().suppressed_carries ?? []).includes(`${userId}|${date}`);
}

function moneyDays(days: number, rate: number) {
  return roundPaisa(days * rate);
}

/** Tag day counts per user for month (from stored assignments). */
function tagDaysByUserInMonth(month: string): Map<string, Map<DailyTag, number>> {
  const out = new Map<string, Map<DailyTag, number>>();
  for (const a of assignmentsInMonth(month)) {
    let tags = out.get(a.user_id);
    if (!tags) {
      tags = new Map();
      out.set(a.user_id, tags);
    }
    tags.set(a.tag, (tags.get(a.tag) ?? 0) + 1);
  }
  return out;
}

/**
 * MS on CL → fixed monthly Fresh Ration (CLFR), not FR daily rate.
 * Skip anyone with FR days that month.
 */
function isClFrEligible(tagDays: Map<DailyTag, number> | undefined): boolean {
  if (!tagDays) return false;
  const cl = tagDays.get("CL") ?? 0;
  const ms = tagDays.get("MS") ?? 0;
  const fr = tagDays.get("FR") ?? 0;
  return cl > 0 && ms > 0 && fr === 0;
}

function buildClFrRationLines(month: string): RationLine[] {
  const monthly = getClFrMonthlyAmount();
  if (monthly <= 0) return [];
  const { users } = reportState();
  const byUser = tagDaysByUserInMonth(month);
  const lines: RationLine[] = [];
  for (const user of users) {
    const tags = byUser.get(user.id);
    if (!isClFrEligible(tags)) continue;
    const days = tags!.get("CL") ?? 0;
    lines.push({
      user,
      tag: "CL",
      days,
      /** Display: monthly fixed (not ৳/day). */
      rate: monthly,
      amount: monthly,
    });
  }
  return lines.sort((a, b) => sortUsersBankWise(a.user, b.user));
}

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
  return reportState().assignments.filter((a) => a.date.startsWith(month));
}

function forceByUserId() {
  return new Map(reportState().users.map((u) => [u.id, u.force] as const));
}

/** Skip black TRG days on payment / ration letters. */
function isPayoutAssignment(
  assignment: DailyAssignment,
  forces = forceByUserId(),
) {
  return isTrgRationPayable(assignment, forces.get(assignment.user_id) ?? "");
}

function rateMap() {
  const map = new Map<DailyTag, number>();
  for (const r of reportState().rates) map.set(r.tag, r.amount_per_day);
  return map;
}

function sortUsersForBill(a: User, b: User) {
  return compareUsers(a, b);
}

/** Ration letters: same member bank together (e.g. Sonali…), then roster order. */
function sortUsersBankWise(a: User, b: User) {
  const ba = (a.bank_name ?? "").trim().toLowerCase();
  const bb = (b.bank_name ?? "").trim().toLowerCase();
  const aKey = ba || "\uffff";
  const bKey = bb || "\uffff";
  if (aKey !== bKey) return aKey.localeCompare(bKey);
  return compareUsers(a, b);
}

export function buildConsumeMonth(month: string) {
  const assignments = assignmentsInMonth(month);
  const users = reportState().users;
  const rates = rateMap();

  const byUser = new Map<string, Partial<Record<DailyTag, number>>>();
  for (const a of assignments) {
    const cur = byUser.get(a.user_id) ?? {};
    cur[a.tag] = (cur[a.tag] ?? 0) + 1;
    byUser.set(a.user_id, cur);
  }

  const forces = forceByUserId();
  const payableTrgDays = new Map<string, number>();
  for (const a of assignments) {
    if (!isTrgTag(a.tag) || !isPayoutAssignment(a, forces)) continue;
    payableTrgDays.set(a.user_id, (payableTrgDays.get(a.user_id) ?? 0) + 1);
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
      if (rate <= 0) continue;
      const payableDays = isTrgTag(tag) ? (payableTrgDays.get(userId) ?? 0) : days;
      if (payableDays <= 0) continue;
      allowanceDays += payableDays;
      amount = roundPaisa(amount + moneyDays(payableDays, rate));
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
  const byTag: TagAggregate[] = [...tagAggMap.entries()].map(([tag, v]) => {
    const rate = rates.get(tag) ?? 0;
    const payableDays = isTrgTag(tag)
      ? assignments.filter((a) => a.tag === tag && isPayoutAssignment(a, forces))
          .length
      : v.days;
    return {
      tag,
      days: v.days,
      users: v.userIds.size,
      amount: moneyDays(payableDays, rate),
    };
  });
  byTag.sort((a, b) => b.days - a.days);

  return {
    month,
    assignmentCount: assignments.length,
    rows,
    byTag,
    totalAmount: roundPaisa(rows.reduce((s, r) => s + r.amount, 0)),
  };
}

/** Per-tag formal bill rows (rank → dropdown → name). */
export type LeaveMedBillRow = {
  sl: number;
  user: User;
  tagDays: Partial<Record<DailyTag, number>>;
  totalDays: number;
  rate: number;
  amount: number;
  remarks: string;
};

export function buildTagBill(
  month: string,
  tag: DailyTag | readonly DailyTag[],
): {
  month: string;
  tag: DailyTag;
  tags: DailyTag[];
  rate: number;
  fuelRate: number;
  rows: TagBillRow[];
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
} {
  const tags = (Array.isArray(tag) ? tag : [tag]) as DailyTag[];
  const primary = tags[0] ?? "FR";
  const consume = buildConsumeMonth(month);
  const rates = rateMap();
  const rate = rates.get(primary) ?? rates.get("FR") ?? 0;
  const fuelRate = tags.includes("FR") ? getFuelRatePerDay() : 0;
  const needsTrg = tags.some((code) => isTrgTag(code));
  const forces = needsTrg ? forceByUserId() : null;
  const payableTrgByUser = new Map<string, number>();
  if (forces) {
    for (const a of assignmentsInMonth(month)) {
      if (!isTrgTag(a.tag) || !isPayoutAssignment(a, forces)) continue;
      payableTrgByUser.set(a.user_id, (payableTrgByUser.get(a.user_id) ?? 0) + 1);
    }
  }

  const rows: TagBillRow[] = consume.rows
    .map((row) => {
      const days = tags.reduce((sum, code) => {
        const n = isTrgTag(code)
          ? (payableTrgByUser.get(row.user.id) ?? 0)
          : (row.tagDays[code] ?? 0);
        return sum + n;
      }, 0);
      if (!days) return null;
      const amount = moneyDays(days, rate);
      const frDays = tags.includes("FR") ? (row.tagDays.FR ?? 0) : 0;
      const fuelDays = tags.includes("MFR") ? days : frDays;
      const fuelAmount = moneyDays(fuelRate ? fuelDays : 0, fuelRate);
      return {
        sl: 0,
        user: row.user,
        days,
        rate,
        amount,
        fuelRate,
        fuelAmount,
        grandTotal: roundPaisa(amount + fuelAmount),
        remarks: "",
      };
    })
    .filter((row): row is TagBillRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user))
    .map((row, i) => ({ ...row, sl: i + 1 }));

  return {
    month,
    tag: primary,
    tags,
    rate,
    fuelRate,
    rows,
    totalDays: rows.reduce((s, r) => s + r.days, 0),
    totalAmount: roundPaisa(rows.reduce((s, r) => s + r.amount, 0)),
    totalFuel: roundPaisa(rows.reduce((s, r) => s + r.fuelAmount, 0)),
    grandTotal: roundPaisa(rows.reduce((s, r) => s + r.grandTotal, 0)),
  };
}

export function buildLeaveMedBill(
  month: string,
  tags: readonly DailyTag[] = ["CL", "PL", "TRG", "WIT", "MED", "BGH"],
): {
  month: string;
  tags: DailyTag[];
  rate: number;
  rows: LeaveMedBillRow[];
  tagTotals: Partial<Record<DailyTag, number>>;
  totalDays: number;
  totalAmount: number;
} {
  const consume = buildConsumeMonth(month);
  const rates = rateMap();
  const rate =
    rates.get("CL") ?? rates.get("FR") ?? rates.get(tags[0] ?? "CL") ?? 0;
  const forces = forceByUserId();
  const payableTrgByUser = new Map<string, number>();
  for (const a of assignmentsInMonth(month)) {
    if (!isTrgTag(a.tag) || !isPayoutAssignment(a, forces)) continue;
    payableTrgByUser.set(a.user_id, (payableTrgByUser.get(a.user_id) ?? 0) + 1);
  }

  const rows: LeaveMedBillRow[] = consume.rows
    .map((row) => {
      const tagDays: Partial<Record<DailyTag, number>> = {};
      let totalDays = 0;
      for (const code of tags) {
        const n = isTrgTag(code)
          ? (payableTrgByUser.get(row.user.id) ?? 0)
          : (row.tagDays[code] ?? 0);
        if (!n) continue;
        tagDays[code] = n;
        totalDays += n;
      }
      if (!totalDays) return null;
      return {
        sl: 0,
        user: row.user,
        tagDays,
        totalDays,
        rate,
        amount: moneyDays(totalDays, rate),
        remarks: "",
      };
    })
    .filter((row): row is LeaveMedBillRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user))
    .map((row, i) => ({ ...row, sl: i + 1 }));

  const tagTotals: Partial<Record<DailyTag, number>> = {};
  for (const code of tags) {
    tagTotals[code] = rows.reduce((s, r) => s + (r.tagDays[code] ?? 0), 0);
  }

  return {
    month,
    tags: [...tags],
    rate,
    rows,
    tagTotals,
    totalDays: rows.reduce((s, r) => s + r.totalDays, 0),
    totalAmount: roundPaisa(rows.reduce((s, r) => s + r.amount, 0)),
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

/** Members × day-of-month tag marks for ledger print.
 *  Optional `tags` limits marks + result cols (e.g. Mess MS/CD only).
 *  `carry: true` fills empty days (≤ today) from prior tag when in `tags`.
 *  `previewFuture: true` also carries into future days (read-only preview).
 */
export function buildMonthLedger(
  month: string,
  tags?: readonly DailyTag[],
  opts?: { carry?: boolean; previewFuture?: boolean },
): {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
} {
  const dayCount = daysInMonth(month);
  const assignments = assignmentsInMonth(month);
  const users = reportState().users;
  const tagFilter = tags?.length ? new Set<DailyTag>(tags) : null;
  const tagCodes = tagFilter
    ? tags!.filter((t, i, arr) => arr.indexOf(t) === i)
    : listAllTags();
  const today = todayISO();
  const useCarry = Boolean(opts?.carry);
  const previewFuture = Boolean(opts?.previewFuture);

  const byUser = new Map<string, Map<number, DailyTag>>();
  const tagCounts = new Map<string, Partial<Record<DailyTag, number>>>();

  for (const a of assignments) {
    if (tagFilter && !tagFilter.has(a.tag)) continue;
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

  if (useCarry) {
    const candidates = users.filter(
      (u) =>
        u.approval_status === "approved" &&
        u.status === "1" &&
        isCockpitMember(u),
    );
    for (const user of candidates) {
      let dayMap = byUser.get(user.id);
      if (!dayMap) {
        dayMap = new Map();
        byUser.set(user.id, dayMap);
      }
      const counts = tagCounts.get(user.id) ?? {};
      for (let d = 1; d <= dayCount; d++) {
        if (dayMap.has(d)) continue;
        const date = dateInMonth(month, d);
        if (date > today && !previewFuture) continue;
        if (isCarrySuppressed(user.id, date)) continue;
        const prior = findPriorTag(user.id);
        if (!prior) continue;
        if (tagFilter && !tagFilter.has(prior)) continue;
        dayMap.set(d, prior);
        counts[prior] = (counts[prior] ?? 0) + 1;
      }
      tagCounts.set(user.id, counts);
    }
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
      if (useCarry && totalDays === 0) return null;
      return { user, days, tagCounts: counts, totalDays };
    })
    .filter((row): row is LedgerRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user));

  return { month, dayCount, tagCodes, rows };
}

/** Members × ISO-date tag marks for a contiguous range (cross-month OK).
 *  `row.days[i]` aligns with returned `dates[i]`.
 *  `previewFuture: true` carries MS/CD (etc.) into future days for read-only preview.
 */
export function buildRangeLedger(
  from: string,
  to: string,
  tags?: readonly DailyTag[],
  opts?: { carry?: boolean; previewFuture?: boolean },
): {
  dates: string[];
  tagCodes: DailyTag[];
  rows: LedgerRow[];
} {
  const dates = eachISODate(from, to);
  const assignments = reportState().assignments.filter(
    (a) => a.date >= (from <= to ? from : to) && a.date <= (from <= to ? to : from),
  );
  const users = reportState().users;
  const tagFilter = tags?.length ? new Set<DailyTag>(tags) : null;
  const tagCodes = tagFilter
    ? tags!.filter((t, i, arr) => arr.indexOf(t) === i)
    : listAllTags();
  const today = todayISO();
  const useCarry = Boolean(opts?.carry);
  const previewFuture = Boolean(opts?.previewFuture);

  const byUser = new Map<string, Map<string, DailyTag>>();
  const tagCounts = new Map<string, Partial<Record<DailyTag, number>>>();

  for (const a of assignments) {
    if (tagFilter && !tagFilter.has(a.tag)) continue;
    let dayMap = byUser.get(a.user_id);
    if (!dayMap) {
      dayMap = new Map();
      byUser.set(a.user_id, dayMap);
    }
    dayMap.set(a.date, a.tag);
    const counts = tagCounts.get(a.user_id) ?? {};
    counts[a.tag] = (counts[a.tag] ?? 0) + 1;
    tagCounts.set(a.user_id, counts);
  }

  if (useCarry) {
    const candidates = users.filter(
      (u) =>
        u.approval_status === "approved" &&
        u.status === "1" &&
        isCockpitMember(u),
    );
    for (const user of candidates) {
      let dayMap = byUser.get(user.id);
      if (!dayMap) {
        dayMap = new Map();
        byUser.set(user.id, dayMap);
      }
      const counts = tagCounts.get(user.id) ?? {};
      for (const date of dates) {
        if (dayMap.has(date)) continue;
        if (date > today && !previewFuture) continue;
        if (isCarrySuppressed(user.id, date)) continue;
        const prior = findPriorTag(user.id);
        if (!prior) continue;
        if (tagFilter && !tagFilter.has(prior)) continue;
        dayMap.set(date, prior);
        counts[prior] = (counts[prior] ?? 0) + 1;
      }
      tagCounts.set(user.id, counts);
    }
  }

  const rows: LedgerRow[] = [...byUser.entries()]
    .map(([userId, dayMap]) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return null;
      const days: LedgerDayCell[] = dates.map((d) => dayMap.get(d) ?? "");
      const counts = tagCounts.get(userId) ?? {};
      const totalDays = Object.values(counts).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      if (useCarry && totalDays === 0) return null;
      return { user, days, tagCounts: counts, totalDays };
    })
    .filter((row): row is LedgerRow => Boolean(row))
    .sort((a, b) => sortUsersForBill(a.user, b.user));

  return { dates, tagCodes, rows };
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

/** Daily register rows for arbitrary ISO date columns (cross-month OK).
 *  `row.days[i]` aligns with `dates[i]`.
 */
export function buildDailyRegisterDates(
  dates: string[],
  users: User[],
): {
  dates: string[];
  rows: LedgerRow[];
} {
  if (!dates.length) return { dates, rows: [] };
  const state = reportState();
  const ctx = {
    users,
    assignments: state.assignments,
    suppressed_carries: state.suppressed_carries,
  };
  const rows: LedgerRow[] = [...users]
    .sort(sortUsersForBill)
    .map((user) => {
      const counts: Partial<Record<DailyTag, number>> = {};
      const days: LedgerDayCell[] = dates.map((date) => {
        const tag = projectedCockpitTag(user, date, ctx);
        if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
        return tag;
      });
      const totalDays = Object.values(counts).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      return { user, days, tagCounts: counts, totalDays };
    });

  return { dates, rows };
}

/** Register rows from API assignment cells (stored + carry tags). */
export function buildDailyRegisterFromCells(
  dates: string[],
  users: User[],
  cells: AssignmentCell[],
): {
  dates: string[];
  rows: LedgerRow[];
} {
  if (!dates.length) return { dates, rows: [] };
  const lo = dates[0];
  const hi = dates[dates.length - 1];
  const byUser = new Map<string, Map<string, DailyTag>>();
  for (const cell of cells) {
    if (cell.date < lo || cell.date > hi) continue;
    if (!cell.tag || cell.source === "empty" || cell.source === "suppressed") {
      continue;
    }
    let dayMap = byUser.get(cell.member_id);
    if (!dayMap) {
      dayMap = new Map();
      byUser.set(cell.member_id, dayMap);
    }
    dayMap.set(cell.date, cell.tag as DailyTag);
  }

  const rows: LedgerRow[] = [...users]
    .sort(sortUsersForBill)
    .map((user) => {
      const dayMap = byUser.get(user.id);
      const counts: Partial<Record<DailyTag, number>> = {};
      const days: LedgerDayCell[] = dates.map((date) => {
        const tag =
          isMfrLocked(user) && canAssignOnDate(user, date)
            ? MFR_TAG
            : (dayMap?.get(date) ?? "");
        if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
        return tag;
      });
      const totalDays = Object.values(counts).reduce<number>(
        (s, n) => s + (n ?? 0),
        0,
      );
      return { user, days, tagCounts: counts, totalDays };
    });

  return { dates, rows };
}

/** Slice register rows to calendar day numbers (1-based). */
export function sliceRegisterRows(
  rows: LedgerRow[],
  dayNumbers: number[],
): LedgerRow[] {
  return rows.map((row) => ({
    ...row,
    days: dayNumbers.map((d) => row.days[d - 1] ?? ""),
  }));
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
  const forces = forceByUserId();
  const payableTrgDays = new Map<string, number>();
  for (const a of assignmentsInMonth(month)) {
    if (!isTrgTag(a.tag) || !isPayoutAssignment(a, forces)) continue;
    payableTrgDays.set(a.user_id, (payableTrgDays.get(a.user_id) ?? 0) + 1);
  }
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
        if (rate <= 0) continue;
        const count = isTrgTag(tag)
          ? (payableTrgDays.get(row.user.id) ?? 0)
          : days;
        if (!count) continue;
        parts.push({
          tag,
          days: count,
          rate,
          amount: moneyDays(count, rate),
        });
      }
      return { ...row, parts };
    })
    .filter((r) => r.parts.length > 0);

  return {
    month,
    rows: eligibleRows,
    byTag: consume.byTag.filter((t) => t.amount > 0),
    totalAmount: roundPaisa(eligibleRows.reduce((s, r) => s + r.amount, 0)),
  };
}

export function buildRationReport(month: string): {
  month: string;
  groups: SenderReportGroup[];
  unmapped: RationLine[];
  total: number;
} {
  const { users, senders, rates } = reportState();
  const payoutSenders = activeSenders(senders);
  const rateByTag = new Map(rates.map((r) => [r.tag, r.amount_per_day]));
  const assignments = assignmentsInMonth(month);

  const forces = forceByUserId();
  const daysMap = new Map<string, number>();
  for (const a of assignments) {
    const rate = rateByTag.get(a.tag) ?? 0;
    if (rate <= 0 || !isPayoutAssignment(a, forces)) continue;
    const key = `${a.user_id}::${a.tag}`;
    daysMap.set(key, (daysMap.get(key) ?? 0) + 1);
  }

  const lines: RationLine[] = [];
  for (const [key, days] of daysMap) {
    const [userId, tag] = key.split("::") as [string, DailyTag];
    const user = users.find((u) => u.id === userId);
    if (!user) continue;
    const rate = rateByTag.get(tag) ?? 0;
    lines.push({ user, tag, days, rate, amount: moneyDays(days, rate) });
  }

  // MS + CL (no FR that month) → fixed monthly Fresh Ration via CL lines.
  lines.push(...buildClFrRationLines(month));

  const fuelRate = getFuelRatePerDay();
  if (fuelRate > 0) {
    const frDays = new Map<string, number>();
    for (const a of assignments) {
      if (a.tag !== "FR") continue;
      frDays.set(a.user_id, (frDays.get(a.user_id) ?? 0) + 1);
    }
    for (const [userId, days] of frDays) {
      const user = users.find((u) => u.id === userId);
      if (!user) continue;
      lines.push({
        user,
        tag: FUEL_RATE_TAG,
        days,
        rate: fuelRate,
        amount: moneyDays(days, fuelRate),
      });
    }
  }

  const groups: SenderReportGroup[] = payoutSenders.map((sender) => {
    const senderLines = lines.filter(
      (l) =>
        sender.mapped_tags.some(
          (t) => t.toLowerCase() === l.tag.toLowerCase(),
        ) && sameBankName(l.user.bank_name ?? "", sender.bank_name),
    );
    return {
      sender,
      lines: senderLines.sort((a, b) => a.user.name.localeCompare(b.user.name)),
      total: roundPaisa(senderLines.reduce((s, l) => s + l.amount, 0)),
    };
  });

  const mappedTags = new Set(payoutSenders.flatMap((s) => s.mapped_tags));
  const unmapped = lines.filter((l) => !mappedTags.has(l.tag));

  return {
    month,
    groups,
    unmapped,
    total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
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
  /** Member bank for SUBJECT “…Transfer BEFTN to {bank}”. */
  memberBank?: string;
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
    .sort((a, b) => sortUsersBankWise(a.user, b.user));
}

function missingBank(user: User) {
  return !user.account_number?.trim() || !user.routing?.trim();
}

function memberBankLabel(user: User) {
  return (user.bank_name ?? "").trim() || "—";
}

/** One staff letter per member bank (Sonali / Islami / …). */
export function splitStaffByMemberBank(
  sheet: RationStaffSheet,
): RationStaffSheet[] {
  const groups = new Map<string, RationStaffLine[]>();
  for (const line of sheet.lines) {
    const key = memberBankLabel(line.user);
    const list = groups.get(key) ?? [];
    list.push(line);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b);
    })
    .map(([bank, lines]) => ({
      month: sheet.month,
      sender: sheet.sender,
      memberBank: bank,
      lines: lines.map((row, i) => ({ ...row, ser: i + 1 })),
      total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
    }));
}

function flattenStaffByMemberBank(
  sheets: RationStaffSheet[],
): RationStaffSheet[] {
  return sheets.flatMap((sheet) => splitStaffByMemberBank(sheet));
}

/** Staff payout rows (PDF p2 shape), rolled per member. Optional sender / tag filter. */
export function buildRationStaffLines(
  month: string,
  senderId?: string,
  tag?: DailyTag,
): RationStaffSheet[] {
  // Tag + bank letter: count days for tag even when rate is 0 / tag not on mapped_tags.
  if (tag && senderId) {
    const { users, senders, rates } = reportState();
    const sender = activeSenders(senders).find((s) => s.id === senderId);
    if (!sender) return [];

    const bankOk = (user: User) =>
      sameBankName(user.bank_name ?? "", sender.bank_name);

    // CL ration letter: MS members get fixed monthly Fresh Ration (CLFR), not FR/day.
    if (tag === "CL") {
      const clFr = buildClFrRationLines(month).filter((row) =>
        bankOk(row.user),
      );
      if (!clFr.length) return [];
      const lines: RationStaffLine[] = clFr.map((row, i) => ({
        ser: i + 1,
        user: row.user,
        amount: row.amount,
        tags: ["CL"],
        days: row.days,
        missingBank: missingBank(row.user),
        remarks: "CL→FR monthly (MS)",
      }));
      return flattenStaffByMemberBank([
        {
          month,
          sender,
          lines,
          total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
        },
      ]);
    }

    const fuelLetter = isFrFuelTag(tag);
    const countTag: DailyTag = fuelLetter ? "FR" : tag;
    const dayRate = fuelLetter
      ? getFuelRatePerDay()
      : (rates.find((r) => r.tag === tag)?.amount_per_day ?? 0);
    const daysMap = new Map<string, number>();
    const forces = forceByUserId();
    for (const a of assignmentsInMonth(month)) {
      if (a.tag !== countTag || !isPayoutAssignment(a, forces)) continue;
      daysMap.set(a.user_id, (daysMap.get(a.user_id) ?? 0) + 1);
    }
    const rolled = [...daysMap.entries()]
      .map(([userId, days]) => {
        const user = users.find((u) => u.id === userId);
        if (!user || !bankOk(user)) return null;
        return {
          user,
          days,
          amount: moneyDays(days, dayRate),
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
      .sort((a, b) => sortUsersBankWise(a.user, b.user));

    if (!rolled.length) return [];

    const lines: RationStaffLine[] = rolled.map((row, i) => ({
      ser: i + 1,
      user: row.user,
      amount: row.amount,
      tags: row.tags,
      days: row.days,
      missingBank: missingBank(row.user),
      remarks: fuelLetter ? "FR days × fuel" : "",
    }));

    return flattenStaffByMemberBank([
      {
        month,
        sender,
        lines,
        total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
      },
    ]);
  }

  const report = buildRationReportClean(month);
  const groups = senderId
    ? report.groups.filter((g) => g.sender.id === senderId)
    : report.groups;

  // Overview / sender rollup: one sheet per sender (not bank-split).
  // Tag letters use bank-split above via flattenStaffByMemberBank.
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
        total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
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
    const lines: RationTransferLine[] = sheet.lines.map((row, i) => {
      const refNo = rationTransferRefNo(i + 1);
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

/** Staff payout rows → Trust Bank / BEFTN transfer letter rows. Data unchanged. */
export function staffSheetToTransferSheet(
  sheet: RationStaffSheet,
  reportDate = todayISO(),
): RationTransferSheet {
  const lines: RationTransferLine[] = sheet.lines.map((row, i) => ({
    ser: i + 1,
    date: reportDate,
    refNo: rationTransferRefNo(i + 1),
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
  }));
  return {
    month: sheet.month,
    sender: sheet.sender,
    lines,
    total: sheet.total,
    reportDate,
  };
}

/** FR transfer letter (14-col) — all FR members for bank. Optional single-user filter. */
export function buildFrTransferSheet(
  month: string,
  senderId: string,
  reportDate = todayISO(),
  userId?: string,
): RationTransferSheet | null {
  const sheets = buildRationStaffLines(month, senderId, "FR");
  if (!sheets.length) return null;

  const merged = sheets.flatMap((s) => s.lines);
  const source = userId
    ? merged.filter((l) => l.user.id === userId)
    : merged;
  if (source.length === 0) return null;

  const sender = sheets[0]!.sender;
  const lines: RationTransferLine[] = source.map((row, i) => ({
    ser: i + 1,
    date: reportDate,
    refNo: rationTransferRefNo(i + 1),
    senderAccountNo: sender.account_number || "0",
    receiverRouting: row.user.routing?.trim() || "0",
    senderRouting: sender.routing || "0",
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
  }));

  return {
    month,
    sender,
    lines,
    total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
    reportDate,
  };
}

/** One FR transfer letter per member bank (all Sonali on one sheet, etc.). */
export function buildFrTransferSheetsByMemberBank(
  month: string,
  senderId: string,
  reportDate = todayISO(),
): RationTransferSheet[] {
  const all = buildFrTransferSheet(month, senderId, reportDate);
  if (!all) return [];
  const groups = new Map<string, typeof all.lines>();
  for (const line of all.lines) {
    const key = memberBankLabel(line.user);
    const list = groups.get(key) ?? [];
    list.push(line);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b);
    })
    .map(([, bankLines]) => {
      const lines = bankLines.map((line, i) => ({
        ...line,
        ser: i + 1,
        refNo: rationTransferRefNo(i + 1),
      }));
      return {
        month: all.month,
        sender: all.sender,
        reportDate: all.reportDate,
        lines,
        total: roundPaisa(lines.reduce((s, l) => s + l.amount, 0)),
      } satisfies RationTransferSheet;
    });
}

/** @deprecated Prefer buildFrTransferSheetsByMemberBank — one letter per member. */
export function buildFrTransferSheetsPerUser(
  month: string,
  senderId: string,
  reportDate = todayISO(),
): RationTransferSheet[] {
  const all = buildFrTransferSheet(month, senderId, reportDate);
  if (!all) return [];
  return all.lines.map((line, i) => ({
    month: all.month,
    sender: all.sender,
    reportDate: all.reportDate,
    lines: [
      {
        ...line,
        ser: 1,
        refNo: rationTransferRefNo(i + 1),
      },
    ],
    total: line.amount,
  }));
}

/** @deprecated Prefer buildFrTransferSheet — kept for single-member deep links. */
export function buildFrMemberTransferSheet(
  month: string,
  senderId: string,
  userId: string,
  reportDate = todayISO(),
): RationTransferSheet | null {
  return buildFrTransferSheet(month, senderId, reportDate, userId);
}
