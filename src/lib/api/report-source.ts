import { apiJson } from "@/lib/api/client";
import { isApiFeatureMissing } from "@/lib/api/compat";
import {
  cellsToCountedAssignments,
  cellsToSuppressed,
  listAssignments,
} from "@/lib/api/assignments";
import {
  listAllApprovedMembers,
  memberToUser,
  type MemberApiRow,
} from "@/lib/api/members";
import {
  listRates,
  listSenders,
  rateApiToAllowanceRate,
} from "@/lib/api/settings";
import type { ReportSource } from "@/lib/reports";
import {
  extraTrustFirewoodAssignments,
  extraTrustFirewoodMembers,
} from "@/lib/store/seed";
import type {
  AllowanceRate,
  DailyAssignment,
  DailyTag,
  SenderAccount,
  User,
} from "@/lib/types";

export type ReportSourceApi = {
  from: string;
  to: string;
  users: MemberApiRow[];
  assignments: DailyAssignment[];
  rates: AllowanceRate[];
  senders: SenderAccount[];
  suppressed_carries: string[];
};

export function fetchReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params.month) search.set("month", params.month);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const suffix = search.toString() ? `?${search}` : "";
  return apiJson<ReportSourceApi>(`/api/v1/reports/source${suffix}`);
}

function mergeTrustFirewoodSource(
  users: User[],
  assignments: DailyAssignment[],
) {
  const extras = extraTrustFirewoodMembers();
  const ids = new Set(users.map((u) => u.id));
  const mergedUsers = extras.length
    ? [...users, ...extras.filter((u) => !ids.has(u.id))]
    : users;
  const extraAssigns = extraTrustFirewoodAssignments();
  const keys = new Set(assignments.map((a) => `${a.user_id}|${a.date}`));
  const mergedAssigns = extraAssigns.length
    ? [...assignments, ...extraAssigns.filter((a) => !keys.has(`${a.user_id}|${a.date}`))]
    : assignments;
  return { users: mergedUsers, assignments: mergedAssigns };
}

export function reportSourceFromApi(data: ReportSourceApi): ReportSource {
  const merged = mergeTrustFirewoodSource(
    data.users.map(memberToUser),
    (data.assignments ?? []).map((row) => ({
      ...row,
      tag: (row.tag || "") as DailyTag,
    })),
  );
  return {
    users: merged.users,
    assignments: merged.assignments,
    rates: data.rates ?? [],
    senders: data.senders ?? [],
    suppressed_carries: data.suppressed_carries ?? [],
  };
}

const LIVE_SOURCE_TTL_MS = 60_000;

type LiveSourceCache = {
  key: string;
  data: ReportSource;
  at: number;
};

let liveSourceCache: LiveSourceCache | null = null;
let liveSourceInflight: { key: string; promise: Promise<ReportSource> } | null =
  null;

function liveSourceKey(params: {
  month?: string;
  from?: string;
  to?: string;
}) {
  return params.month || `${params.from ?? ""}|${params.to ?? ""}`;
}

/** Cached live source for the same month/range, if still fresh. */
export function peekLiveReportSource(
  params: { month?: string; from?: string; to?: string },
  opts?: { allowStale?: boolean },
): ReportSource | undefined {
  const key = liveSourceKey(params);
  if (!liveSourceCache || liveSourceCache.key !== key) return undefined;
  if (!opts?.allowStale && Date.now() - liveSourceCache.at > LIVE_SOURCE_TTL_MS) {
    return undefined;
  }
  return liveSourceCache.data;
}

async function fetchLiveReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}): Promise<ReportSource> {
  const assignQuery = params.month
    ? { month: params.month }
    : { from: params.from, to: params.to };

  const [assignRes, memberRes, rateRes, senderRes] = await Promise.allSettled([
    listAssignments(assignQuery),
    listAllApprovedMembers({ status: "all" }),
    listRates(),
    listSenders(),
  ]);

  let users: User[] = [];
  let assignments: DailyAssignment[] = [];
  let rates: AllowanceRate[] = [];
  let senders: SenderAccount[] = [];
  let suppressed: string[] = [];

  if (memberRes.status === "fulfilled") {
    users = memberRes.value.map(memberToUser);
  }
  if (assignRes.status === "fulfilled") {
    const items = assignRes.value.items ?? [];
    assignments = cellsToCountedAssignments(items);
    suppressed = cellsToSuppressed(items);
  }
  if (rateRes.status === "fulfilled") {
    rates = (rateRes.value.items ?? []).map(rateApiToAllowanceRate);
  }
  if (senderRes.status === "fulfilled") {
    senders = senderRes.value.items ?? [];
  }

  const fetchFailed =
    assignRes.status === "rejected" ||
    memberRes.status === "rejected" ||
    rateRes.status === "rejected";
  if (fetchFailed && !isApiFeatureMissing("snapshot")) {
    try {
      const snap = reportSourceFromApi(await fetchReportSource(params));
      if (!users.length) users = snap.users;
      if (!assignments.length) {
        assignments = snap.assignments;
        if (!suppressed.length) suppressed = snap.suppressed_carries ?? [];
      }
      if (!rates.length) rates = snap.rates ?? [];
      if (!senders.length) senders = snap.senders ?? [];
    } catch {
      /* snapshot optional */
    }
  }

  if (!users.length && !assignments.length && !rates.length) {
    throw new Error("Could not load report data from API.");
  }

  const merged = mergeTrustFirewoodSource(users, assignments);
  return {
    users: merged.users,
    assignments: merged.assignments,
    rates,
    senders,
    suppressed_carries: suppressed,
  };
}

/** Live Daily RR + members + Settings rates. Snapshot is only a fallback. */
export async function loadLiveReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}): Promise<ReportSource> {
  const key = liveSourceKey(params);
  const fresh = peekLiveReportSource(params);
  if (fresh) return fresh;
  if (liveSourceInflight?.key === key) return liveSourceInflight.promise;

  const promise = fetchLiveReportSource(params)
    .then((data) => {
      liveSourceCache = { key, data, at: Date.now() };
      return data;
    })
    .finally(() => {
      if (liveSourceInflight?.promise === promise) liveSourceInflight = null;
    });
  liveSourceInflight = { key, promise };
  return promise;
}
