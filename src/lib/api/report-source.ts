import { apiJson } from "@/lib/api/client";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import type { ReportSource } from "@/lib/reports";
import type {
  AllowanceRate,
  DailyAssignment,
  DailyTag,
  SenderAccount,
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

export function reportSourceFromApi(data: ReportSourceApi): ReportSource {
  return {
    users: data.users.map(memberToUser),
    assignments: (data.assignments ?? []).map((row) => ({
      ...row,
      tag: (row.tag || "") as DailyTag,
    })),
    rates: data.rates ?? [],
    senders: data.senders ?? [],
    suppressed_carries: data.suppressed_carries ?? [],
  };
}
