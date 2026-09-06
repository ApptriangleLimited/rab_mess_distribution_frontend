import { nowISO, previousISODate, todayISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import type {
  ApprovalStatus,
  DailyTag,
  InactiveSpan,
  User,
  UserStatus,
} from "@/lib/types";

export const MFR_TAG = "MFR" as const;

/** After Daily assigns MFR, the member stays MFR while active. */
export function isMfrLocked(user: Pick<User, "default_tag">): boolean {
  return (user.default_tag ?? "").toUpperCase() === MFR_TAG;
}

export function isMfrTag(tag: DailyTag | "" | undefined): boolean {
  return (tag ?? "").toUpperCase() === MFR_TAG;
}

/**
 * True for dates inside an inactive stretch (from deactivate until
 * the day before they are activated again).
 */
export function isUserInactiveOnDate(
  user: Pick<User, "status" | "inactive_spans"> & { joining_date?: string },
  date: string,
): boolean {
  const join = (user.joining_date ?? "").trim();
  if (join && date < join) {
    return true;
  }
  const spans = user.inactive_spans ?? [];
  for (const span of spans) {
    if (!span?.from) continue;
    if (date < span.from) continue;
    if (span.to && date > span.to) continue;
    return true;
  }
  if (user.status !== "1") {
    return true;
  }
  return false;
}

/**
 * False when the date is before joining_date, in an inactive stretch,
 * or after out_date (out day itself still allowed).
 */
export function canAssignOnDate(
  user: Pick<User, "out_date" | "status" | "inactive_spans"> & {
    joining_date?: string;
  },
  date: string,
): boolean {
  const join = (user.joining_date ?? "").trim();
  if (join && date < join) return false;
  if (isUserInactiveOnDate(user, date)) return false;
  const out = (user.out_date ?? "").trim();
  if (out && date > out) return false;
  return true;
}

export function applyStatusToSpans(
  spans: InactiveSpan[] | undefined,
  status: UserStatus,
  joiningDate?: string,
): InactiveSpan[] {
  const today = todayISO();
  const next = [...(spans ?? [])];
  if (status === "0") {
    if (!next.some((s) => !s.to)) {
      const fromDate =
        joiningDate && joiningDate < today ? joiningDate : today;
      next.push({ from: fromDate, to: null });
    }
    return next;
  }
  const yesterday = previousISODate(today);
  const hasOpenSpan = next.some((s) => !s.to);
  if (!hasOpenSpan) {
    const fromDate =
      joiningDate && joiningDate <= yesterday
        ? joiningDate
        : next.length
          ? yesterday
          : "1970-01-01";
    if (fromDate <= yesterday) {
      next.push({ from: fromDate, to: yesterday });
    }
    return next;
  }
  return next.flatMap((span) => {
    if (span.to) return [span];
    if (span.from > yesterday) {
      return [];
    }
    return [{ ...span, to: yesterday }];
  });
}

function patchUser(
  id: string,
  patch: Partial<Pick<User, "approval_status" | "status">>,
): User | null {
  const existing = getState().users.find((u) => u.id === id);
  if (!existing) return null;
  const statusChanged =
    patch.status !== undefined && patch.status !== existing.status;
  const inactive_spans = statusChanged
    ? applyStatusToSpans(existing.inactive_spans, patch.status!, existing.joining_date)
    : (existing.inactive_spans ?? []);
  const updated: User = {
    ...existing,
    ...patch,
    inactive_spans,
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? updated : u)),
    assignments: prev.assignments.filter(
      (a) => !(a.user_id === id && isUserInactiveOnDate(updated, a.date)),
    ),
  }));
  return updated;
}

export function listPendingUsers() {
  return getState().users.filter((u) => u.approval_status === "pending");
}

export function listApprovedUsers(opts?: { includeInactive?: boolean }) {
  return getState().users.filter((u) => {
    if (u.approval_status !== "approved") return false;
    if (!opts?.includeInactive && u.status !== "1") return false;
    return true;
  });
}

export function approveUser(id: string) {
  return patchUser(id, { approval_status: "approved", status: "1" });
}

export function rejectUser(id: string) {
  return patchUser(id, { approval_status: "rejected" });
}

export function endEntry(id: string) {
  return patchUser(id, { approval_status: "ended", status: "0" });
}

export function setUserStatus(id: string, status: UserStatus) {
  return patchUser(id, { status });
}

export function setApprovalStatus(id: string, approval_status: ApprovalStatus) {
  return patchUser(id, { approval_status });
}
