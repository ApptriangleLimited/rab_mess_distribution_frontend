import {
  getAccessToken,
  getRefreshToken,
  getSessionFromStorage,
  setAccessToken,
  setRefreshToken,
} from "@/lib/session";
import { isOldPublicApiHost } from "@/lib/api/compat";
import { apiBaseUrl, isApiEnabled, isCcApiEnabled } from "@/lib/api/mode";

export type FieldError = { field: string; code: string; message: string };

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string,
    public errors: FieldError[] = [],
  ) {
    super(detail);
    this.name = "ApiClientError";
  }
}

type ProblemBody = {
  ok?: boolean;
  success?: boolean;
  code?: string;
  detail?: string;
  message?: string;
  errors?: FieldError[];
};

type Envelope<T> = { ok?: boolean; success?: boolean; data: T } & Record<string, unknown>;

export function apiUrl(path: string) {
  // Next.js upload proxy — never send this to FastAPI on :8000.
  if (path.startsWith("/upload/")) return path;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "ms.apptriangle.com" || host === "www.ms.apptriangle.com") {
      return path;
    }
  }
  const base = apiBaseUrl();
  return base ? `${base}${path}` : path;
}

function requestHost(path: string): string {
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    return new URL(apiUrl(path), origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const MISSING_ON_OLD_API = [
  "/api/v1/app/snapshot",
  "/api/v1/app/import",
  "/api/v1/tag-requests",
  "/api/v1/reports/",
  "/api/v1/pritibhoj",
  "/api/v1/state-reports",
  "/api/v1/mess/checkins",
  "/api/v1/boro-khana",
  "/api/v1/zk/",
];

/** Old live API has login/members but not these routes. Never hit the network. */
function isUnavailableOnLiveApi(path: string): boolean {
  if (!isOldPublicApiHost() && requestHost(path) !== "api.ms.apptriangle.com") {
    return false;
  }
  return MISSING_ON_OLD_API.some((prefix) => path.includes(prefix));
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = getRefreshToken();
    if (!refresh || !getSessionFromStorage()) return false;
    try {
      const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const body = (await res.json().catch(() => null)) as Envelope<{
        access_token?: string;
        refresh_token?: string;
      }> | null;
      if (!res.ok || !body?.data?.access_token) return false;
      setAccessToken(body.data.access_token);
      if (body.data.refresh_token) setRefreshToken(body.data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function shouldAttemptRefresh(path: string, status: number) {
  return (
    status === 401 &&
    !path.includes("/api/v1/auth/login") &&
    !path.includes("/api/v1/auth/refresh") &&
    !path.includes("/api/v1/auth/forgot-password") &&
    !path.includes("/api/v1/auth/login-change-password")
  );
}

export async function apiJson<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  if (!isApiEnabled() && !isCcApiEnabled()) {
    throw new ApiClientError(503, "API_DISABLED", "API is off (demo mode).");
  }
  if (isUnavailableOnLiveApi(path)) {
    throw new ApiClientError(
      404,
      "API_FEATURE_MISSING",
      "This route is not available on the live API.",
    );
  }
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as Envelope<T> | ProblemBody | null;

  const failed =
    !res.ok ||
    !body ||
    (body as ProblemBody).ok === false ||
    (body as ProblemBody).success === false;

  if (failed && !retried && shouldAttemptRefresh(path, res.status)) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) return apiJson<T>(path, init, true);
  }

  if (failed) {
    const problem = (body ?? {}) as ProblemBody;
    throw new ApiClientError(
      res.status,
      problem.code ?? "INTERNAL_ERROR",
      res.status === 413
        ? "File is too large. PNG or JPG up to 2.5 MB is allowed."
        : (problem.detail ?? problem.message ?? "Request failed"),
      problem.errors ?? [],
    );
  }

  return (body as Envelope<T>).data;
}
