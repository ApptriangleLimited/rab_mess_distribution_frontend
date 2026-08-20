import { getState } from "@/lib/store";

export function listGuestMeals() {
  return [...(getState().guest_meals ?? [])].sort((a, b) => {
    const byTime = b.check_in_time.localeCompare(a.check_in_time);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}
