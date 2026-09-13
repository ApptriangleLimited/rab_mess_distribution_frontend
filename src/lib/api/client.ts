import { getAccessToken } from "@/lib/session";
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

function apiUrl(path: string) {
  const base = apiBaseUrl();
  return base ? `${base}${path}` : path;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isApiEnabled() && !isCcApiEnabled()) {
    throw new ApiClientError(503, "API_DISABLED", "API is off (demo mode).");
  }
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as
    | ({ ok?: boolean; success?: boolean; data: T } & Record<string, unknown>)
    | ProblemBody
    | null;

  const failed =
    !res.ok ||
    !body ||
    (body as ProblemBody).ok === false ||
    (body as ProblemBody).success === false;

  if (failed) {
    const problem = (body ?? {}) as ProblemBody;
    throw new ApiClientError(
      res.status,
      problem.code ?? "INTERNAL_ERROR",
      problem.detail ?? problem.message ?? "Request failed",
      problem.errors ?? [],
    );
  }

  return (body as { data: T }).data;
}
