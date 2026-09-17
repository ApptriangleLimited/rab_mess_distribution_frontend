import { canAssignOnDate, isMfrLocked, MFR_TAG } from "@/lib/store/daily";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";

/**
 * Tag that counts toward Daily RR totals for one member-day.
 * Stored paints always count. Default-tag carry counts only through today
 * (future ghosts stay preview-only and must not inflate totals).
 */
export function registerCountedTag(
  user: User,
  date: string,
  stored: DailyTag | undefined,
  suppressed: boolean,
  today: string,
): DailyTag | "" {
  if (!canAssignOnDate(user, date)) return stored ?? "";
  if (isMfrLocked(user)) return MFR_TAG;
  if (stored) return stored;
  if (suppressed) return "";
  if (date > today) return "";
  return user.default_tag || "";
}

export function countRegisterTags(
  users: User[],
  dates: string[],
  assignments: DailyAssignment[],
  suppressed: readonly string[],
  today: string,
): {
  counts: Record<string, number>;
  memberIds: Map<string, Set<string>>;
  totalDays: number;
} {
  const byUserDate = new Map<string, DailyTag>();
  for (const row of assignments) {
    byUserDate.set(`${row.user_id}|${row.date}`, row.tag);
  }
  const suppressedSet = new Set(suppressed);
  const counts: Record<string, number> = {};
  const memberIds = new Map<string, Set<string>>();
  let totalDays = 0;

  for (const user of users) {
    for (const date of dates) {
      const tag = registerCountedTag(
        user,
        date,
        byUserDate.get(`${user.id}|${date}`),
        suppressedSet.has(`${user.id}|${date}`),
        today,
      );
      if (!tag) continue;
      counts[tag] = (counts[tag] ?? 0) + 1;
      let ids = memberIds.get(tag);
      if (!ids) {
        ids = new Set();
        memberIds.set(tag, ids);
      }
      ids.add(user.id);
      totalDays += 1;
    }
  }

  return { counts, memberIds, totalDays };
}
