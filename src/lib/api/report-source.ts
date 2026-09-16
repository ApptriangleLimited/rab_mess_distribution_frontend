import { apiJson } from "@/lib/api/client";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import type { ReportSource } from "@/lib/reports";
import {
  extraTrustFirewoodAssignments,
  extraTrustFirewoodMembers,
} from "@/lib/store/seed";
import type {
  AllowanceRate,
  DailyAssignment,
  DailyTag,
  SenderAccount,
  User,
} from "@/lib/types";

export type ReportSourceApi = {
  from: string;
  to: string;
  users: MemberApiRow[];
  assignments: DailyAssignment[];
  rates: AllowanceRate[];
  senders: SenderAccount[];
  suppressed_carries: string[];
};

export function fetchReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params.month) search.set("month", params.month);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const suffix = search.toString() ? `?${search}` : "";
  return apiJson<ReportSourceApi>(`/api/v1/reports/source${suffix}`);
}

function mergeTrustFirewoodSource(
  users: User[],
  assignments: DailyAssignment[],
) {
  const extras = extraTrustFirewoodMembers();
  const ids = new Set(users.map((u) => u.id));
  const mergedUsers = extras.length
    ? [...users, ...extras.filter((u) => !ids.has(u.id))]
    : users;
  const extraAssigns = extraTrustFirewoodAssignments();
  const keys = new Set(assignments.map((a) => `${a.user_id}|${a.date}`));
  const mergedAssigns = extraAssigns.length
    ? [...assignments, ...extraAssigns.filter((a) => !keys.has(`${a.user_id}|${a.date}`))]
    : assignments;
  return { users: mergedUsers, assignments: mergedAssigns };
}

export function reportSourceFromApi(data: ReportSourceApi): ReportSource {
  const merged = mergeTrustFirewoodSource(
    data.users.map(memberToUser),
    (data.assignments ?? []).map((row) => ({
      ...row,
      tag: (row.tag || "") as DailyTag,
    })),
  );
  return {
    users: merged.users,
    assignments: merged.assignments,
    rates: data.rates ?? [],
    senders: data.senders ?? [],
    suppressed_carries: data.suppressed_carries ?? [],
  };
}
