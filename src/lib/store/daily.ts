import { nextISODate, nowISO, previousISODate, todayISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import type {
  ApprovalStatus,
  DailyAssignment,
  DailyTag,
  InactiveSpan,
  User,
  UserStatus,
} from "@/lib/types";

export const MFR_TAG = "MFR" as const;
export const FR_TAG = "FR" as const;
export const JL_TAG = "JL" as const;

/** After Daily assigns MFR, the member stays MFR while active. */
export function isMfrLocked(user: Pick<User, "default_tag">): boolean {
  return (user.default_tag ?? "").trim().toUpperCase() === MFR_TAG;
}

export function isMfrTag(tag: DailyTag | "" | undefined): boolean {
  return (tag ?? "").toUpperCase() === MFR_TAG;
}

export function isFrTag(tag: DailyTag | "" | undefined): boolean {
  return (tag ?? "").toUpperCase() === FR_TAG;
}

export function isJlTag(tag: DailyTag | "" | undefined): boolean {
  return (tag ?? "").toUpperCase() === JL_TAG;
}

/** Daily RR: MFR can only move to JL. */
export function canWriteMfrLockedTag(tag: DailyTag | "" | undefined): boolean {
  return isJlTag(tag);
}

/** Daily cannot paint MFR onto any other tag. MFR cells may stay MFR or become JL. */
export function canDailyWriteTag(
  user: Pick<User, "default_tag">,
  tag: DailyTag | "" | undefined,
): boolean {
  if (!tag) return !isMfrLocked(user);
  if (isMfrTag(tag)) return isMfrLocked(user);
  if (isMfrLocked(user)) return canWriteMfrLockedTag(tag);
  return true;
}

/** Tag picker for Daily RR / Daily default-tag. */
export function dailyRrAllowedTags(
  mfrLocked: boolean,
  allTags: readonly DailyTag[],
): DailyTag[] {
  if (mfrLocked) return [JL_TAG];
  return allTags.filter((code) => !isMfrTag(code));
}

/**
 * True for dates inside an inactive stretch (from deactivate until
 * the day before they are activated again).
 */
/** First Daily RR day — the member joining date. Empty = no join lock. */
export function rosterStart(
  user: { joining_date?: string; duty_start?: string },
): string {
  return (user.joining_date ?? "").trim();
}

export function isBeforeJoin(
  user: { joining_date?: string },
  date: string,
): boolean {
  const start = rosterStart(user);
  return Boolean(start && date < start);
}

export function isUserInactiveOnDate(
  user: Pick<User, "status" | "inactive_spans"> & {
    joining_date?: string;
    duty_start?: string;
    jl_end_date?: string;
  },
  date: string,
): boolean {
  const spans = user.inactive_spans ?? [];
  const active = user.status === "1";
  for (const span of spans) {
    if (!span?.from) continue;
    if (date < span.from) continue;
    // An open span means "still inactive". Ignore it when the member is Active.
    if (!span.to) {
      if (active) continue;
      return true;
    }
    if (date > span.to) continue;
    return true;
  }
  const jlEnd = (user.jl_end_date ?? "").trim();
  if (jlEnd && date > jlEnd) {
    return true;
  }
  if (user.status !== "1") {
    return spans.length === 0;
  }
  return false;
}

/** Every day in the range is before join, inactive, or after out. */
export function isRangeFullyBlocked(
  user: Parameters<typeof canAssignOnDate>[0],
  dates: readonly string[],
): boolean {
  if (!dates.length) return user.status !== "1";
  return dates.every((date) => !canAssignOnDate(user, date));
}

/**
 * Daily RR roster for a month.
 * Active (assignable on any day) members always stay.
 * A member who is inactive for the whole range stays only when that range
 * already has a tag for them.
 * `statusFilter` "0" is the Inactive switch: only those tagged inactive rows.
 */
export function dailyRosterVisible(
  user: Parameters<typeof canAssignOnDate>[0],
  dates: readonly string[],
  hasTag: boolean,
  statusFilter: "0" | "1" = "1",
): boolean {
  const blocked = isRangeFullyBlocked(user, dates);
  if (statusFilter === "0") {
    return (user.status === "0" || blocked) && hasTag;
  }
  if (!blocked) return true;
  return hasTag;
}

/**
 * False when the date is before joining_date, in an inactive stretch,
 * or after out_date (out day itself still allowed).
 */
export function canAssignOnDate(
  user: Pick<User, "out_date" | "status" | "inactive_spans"> & {
    joining_date?: string;
    duty_start?: string;
  },
  date: string,
): boolean {
  if (isBeforeJoin(user, date)) return false;
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
      next.push({ from: today, to: null });
    }
    return next;
  }
  const yesterday = previousISODate(today);
  const hasOpenSpan = next.some((s) => !s.to);
  if (!hasOpenSpan) {
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
    jl_end_date: patch.status === "1" ? "" : existing.jl_end_date,
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
  const updated = patchUser(id, { approval_status: "approved", status: "1" });
  if (!updated) return null;
  const today = todayISO();
  const withDuty: User = { ...updated, duty_start: today };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? withDuty : u)),
    assignments: prev.assignments.filter(
      (a) =>
        !(
          a.user_id === id &&
          updated.joining_date &&
          a.date < updated.joining_date
        ),
    ),
  }));
  return withDuty;
}

