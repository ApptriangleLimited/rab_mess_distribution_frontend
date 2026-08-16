import { getState, setState } from "@/lib/store";

/** True when `date` is marked Boro Khana. */
export function isBoroKhana(date: string): boolean {
  if (!date) return false;
  return (getState().boro_khana_dates ?? []).includes(date);
}

/** List all Boro Khana ISO dates (sorted). */
export function listBoroKhanaDates(): string[] {
  return [...(getState().boro_khana_dates ?? [])].sort();
}

/**
 * Mark or clear Boro Khana for a calendar day.
 * Persists via store → localStorage (survives reload).
 */
export function setBoroKhana(date: string, on: boolean): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  setState((prev) => {
    const cur = prev.boro_khana_dates ?? [];
    const has = cur.includes(date);
    if (on && has) return prev;
    if (!on && !has) return prev;
    return {
      ...prev,
      boro_khana_dates: on
        ? [...cur, date].sort()
        : cur.filter((d) => d !== date),
    };
  });
}

/** Toggle Boro Khana for `date`. Returns new on/off. */
export function toggleBoroKhana(date: string): boolean {
  const next = !isBoroKhana(date);
  setBoroKhana(date, next);
  return next;
}
