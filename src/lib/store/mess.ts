import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { isBoroKhana } from "@/lib/store/boro-khana";
import { canAssignOnDate } from "@/lib/store/daily";
import { nextISODate, todayISO } from "@/lib/date";
import type { DailyTag, User } from "@/lib/types";

export type MessEaterReason = "MS" | "FR" | "BK";

export type MessEater = User & {
  assignment_id: string;
  /**
   * Why on mess list:
   * - MS — normal mess day or BK with MS tag
   * - FR — Boro Khana guest with FR tag
   * - BK — Boro Khana guest with any other / no tag
   */
  mess_reason: MessEaterReason;
};

/** Projected duty tag for user on date (explicit or carry). */
function projectedTagOnDate(userId: string, date: string): DailyTag | null {
  const direct = getAssignment(userId, date);
  if (direct) return direct.tag;
  if (isCarrySuppressed(userId, date)) return null;
  return findPriorTag(userId, date);
}

function reasonForBkGuest(tag: DailyTag | null): MessEaterReason {
  if (tag === "MS") return "MS";
  if (tag === "FR") return "FR";
  return "BK";
}

/**
 * Who eats mess on `date`:
 * - Normal: approved + active + explicit MS
 * - Boro Khana: **all** approved + active (everyone eats)
 */
export function getMessEaters(date: string): MessEater[] {
  const { users, assignments } = getState();
  const byId = new Map(users.map((u) => [u.id, u]));

  if (isBoroKhana(date)) {
    const result: MessEater[] = [];
    for (const user of users) {
      if (user.approval_status !== "approved") continue;
      if (user.status !== "1") continue;
      if (!canAssignOnDate(user, date)) continue;
      const tag = projectedTagOnDate(user.id, date);
      const direct = getAssignment(user.id, date);
      result.push({
        ...user,
        assignment_id:
          direct?.id ?? `bk-${user.id}-${date}`,
        mess_reason: reasonForBkGuest(tag),
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: MessEater[] = [];
  const ms = assignments.filter((a) => a.date === date && a.tag === "MS");
  for (const a of ms) {
    const user = byId.get(a.user_id);
    if (!user) continue;
    if (user.approval_status !== "approved") continue;
    if (user.status !== "1") continue;
    if (!canAssignOnDate(user, date)) continue;
    result.push({ ...user, assignment_id: a.id, mess_reason: "MS" });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** approved + active with explicit tag on date (no carry). */
export function countTaggedToday(tag: DailyTag, date = todayISO()): number {
  const { users, assignments } = getState();
  const activeIds = new Set(
    users
      .filter(
        (u) =>
          u.approval_status === "approved" &&
          u.status === "1" &&
          canAssignOnDate(u, date),
      )
      .map((u) => u.id),
  );
  return assignments.filter(
    (a) => a.date === date && a.tag === tag && activeIds.has(a.user_id),
  ).length;
}

/**
 * Who holds `tag` on `date`:
 * explicit tag that day, else carry prior if same and not suppressed.
 */
export function getProjectedTagMembers(
  tag: DailyTag,
  date = nextISODate(todayISO()),
): {
  date: string;
  tag: DailyTag;
  members: User[];
  tagged: number;
  carried: number;
} {
  const { users } = getState();
  const members: User[] = [];
  let tagged = 0;
  let carried = 0;

  for (const user of users) {
    if (user.approval_status !== "approved") continue;
    if (user.status !== "1") continue;
    if (!canAssignOnDate(user, date)) continue;

    const direct = getAssignment(user.id, date);
    if (direct) {
      if (direct.tag === tag) {
        members.push(user);
        tagged += 1;
      }
      continue;
    }

    if (isCarrySuppressed(user.id, date)) continue;
    const prior = findPriorTag(user.id, date);
    if (prior === tag) {
      members.push(user);
      carried += 1;
    }
  }

  members.sort((a, b) => a.name.localeCompare(b.name));
  return { date, tag, members, tagged, carried };
}

/**
 * Who eats mess on `date` (default tomorrow):
 * MS projected, or on Boro Khana — all approved+active.
 */
export function getProjectedMessEaters(date = nextISODate(todayISO())): {
  date: string;
  eaters: User[];
  tagged: number;
  carried: number;
  /** Non-MS eaters on BK day (everyone else). */
  guests: number;
} {
  if (isBoroKhana(date)) {
    const { users } = getState();
    const eaters = users
      .filter(
        (u) =>
          u.approval_status === "approved" &&
          u.status === "1" &&
          canAssignOnDate(u, date),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const msIds = new Set(
      getProjectedTagMembers("MS", date).members.map((u) => u.id),
    );
    const guests = eaters.filter((u) => !msIds.has(u.id)).length;
    const projected = getProjectedTagMembers("MS", date);
    return {
      date,
      eaters,
      tagged: projected.tagged,
      carried: projected.carried,
      guests,
    };
  }

  const projected = getProjectedTagMembers("MS", date);
  return {
    date: projected.date,
    eaters: projected.members,
    tagged: projected.tagged,
    carried: projected.carried,
    guests: 0,
  };
}

export function countByField(eaters: User[], field: "wing" | "rank") {
  const map = new Map<string, number>();
  for (const u of eaters) {
    const key = u[field] || "—";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
