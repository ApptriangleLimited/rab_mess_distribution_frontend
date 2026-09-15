/** Older hosts (e.g. api.ms.apptriangle.com) have login but not every current route. */

export type ApiFeature = "snapshot" | "tag-requests" | "member-get";

const STORAGE_KEY = "rab.api.missing";
const missing = new Set<ApiFeature>();

function configuredApiHost(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).toLowerCase();
}

/** Live ms API predates snapshot / tag-request / member-get routes. */
export function isLegacyLiveApi(): boolean {
  return configuredApiHost().includes("api.ms.apptriangle.com");
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
    if (!isMissingRouteError(err)) return false;
  } else if (!isNotFoundError(err)) {
    return false;
  }
  markApiFeatureMissing(feature);
  return true;
}
