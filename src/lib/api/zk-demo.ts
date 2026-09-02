import { getAccessToken } from "@/lib/session";
import { isApiEnabled } from "@/lib/api/mode";
import { ApiClientError, type FieldError } from "@/lib/api/client";

/** ZK demo UI/API. On if explicit flag or general API mode. */
export function isZkDemoEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ZK_DEMO?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") {
    return true;
  }
  return isApiEnabled();
}

type ProblemBody = {
  ok?: boolean;
  code?: string;
  detail?: string;
  errors?: FieldError[];
};

/** Like apiJson but allows ZK calls when NEXT_PUBLIC_ZK_DEMO is on even if USE_API off. */
export async function zkApiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!isZkDemoEnabled()) {
    throw new ApiClientError(503, "ZK_DEMO_DISABLED", "ZK demo is off.");
  }
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const body = (await res.json().catch(() => null)) as
    | ({ ok: true; data: T } & Record<string, unknown>)
    | ProblemBody
    | null;

  if (!res.ok || !body || (body as ProblemBody).ok === false) {
    const problem = (body ?? {}) as ProblemBody;
    throw new ApiClientError(
      res.status,
      problem.code ?? "INTERNAL_ERROR",
      problem.detail ?? "Request failed",
      problem.errors ?? [],
    );
  }

  return (body as { data: T }).data;
}

export type ZkUserRow = {
  user_id: string;
  name: string;
  privilege: number | null;
  group_id: string;
  card: string;
};

export type ZkAttendanceRow = {
  user_id: string;
  punched_at: string;
  status: number | null;
  punch: number | null;
  uid: number | null;
};

export function fetchZkStatus() {
  return zkApiJson<{
    reachable: boolean;
    host: string;
    port: number;
    latency_ms: number;
    error?: string;
  }>("/api/v1/zk/demo/status");
}

export function fetchZkUsers() {
  return zkApiJson<{ items: ZkUserRow[]; total: number }>(
    "/api/v1/zk/demo/users",
  );
}

export function fetchZkAttendance(opts?: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (opts?.from) sp.set("from", opts.from);
  if (opts?.to) sp.set("to", opts.to);
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  const q = sp.toString();
  return zkApiJson<{
    items: ZkAttendanceRow[];
    total: number;
    limit: number | null;
    from: string | null;
    to: string | null;
  }>(`/api/v1/zk/demo/attendance${q ? `?${q}` : ""}`);
}
