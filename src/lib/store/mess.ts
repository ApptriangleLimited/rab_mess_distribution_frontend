import { getState } from "@/lib/store";
import {
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
} from "@/lib/store/assignments";
import { nextISODate, todayISO } from "@/lib/date";
import type { User } from "@/lib/types";

export type MessEater = User & { assignment_id: string };

/** approved + active + MS tag for date */
export function getMessEaters(date: string): MessEater[] {
  const { users, assignments } = getState();
  const ms = assignments.filter((a) => a.date === date && a.tag === "MS");
  const result: MessEater[] = [];
  for (const a of ms) {
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    if (user.approval_status !== "approved") continue;
    if (user.status !== "1") continue;
    result.push({ ...user, assignment_id: a.id });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Who eats mess on `date` (default tomorrow):
 * explicit MS that day, else carry prior tag if MS and not suppressed.
 */
export function getProjectedMessEaters(date = nextISODate(todayISO())): {
  date: string;
  eaters: User[];
  tagged: number;
  carried: number;
} {
  const { users } = getState();
  const eaters: User[] = [];
  let tagged = 0;
  let carried = 0;

  for (const user of users) {
    if (user.approval_status !== "approved") continue;
    if (user.status !== "1") continue;

    const direct = getAssignment(user.id, date);
    if (direct) {
      if (direct.tag === "MS") {
        eaters.push(user);
        tagged += 1;
      }
      continue;
    }

    if (isCarrySuppressed(user.id, date)) continue;
    const prior = findPriorTag(user.id, date);
    if (prior === "MS") {
      eaters.push(user);
      carried += 1;
    }
  }

  eaters.sort((a, b) => a.name.localeCompare(b.name));
  return { date, eaters, tagged, carried };
}

export function countByField(eaters: User[], field: "wing" | "rank") {
  const map = new Map<string, number>();
  for (const u of eaters) {
    const key = u[field] || "—";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
