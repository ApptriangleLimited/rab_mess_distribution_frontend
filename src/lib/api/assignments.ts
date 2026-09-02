import { apiJson } from "@/lib/api/client";
import type { DailyAssignment, DailyTag } from "@/lib/types";

export type AssignmentSource = "stored" | "carry" | "empty" | "suppressed";

export type AssignmentCell = {
  member_id: string;
  date: string;
  tag: string | null;
  source: AssignmentSource;
  updated_at?: string;
  updated_by?: string;
};

export type AssignmentListData = {
  items: AssignmentCell[];
  from: string;
  to: string;
};

export type AssignmentSummaryData = {
  from: string;
  to: string;
  by_tag: Record<string, number>;
  total_tagged_person_days: number;
  member_count: number;
};

export type AssignmentQuery = {
  month?: string;
  from?: string;
  to?: string;
  date?: string;
  member_id?: string;
  rank?: string;
  wing?: string;
  q?: string;
};

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    search.set(key, value);
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export function listAssignments(params: AssignmentQuery = {}) {
  return apiJson<AssignmentListData>(`/api/v1/assignments${qs(params)}`);
}

export function assignmentSummary(params: AssignmentQuery = {}) {
  return apiJson<AssignmentSummaryData>(
    `/api/v1/assignments/summary${qs(params)}`,
  );
}

export function putAssignment(body: {
  member_id: string;
  date: string;
  tag: string;
}) {
  return apiJson<{ items: AssignmentCell[] }>("/api/v1/assignments", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAssignment(member_id: string, date: string) {
  return apiJson<{ items: AssignmentCell[] }>(
    `/api/v1/assignments${qs({ member_id, date })}`,
    { method: "DELETE" },
  );
}

export function putAssignmentRange(body: {
  member_id: string;
  dates: string[];
  tag: string;
}) {
  return apiJson<{ updated: number; items: AssignmentCell[] }>(
    "/api/v1/assignments/range",
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

/** Stored rows only — shape register board expects. */
export function cellsToAssignments(items: AssignmentCell[]): DailyAssignment[] {
  return items
    .filter((cell) => cell.source === "stored" && cell.tag)
    .map((cell) => ({
      id: `${cell.member_id}|${cell.date}`,
      user_id: cell.member_id,
      date: cell.date,
      tag: cell.tag as DailyTag,
      updated_by: cell.updated_by ?? "daily",
      updated_at: cell.updated_at ?? new Date().toISOString(),
    }));
}

export function cellsToSuppressed(items: AssignmentCell[]): string[] {
  return items
    .filter((cell) => cell.source === "suppressed")
    .map((cell) => `${cell.member_id}|${cell.date}`);
}

export function priorTagFromCells(
  items: AssignmentCell[],
  memberId: string,
  beforeDate: string,
): DailyTag | null {
  let best: { date: string; tag: DailyTag } | null = null;
  for (const cell of items) {
    if (cell.member_id !== memberId) continue;
    if (cell.source !== "stored" || !cell.tag) continue;
    if (cell.date >= beforeDate) continue;
    if (!best || cell.date > best.date) {
      best = { date: cell.date, tag: cell.tag as DailyTag };
    }
  }
  return best?.tag ?? null;
}
