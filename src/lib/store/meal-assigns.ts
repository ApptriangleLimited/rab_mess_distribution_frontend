import { getState } from "@/lib/store";
import type { MealAssign, MealAssignStatus } from "@/lib/types";

export function listMealAssigns(): MealAssign[] {
  return [...(getState().meal_assigns ?? [])].sort((a, b) => {
    const byTime = b.check_in_time.localeCompare(a.check_in_time);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

export function isMealAssignStatus(
  value: string,
): value is `${MealAssignStatus}` {
  return value === "1" || value === "2";
}
