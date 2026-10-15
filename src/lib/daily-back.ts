/** Default when Daily opened a member from the roster list. */
export const DAILY_ROSTER_HREF = "/daily/roster";

/** Daily RR (cockpit) — name links should return here. */
export const DAILY_RR_HREF = "/daily/tags";

/** Only allow in-app Daily paths so `back` cannot leave /daily. */
export function safeDailyBack(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/daily")) return DAILY_ROSTER_HREF;
  if (value.startsWith("//") || value.includes("://")) return DAILY_ROSTER_HREF;
  return value;
}

export function dailyUserHref(id: string, back?: string): string {
  const path = `/daily/users/${encodeURIComponent(id)}`;
  const next = back ? safeDailyBack(back) : DAILY_ROSTER_HREF;
  if (next === DAILY_ROSTER_HREF) return path;
  return `${path}?back=${encodeURIComponent(next)}`;
}

export function dailyUserEditHref(id: string, back?: string): string {
  const path = `/daily/users/${encodeURIComponent(id)}/edit`;
  const next = back ? safeDailyBack(back) : DAILY_ROSTER_HREF;
  if (next === DAILY_ROSTER_HREF) return path;
  return `${path}?back=${encodeURIComponent(next)}`;
}
