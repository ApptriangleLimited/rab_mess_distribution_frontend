import { getState } from "@/lib/store";
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

export function countByField(eaters: User[], field: "wing" | "rank") {
  const map = new Map<string, number>();
  for (const u of eaters) {
    const key = u[field] || "—";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
