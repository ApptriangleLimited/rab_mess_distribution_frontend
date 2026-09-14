import { apiJson } from "@/lib/api/client";
import type { DailyStateReport, DailyTag } from "@/lib/types";

export type StateReportApi = DailyStateReport;

export function listStateReportsApi() {
  return apiJson<StateReportApi[]>("/api/v1/state-reports");
}

export function fetchStateReportApi(id: string) {
  return apiJson<StateReportApi>(
    `/api/v1/state-reports/${encodeURIComponent(id)}`,
  );
}

export function fetchStateReportDraftApi(day: string) {
  return apiJson<
    Pick<DailyStateReport, "date" | "boro_khana" | "members" | "totals">
  >(`/api/v1/state-reports/draft?day=${encodeURIComponent(day)}`);
}

export function submitStateReportApi(day: string) {
  return apiJson<StateReportApi>(
    `/api/v1/state-reports?day=${encodeURIComponent(day)}`,
    { method: "POST" },
  );
}

export function reviewStateReportApi(
  id: string,
  status: "approved" | "rejected",
  note = "",
) {
  return apiJson<StateReportApi>(
    `/api/v1/state-reports/${encodeURIComponent(id)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ status, note }),
    },
  );
}

export function normalizeStateReport(row: StateReportApi): DailyStateReport {
  return {
    ...row,
    members: (row.members ?? []).map((m) => ({
      ...m,
      tag: (m.tag || "") as DailyTag,
    })),
    totals: {
      active: row.totals?.active ?? row.members?.length ?? 0,
      by_tag: row.totals?.by_tag ?? {},
      mess_eaters: row.totals?.mess_eaters ?? 0,
    },
  };
}
