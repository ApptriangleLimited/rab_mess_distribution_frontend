/** Older hosts (e.g. api.ms.apptriangle.com) have login but not every current route. */

export type ApiFeature = "snapshot" | "tag-requests" | "member-get";

const missing = new Set<ApiFeature>();

export function isApiFeatureMissing(feature: ApiFeature) {
  return missing.has(feature);
}

export function markApiFeatureMissing(feature: ApiFeature) {
  missing.add(feature);
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