export function rejectUser(id: string) {
  const existing = getState().users.find((u) => u.id === id) ?? null;
  if (!existing) return null;
  setState((prev) => ({
    ...prev,
    users: prev.users.filter((u) => u.id !== id),
    assignments: prev.assignments.filter((a) => a.user_id !== id),
    tag_requests: prev.tag_requests.filter((r) => r.user_id !== id),
  }));
  return existing;
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

export function lastJlDateForUser(
  assignments: DailyAssignment[],
  userId: string,
): string {
  let last = "";
  for (const row of assignments) {
    if (row.user_id === userId && isJlTag(row.tag) && row.date > last) {
      last = row.date;
    }
  }
  return last;
}

function ensureOpenInactiveFrom(
  spans: InactiveSpan[] | undefined,
  from: string,
): InactiveSpan[] {
  const next = [...(spans ?? [])];
  if (next.some((span) => !span.to)) return next;
  return [...next, { from, to: null }];
}

export function syncUserAfterJl(
  user: User,
  lastJl: string,
  asOfDate = todayISO(),
): User {
  if (!lastJl) {
    if (!user.jl_end_date) return user;
    return { ...user, jl_end_date: "" };
  }
  if (asOfDate > lastJl) {
    if (user.status === "0" && !user.jl_end_date) return user;
    const from = nextISODate(lastJl);
    return {
      ...user,
      jl_end_date: "",
      status: "0",
      inactive_spans: ensureOpenInactiveFrom(user.inactive_spans, from),
      updated_at: nowISO(),
    };
  }
  if (user.jl_end_date === lastJl) return user;
  return { ...user, jl_end_date: lastJl };
}

export function syncUsersAfterJl(
  users: User[],
  assignments: DailyAssignment[],
  userIds: Iterable<string>,
  asOfDate = todayISO(),
): User[] {
  const ids = new Set(userIds);
  if (ids.size === 0) return users;
  return users.map((user) => {
    if (!ids.has(user.id)) return user;
    return syncUserAfterJl(
      user,
      lastJlDateForUser(assignments, user.id),
      asOfDate,
    );
  });
}

/** Flip members whose last JL day is already over. */
export function applyDueJlInactivations(asOfDate = todayISO()) {
  const prev = getState();
  const touched = new Set<string>();
  for (const user of prev.users) {
    if (user.jl_end_date) touched.add(user.id);
  }
  for (const row of prev.assignments) {
    if (isJlTag(row.tag)) touched.add(row.user_id);
  }
  if (touched.size === 0) return;
  const users = syncUsersAfterJl(
    prev.users,
    prev.assignments,
    touched,
    asOfDate,
  );
  if (users.every((user, i) => user === prev.users[i])) return;
  const byId = new Map(users.map((user) => [user.id, user]));
  setState({
    ...prev,
    users,
    assignments: prev.assignments.filter((row) => {
      const user = byId.get(row.user_id);
      return !user || !isUserInactiveOnDate(user, row.date);
    }),
  });
}
