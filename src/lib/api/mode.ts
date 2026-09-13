function envFlag(value: string | undefined): boolean {
  const raw = value?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/** `NEXT_PUBLIC_USE_API=true` → FastAPI. Anything else → localStorage demo, no API. */
export function isApiEnabled(): boolean {
  return envFlag(process.env.NEXT_PUBLIC_USE_API);
}

/** Local FastAPI when full API mode or a backend URL is set. */
export function isCcApiEnabled(): boolean {
  return isApiEnabled() || Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}

export function isDailyApiEnabled(): boolean {
  return isCcApiEnabled();
}

export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}
