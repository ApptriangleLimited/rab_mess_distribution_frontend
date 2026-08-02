import { getState } from "@/lib/store";
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
  rows.sort((a, b) => a.user.name.localeCompare(b.user.name));

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

export function buildRationMonth(month: string) {
  const consume = buildConsumeMonth(month);
  const rates = rateMap();
  const eligibleRows = consume.rows
    .map((row) => {
      const parts: { tag: DailyTag; days: number; rate: number; amount: number }[] =
        [];
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

export function formatBdt(amount: number) {
  return `৳${amount.toLocaleString("en-BD")}`;
}
