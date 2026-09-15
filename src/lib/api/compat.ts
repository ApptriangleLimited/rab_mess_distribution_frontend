/** Older hosts (e.g. api.ms.apptriangle.com) have login but not every current route. */

import { apiBaseUrl } from "@/lib/api/mode";

export type ApiFeature = "snapshot" | "tag-requests" | "member-get";

const STORAGE_KEY = "rab.api.missing";
const missing = new Set<ApiFeature>();

function envApiText(): string {
  return [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.API_PROXY_URL,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function requestApiHost(): string {
  const base = apiBaseUrl();
  if (base) {
    try {
      return new URL(base).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  if (typeof window !== "undefined") return window.location.hostname.toLowerCase();
  return "";
}

/** Older public API host — login/members exist, newer routes do not. */
export function isOldPublicApiHost(): boolean {
  return requestApiHost() === "api.ms.apptriangle.com";
}

/** Talking to the old public API (not same-origin Docker behind nginx). */
export function isLegacyLiveApi(): boolean {
  if (isOldPublicApiHost()) return true;
  if (typeof window !== "undefined") return false;
  return envApiText().includes("api.ms.apptriangle.com");
}

function persistMissing() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...missing]));
  } catch {
    /* ignore */
  }
}

function loadMissing() {
  if (isLegacyLiveApi()) {
    missing.add("snapshot");
    missing.add("tag-requests");
    missing.add("member-get");
  }
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    for (const feature of JSON.parse(raw) as ApiFeature[]) {
      if (feature) missing.add(feature);
    }
  } catch {
    /* ignore */
  }
}

loadMissing();

export function isApiFeatureMissing(feature: ApiFeature) {
  if (isLegacyLiveApi()) return true;
  return missing.has(feature);
}

export function markApiFeatureMissing(feature: ApiFeature) {
  missing.add(feature);
  persistMissing();
}

export function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return Number((err as { status?: unknown }).status) === 404;
}

/** Missing FastAPI route (`Not Found`), not `User not found`. */
export function isMissingRouteError(err: unknown): boolean {
  if (!isNotFoundError(err)) return false;
  const detail = String((err as { detail?: unknown }).detail ?? "").trim();
  return !detail || /^not found$/i.test(detail);
}

export function rememberMissingRoute(feature: ApiFeature, err: unknown): boolean {
  if (feature === "member-get") {
    if (!isNotFoundError(err) && !isMissingRouteError(err)) return false;
  } else if (!isNotFoundError(err)) {
    return false;
  }
  markApiFeatureMissing(feature);
  return true;
}
