function envFlag(value: string | undefined): boolean {
  const raw = value?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/** `NEXT_PUBLIC_USE_API=true` → FastAPI. Anything else → localStorage demo, no API. */
export function isApiEnabled(): boolean {
  return envFlag(process.env.NEXT_PUBLIC_USE_API);
}

/** Docker FastAPI when full API mode or a backend URL is set. */
export function isCcApiEnabled(): boolean {
  return isApiEnabled() || Boolean(apiBaseUrl());
}

export function isDailyApiEnabled(): boolean {
  return isCcApiEnabled();
}

function configuredApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

function isLocalHostname(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function pointsAtLocalhost(url: string): boolean {
  if (!url) return true;
  return /localhost|127\.0\.0\.1|::1/.test(url);
}

/**
 * Browser API root.
 * Local bun/dev may use `http://localhost:8000`.
 * On a real host (e.g. https://ms.apptriangle.com) never call localhost —
 * use same-origin `/api` so nginx/Next can proxy to FastAPI.
 */
export function apiBaseUrl(): string {
  const configured = configuredApiBase();
  if (typeof window !== "undefined") {
    if (!isLocalHostname(window.location.hostname) && pointsAtLocalhost(configured)) {
      return "";
    }
  }
  return configured;
}
