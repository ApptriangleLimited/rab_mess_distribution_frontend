import { nowISO, previousISODate } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import type { DailyAssignment, DailyTag } from "@/lib/types";

function newId() {
  return `a_${Math.random().toString(36).slice(2, 10)}`;
}

export function getAssignmentsByDate(date: string) {
  return getState().assignments.filter((a) => a.date === date);
}

export function getAssignment(userId: string, date: string) {
  return (
    getState().assignments.find(
      (a) => a.user_id === userId && a.date === date,
    ) ?? null
  );
}

export function setTag(
  userId: string,
  date: string,
  tag: DailyTag,
  updatedBy = "daily",
): DailyAssignment {
  const existing = getAssignment(userId, date);
  const ts = nowISO();

  if (existing) {
    const updated: DailyAssignment = {
      ...existing,
      tag,
      updated_by: updatedBy,
      updated_at: ts,
    };
    setState((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) =>
        a.id === existing.id ? updated : a,
      ),
      approved_dates: unmarkDate(prev.approved_dates, date),
      suppressed_carries: withoutCarry(prev.suppressed_carries, userId, date),
    }));
    return updated;
  }

  const created: DailyAssignment = {
    id: newId(),
    user_id: userId,
    date,
    tag,
    updated_by: updatedBy,
    updated_at: ts,
  };
  setState((prev) => ({
    ...prev,
    assignments: [...prev.assignments, created],
    approved_dates: unmarkDate(prev.approved_dates, date),
    suppressed_carries: withoutCarry(prev.suppressed_carries, userId, date),
  }));
  return created;
}

export function setTagBulk(
  userIds: string[],
  date: string,
  tag: DailyTag,
  updatedBy = "daily",
) {
  const ts = nowISO();
  setState((prev) => {
    const next = [...prev.assignments];
    for (const userId of userIds) {
      const idx = next.findIndex((a) => a.user_id === userId && a.date === date);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          tag,
          updated_by: updatedBy,
          updated_at: ts,
        };
      } else {
        next.push({
          id: newId(),
          user_id: userId,
          date,
          tag,
          updated_by: updatedBy,
          updated_at: ts,
        });
      }
    }
    return {
      ...prev,
      assignments: next,
      approved_dates: unmarkDate(prev.approved_dates, date),
      suppressed_carries: userIds.reduce(
        (acc, userId) => withoutCarry(acc, userId, date),
        prev.suppressed_carries ?? [],
      ),
    };
  });
  return userIds.length;
}

export function clearTag(userId: string, date: string) {
  setState((prev) => ({
    ...prev,
    assignments: prev.assignments.filter(
      (a) => !(a.user_id === userId && a.date === date),
    ),
    approved_dates: unmarkDate(prev.approved_dates, date),
    // Explicit no-tag: hide carry ghost until Approve restores
    suppressed_carries: withCarry(prev.suppressed_carries, userId, date),
  }));
}

/** Set or clear one user's tags across many dates in one store write. */
export function setTagRange(
  userId: string,
  dates: string[],
  tag: DailyTag | "",
  updatedBy = "daily",
) {
  if (dates.length === 0) return 0;
  const ts = nowISO();
  const dateSet = new Set(dates);
  setState((prev) => {
    let next = prev.assignments.filter(
      (a) => !(a.user_id === userId && dateSet.has(a.date)),
    );
    if (tag) {
      for (const date of dates) {
        next.push({
          id: newId(),
          user_id: userId,
          date,
          tag,
          updated_by: updatedBy,
          updated_at: ts,
        });
      }
    }
    let approved = prev.approved_dates ?? [];
    let suppressed = prev.suppressed_carries ?? [];
    for (const date of dates) {
      approved = unmarkDate(approved, date);
      if (tag) {
        suppressed = withoutCarry(suppressed, userId, date);
      } else {
        suppressed = withCarry(suppressed, userId, date);
      }
    }
    return {
      ...prev,
      assignments: next,
      approved_dates: approved,
      suppressed_carries: suppressed,
    };
  });
  return dates.length;
}

export function listByMonth(month: string) {
  return getState().assignments.filter((a) => a.date.startsWith(month));
}

function carryKey(userId: string, date: string) {
  return `${userId}|${date}`;
}

function unmarkDate(dates: string[] | undefined, date: string) {
  return (dates ?? []).filter((d) => d !== date);
}

function withoutCarry(
  keys: string[] | undefined,
  userId: string,
  date: string,
) {
  const k = carryKey(userId, date);
  return (keys ?? []).filter((x) => x !== k);
}

function withCarry(keys: string[] | undefined, userId: string, date: string) {
  const k = carryKey(userId, date);
  const cur = keys ?? [];
  return cur.includes(k) ? cur : [...cur, k];
}

export function isCarrySuppressed(userId: string, date: string) {
  return (getState().suppressed_carries ?? []).includes(
    carryKey(userId, date),
  );
}

export function isDateApproved(date: string) {
  return (getState().approved_dates ?? []).includes(date);
}

export function markDateApproved(date: string) {
  setState((prev) => {
    const cur = prev.approved_dates ?? [];
    if (cur.includes(date)) return prev;
    return { ...prev, approved_dates: [...cur, date] };
  });
}

/** Walk back up to `maxDays` looking for last saved tag before `date`. */
export function findPriorTag(
  userId: string,
  date: string,
  maxDays = 62,
): DailyTag | null {
  let cursor = previousISODate(date);
  for (let i = 0; i < maxDays; i++) {
    const found = getAssignment(userId, cursor);
    if (found) return found.tag;
    cursor = previousISODate(cursor);
  }
  return null;
}

/**
 * Approve day: fill empty / suppressed cells from prior tag, then mark approved.
 */
export function approveCarryForward(
  userIds: string[],
  date: string,
  updatedBy = "daily",
) {
  const ts = nowISO();
  let filled = 0;
  setState((prev) => {
    const next = [...prev.assignments];
    let suppressed = prev.suppressed_carries ?? [];

    for (const userId of userIds) {
      const idx = next.findIndex((a) => a.user_id === userId && a.date === date);
      const suppressedHere = suppressed.includes(carryKey(userId, date));

      // Already has saved tag and not an explicit clear → skip
      if (idx >= 0 && !suppressedHere) continue;

      let prior: DailyTag | null = null;
      let cursor = previousISODate(date);
      for (let i = 0; i < 62; i++) {
        const stored = next.find(
          (a) => a.user_id === userId && a.date === cursor,
        );
        if (stored) {
          prior = stored.tag;
          break;
        }
        cursor = previousISODate(cursor);
      }
      if (!prior) {
        suppressed = withoutCarry(suppressed, userId, date);
        continue;
      }

      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          tag: prior,
          updated_by: updatedBy,
          updated_at: ts,
        };
      } else {
        next.push({
          id: newId(),
          user_id: userId,
          date,
          tag: prior,
          updated_by: updatedBy,
          updated_at: ts,
        });
      }
      suppressed = withoutCarry(suppressed, userId, date);
      filled += 1;
    }

    const approved = prev.approved_dates ?? [];
    return {
      ...prev,
      assignments: next,
      suppressed_carries: suppressed,
      approved_dates: approved.includes(date) ? approved : [...approved, date],
    };
  });
  return filled;
}
