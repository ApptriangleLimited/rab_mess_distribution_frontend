import type { DailyTag, TagRequestQueue, TagRequestRoute } from "@/lib/types";

export const TAG_REQUEST_ROUTE_OPTIONS = [
  "consume",
  "ration",
  "mess",
  "none",
] as const;

/** Built-in defaults: FR/CD → Ration, MS/MFR/TRG apply now, everything else → Consume. */
export const DEFAULT_TAG_REQUEST_ROUTES: Record<string, TagRequestRoute> = {
  FR: "ration",
  CD: "ration",
  MS: "none",
  MFR: "none",
  TRG: "none",
};

export function isTagRequestRoute(value: string): value is TagRequestRoute {
  return (TAG_REQUEST_ROUTE_OPTIONS as readonly string[]).includes(value);
}

export function ensureTagRequestRoutes(
  raw: unknown,
): Record<string, TagRequestRoute> {
  const out: Record<string, TagRequestRoute> = {
    ...DEFAULT_TAG_REQUEST_ROUTES,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const tag = String(key || "")
      .trim()
      .toUpperCase();
    const route = String(value || "")
      .trim()
      .toLowerCase();
    if (!tag || !isTagRequestRoute(route)) continue;
    out[tag] = route;
  }
  return out;
}

export function resolveTagRequestRoute(
  tag: DailyTag | string,
  routes?: Record<string, TagRequestRoute>,
): TagRequestRoute {
  const key = String(tag || "")
    .trim()
    .toUpperCase();
  if (!key) return "none";
  const mapped = routes?.[key];
  if (mapped && isTagRequestRoute(mapped)) return mapped;
  return DEFAULT_TAG_REQUEST_ROUTES[key] ?? "consume";
}

/** Queue stored on the request. `none` becomes Daily so CC still has an inbox. */
export function queueForTagRequestRoute(
  route: TagRequestRoute,
): TagRequestQueue {
  if (route === "none") return "daily";
  return route;
}
