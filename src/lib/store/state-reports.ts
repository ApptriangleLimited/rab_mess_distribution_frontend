import { nowISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { isBoroKhana } from "@/lib/store/boro-khana";
import { canAssignOnDate } from "@/lib/store/daily";
import { getMessEaters } from "@/lib/store/mess";
import { getSessionFromStorage } from "@/lib/session";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import type {
  DailyStateReport,
  DailyTag,
  StateReportMember,
  StateReportStatus,
} from "@/lib/types";

function newId() {
  return `sr_${Math.random().toString(36).slice(2, 10)}`;
}

function actorLabel(fallback = "daily") {
  const session = getSessionFromStorage();
  if (!session) return fallback;
  return `${session.role}:${session.name}`;
}

function projectedTag(userId: string, date: string): DailyTag | "" {
  const direct = getAssignment(userId, date);
  if (direct) return direct.tag;
  if (isCarrySuppressed(userId, date)) return "";
  return findPriorTag(userId, date) ?? "";
}

/**
 * Live draft snapshot for `date` (not persisted).
 * Includes approved + active members who canAssignOnDate.
 */
export function buildDailyStateReportDraft(date: string): Omit<
  DailyStateReport,
  "id" | "status" | "submitted_at" | "submitted_by" | "reviewed_at" | "reviewed_by" | "note"
> {
  const { users } = getState();
  const bk = isBoroKhana(date);
  const eaters = getMessEaters(date);
  const eaterReason = new Map(
    eaters.map((e) => [e.id, e.mess_reason] as const),
  );

  const active = users
    .filter(
      (u) =>
        u.approval_status === "approved" &&
        u.status === "1" &&
        isCockpitMember(u) &&
        canAssignOnDate(u, date),
    )
    .sort(compareUsers);

  const by_tag: Partial<Record<DailyTag, number>> = {};
  const members: StateReportMember[] = active.map((u) => {
    const tag = projectedTag(u.id, date);
    if (tag) by_tag[tag] = (by_tag[tag] ?? 0) + 1;
    return {
      user_id: u.id,
      tag,
      mess_reason: bk ? (eaterReason.get(u.id) ?? null) : null,
      name: u.name,
      rab_id: u.rab_id,
      rank: u.rank,
      wing: u.wing,
    };
  });

  return {
    date,
    boro_khana: bk,
    members,
    totals: {
      active: members.length,
      by_tag,
      mess_eaters: eaters.length,
    },
  };
}

/** Pending report for date if any. */
export function getPendingStateReportForDate(
  date: string,
): DailyStateReport | null {
  return (
    (getState().state_reports ?? []).find(
      (r) => r.date === date && r.status === "pending",
    ) ?? null
  );
}

export function listStateReports(): DailyStateReport[] {
  return [...(getState().state_reports ?? [])].sort((a, b) =>
    b.submitted_at.localeCompare(a.submitted_at),
  );
}

export function listPendingStateReports(): DailyStateReport[] {
  return listStateReports().filter((r) => r.status === "pending");
}

export function getStateReport(id: string): DailyStateReport | null {
  return (getState().state_reports ?? []).find((r) => r.id === id) ?? null;
}

/**
 * Build draft + persist as pending.
 * Replaces existing pending for same date (R3).
 * Returns submitted report.
 */
export function submitStateReport(date: string): DailyStateReport {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date");
  }
  const draft = buildDailyStateReportDraft(date);
  const report: DailyStateReport = {
    ...draft,
    id: newId(),
    status: "pending",
    submitted_at: nowISO(),
    submitted_by: actorLabel("daily"),
  };

  setState((prev) => {
    const cur = prev.state_reports ?? [];
    const next = cur.filter(
      (r) => !(r.date === date && r.status === "pending"),
    );
    return { ...prev, state_reports: [report, ...next] };
  });

  return report;
}

export function approveStateReport(id: string): DailyStateReport | null {
  return setReportStatus(id, "approved");
}

export function rejectStateReport(
  id: string,
  note?: string,
): DailyStateReport | null {
  return setReportStatus(id, "rejected", note);
}

function setReportStatus(
  id: string,
  status: Extract<StateReportStatus, "approved" | "rejected">,
  note?: string,
): DailyStateReport | null {
  let updated: DailyStateReport | null = null;
  const ts = nowISO();
  const by = actorLabel("admin");

  setState((prev) => {
    const cur = prev.state_reports ?? [];
    const next = cur.map((r) => {
      if (r.id !== id || r.status !== "pending") return r;
      updated = {
        ...r,
        status,
        reviewed_at: ts,
        reviewed_by: by,
        note: status === "rejected" ? (note ?? r.note) : r.note,
      };
      return updated;
    });
    if (!updated) return prev;
    return { ...prev, state_reports: next };
  });

  return updated;
}
