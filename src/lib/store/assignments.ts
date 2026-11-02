import { isDailyDateEditable, nowISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import {
  canAssignOnDate,
  isUserInactiveOnDate,
  syncUsersAfterJl,
} from "@/lib/store/daily";
import { isCockpitMember } from "@/lib/store/users";
import { isTrgTag, resolveTrgTone } from "@/lib/trg-tone";
import type { DailyAssignment, DailyTag, TrgTone, User } from "@/lib/types";

export type TagWriteMeta = {
  trg_tone?: TrgTone;
};

function trgToneForWrite(
  userId: string,
  tag: DailyTag | "",
  meta?: TagWriteMeta,
): TrgTone | undefined {
  if (!isTrgTag(tag)) return undefined;
  if (meta?.trg_tone === "black" || meta?.trg_tone === "red") {
    return meta.trg_tone;
  }
  return resolveTrgTone(findUser(userId)?.force ?? "");
}

function newId() {
  return `a_${Math.random().toString(36).slice(2, 10)}`;
}

function findUser(userId: string): User | undefined {
  return getState().users.find((u) => u.id === userId);
}

function isAssignable(userId: string, date: string): boolean {
  const user = findUser(userId);
  if (!user) return false;
  return canAssignOnDate(user, date);
}

function canWriteTag(
  userId: string,
  date: string,
  tag: DailyTag | "",
): boolean {
  if (!isDailyDateEditable(date)) return false;
  const user = findUser(userId);
  if (!user || !isCockpitMember(user) || !canAssignOnDate(user, date)) return false;
  return true;
}

/** Unlock MFR when Daily paints JL. */
function withJlSync(
  users: User[],
  assignments: DailyAssignment[],
  userIds: string[],
): { users: User[]; assignments: DailyAssignment[] } {
  const nextUsers = syncUsersAfterJl(users, assignments, userIds);
  if (nextUsers.every((user, i) => user === users[i])) {
    return { users: nextUsers, assignments };
  }
  const byId = new Map(nextUsers.map((user) => [user.id, user]));
  return {
    users: nextUsers,
    assignments: assignments.filter((row) => {
      const user = byId.get(row.user_id);
      return !user || !isUserInactiveOnDate(user, row.date);
    }),
  };
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
  meta?: TagWriteMeta,
): DailyAssignment | null {
  if (!canWriteTag(userId, date, tag)) {
    return getAssignment(userId, date);
  }
  const existing = getAssignment(userId, date);
  const ts = nowISO();
  const trg_tone = trgToneForWrite(userId, tag, meta);

  if (existing) {
    const updated: DailyAssignment = {
      ...existing,
      tag,
      trg_tone,
      updated_by: updatedBy,
      updated_at: ts,
    };
    if (!trg_tone) delete updated.trg_tone;
    setState((prev) => {
      const assignments = prev.assignments.map((a) =>
        a.id === existing.id ? updated : a,
      );
      const synced = withJlSync(prev.users, assignments, [userId]);
      return {
        ...prev,
        ...synced,
        approved_dates: unmarkDate(prev.approved_dates, date),
        suppressed_carries: withoutCarry(prev.suppressed_carries, userId, date),
      };
    });
    return updated;
  }

  const created: DailyAssignment = {
    id: newId(),
    user_id: userId,
    date,
    tag,
    trg_tone,
    updated_by: updatedBy,
    updated_at: ts,
  };
  if (!trg_tone) delete created.trg_tone;
  setState((prev) => {
    const assignments = [...prev.assignments, created];
    const synced = withJlSync(prev.users, assignments, [userId]);
    return {
      ...prev,
      ...synced,
      approved_dates: unmarkDate(prev.approved_dates, date),
      suppressed_carries: withoutCarry(prev.suppressed_carries, userId, date),
    };
  });
  return created;
}

export function setTagBulk(
  userIds: string[],
  date: string,
  tag: DailyTag,
  updatedBy = "daily",
  meta?: TagWriteMeta,
) {
  const ts = nowISO();
  const eligible = userIds.filter((id) => canWriteTag(id, date, tag));
  if (eligible.length === 0) return 0;
  setState((prev) => {
    const next = [...prev.assignments];
    for (const userId of eligible) {
      const trg_tone = trgToneForWrite(userId, tag, meta);
      const idx = next.findIndex((a) => a.user_id === userId && a.date === date);
      if (idx >= 0) {
        const row: DailyAssignment = {
          ...next[idx],
          tag,
          trg_tone,
          updated_by: updatedBy,
          updated_at: ts,
        };
        if (!trg_tone) delete row.trg_tone;
        next[idx] = row;
      } else {
        const row: DailyAssignment = {
          id: newId(),
          user_id: userId,
          date,
          tag,
          trg_tone,
          updated_by: updatedBy,
          updated_at: ts,
        };
        if (!trg_tone) delete row.trg_tone;
        next.push(row);
      }
    }
    const synced = withJlSync(prev.users, next, eligible);
    return {
      ...prev,
      ...synced,
      approved_dates: unmarkDate(prev.approved_dates, date),
      suppressed_carries: eligible.reduce(
        (acc, userId) => withoutCarry(acc, userId, date),
        prev.suppressed_carries ?? [],
      ),
    };
  });
  return eligible.length;
}

export function clearTag(userId: string, date: string) {
  const fill = findUser(userId)?.default_tag;
  if (!fill) return;
  setTag(userId, date, fill, "daily");
}

/** Set or clear one user's tags across many dates in one store write. */
export function setTagRange(
  userId: string,
  dates: string[],
  tag: DailyTag | "",
  updatedBy = "daily",
  meta?: TagWriteMeta,
) {
  const allowed = dates.filter((d) => canWriteTag(userId, d, tag));
  if (allowed.length === 0) return 0;
  const ts = nowISO();
  const dateSet = new Set(allowed);
  const writeTag = tag || findUser(userId)?.default_tag || "";
  if (!writeTag) return 0;
  const trg_tone = trgToneForWrite(userId, writeTag, tag ? meta : undefined);
  setState((prev) => {
    const next = prev.assignments.filter(
      (a) => !(a.user_id === userId && dateSet.has(a.date)),
    );
    for (const date of allowed) {
      const row: DailyAssignment = {
        id: newId(),
        user_id: userId,
        date,
        tag: writeTag,
        trg_tone,
        updated_by: updatedBy,
        updated_at: ts,
      };
      if (!trg_tone) delete row.trg_tone;
      next.push(row);
    }
    let approved = prev.approved_dates ?? [];
    let suppressed = prev.suppressed_carries ?? [];
    for (const date of allowed) {
      approved = unmarkDate(approved, date);
      suppressed = withoutCarry(suppressed, userId, date);
    }
    const synced = withJlSync(prev.users, next, [userId]);
    return {
      ...prev,
      ...synced,
      approved_dates: approved,
      suppressed_carries: suppressed,
    };
  });
  return allowed.length;
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

/**
 * Tags for a Daily RR range.
 * A saved tag covers only that day. Empty days show the member's default tag,
 * including after a temporary range such as CL. Inactive days keep only a saved tag.
 */
export function projectRangeCarry(
  users: User[],
  dates: string[],
  assignments: DailyAssignment[],
  suppressed: readonly string[] = [],
): DailyAssignment[] {
  if (!dates.length || !users.length) return [];
  const byKey = new Map<string, DailyAssignment>();
  for (const row of assignments) {
    if (!row.tag) continue;
    byKey.set(`${row.user_id}|${row.date}`, row);
  }
  const suppressedSet = new Set(suppressed);
  const out: DailyAssignment[] = [];
  for (const user of users) {
    const fallback = user.default_tag || null;
    for (const date of dates) {
      const stored = byKey.get(`${user.id}|${date}`);
      if (stored?.tag) {
        out.push(stored);
        continue;
      }
      if (suppressedSet.has(`${user.id}|${date}`)) continue;
      if (!canAssignOnDate(user, date)) continue;
      if (!fallback) continue;
      out.push({
        id: `carry|${user.id}|${date}`,
        user_id: user.id,
        date,
        tag: fallback,
        updated_by: "carry",
        updated_at: "",
      });
    }
  }
  return out;
}

/** Empty-cell projection: member `default_tag` (not last painted tag). */
export function findPriorTag(
  userId: string,
  _date?: string,
  _maxDays = 62,
): DailyTag | null {
  const user = findUser(userId);
  if (!user?.default_tag) return null;
  return user.default_tag;
}

/**
 * Approve day: fill empty / suppressed cells from member default_tag, then lock.
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

    const usersById = new Map(prev.users.map((u) => [u.id, u]));

    for (const userId of userIds) {
      const user = usersById.get(userId);
      if (!user || !canAssignOnDate(user, date)) continue;

      const idx = next.findIndex((a) => a.user_id === userId && a.date === date);
      const suppressedHere = suppressed.includes(carryKey(userId, date));

      // Already has saved tag and not an explicit clear → skip
      if (idx >= 0 && !suppressedHere) continue;

      const fillTag = user.default_tag || null;
      if (!fillTag) {
        suppressed = withoutCarry(suppressed, userId, date);
        continue;
      }

      const trg_tone = trgToneForWrite(userId, fillTag);
      if (idx >= 0) {
        const row: DailyAssignment = {
          ...next[idx],
          tag: fillTag,
          trg_tone,
          updated_by: updatedBy,
          updated_at: ts,
        };
        if (!trg_tone) delete row.trg_tone;
        next[idx] = row;
      } else {
        const row: DailyAssignment = {
          id: newId(),
          user_id: userId,
          date,
          tag: fillTag,
          trg_tone,
          updated_by: updatedBy,
          updated_at: ts,
        };
        if (!trg_tone) delete row.trg_tone;
        next.push(row);
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

/**
 * Auto-apply member default_tag to empty cells for `date`.
 * Skips explicit clears (suppressed). Does not rewrite saved tags.
 */
export function autoApplyCarryForward(
  userIds: string[],
  date: string,
  updatedBy = "daily",
) {
  const prev = getState();
  const next = [...prev.assignments];
  const suppressed = prev.suppressed_carries ?? [];
  const ts = nowISO();
  let filled = 0;

  const usersById = new Map(prev.users.map((u) => [u.id, u]));

  for (const userId of userIds) {
    const user = usersById.get(userId);
    if (!user || !isCockpitMember(user) || !canAssignOnDate(user, date)) continue;

    const idx = next.findIndex((a) => a.user_id === userId && a.date === date);
    if (idx >= 0) continue;
    if (suppressed.includes(carryKey(userId, date))) continue;

    const fillTag = user.default_tag;
    if (!fillTag) continue;

    const trg_tone = trgToneForWrite(userId, fillTag);
    const row: DailyAssignment = {
      id: newId(),
      user_id: userId,
      date,
      tag: fillTag,
      trg_tone,
      updated_by: updatedBy,
      updated_at: ts,
    };
    if (!trg_tone) delete row.trg_tone;
    next.push(row);
    filled += 1;
  }

  if (filled === 0) return 0;
  setState({ ...prev, assignments: next });
  return filled;
}
