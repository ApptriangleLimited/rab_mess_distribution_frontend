import { apiJson } from "@/lib/api/client";
import {
  isApiFeatureMissing,
  isLegacyLiveApi,
  markApiFeatureMissing,
  rememberMissingRoute,
} from "@/lib/api/compat";
import { isCcApiEnabled } from "@/lib/api/mode";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import { getAccessToken } from "@/lib/session";
import {
  applyApiSnapshot,
  getState,
  setPersistHook,
} from "@/lib/store";
import type {
  AllowanceRate,
  AppState,
  DailyAssignment,
  DailyTag,
  SenderAccount,
  TagRequest,
} from "@/lib/types";

export type AppSnapshot = Partial<AppState> & {
  users?: MemberApiRow[];
};

const CATALOG_KEYS = [
  "ranks",
  "wings",
  "wing_parent",
  "wing_labels",
  "wing_labels_bn",
  "wing_serials",
  "forces",
  "force_labels",
  "force_labels_bn",
  "force_serials",
  "force_ranks",
  "force_rank_extras",
  "force_rank_removed",
  "force_rank_labels",
  "force_rank_labels_bn",
  "force_rank_serials",
  "rank_labels",
  "rank_labels_bn",
  "rank_serials",
  "rank_forces",
  "rank_equivalents",
  "rank_force_wings",
  "member_banks",
  "manpower_held",
  "manpower_absent",
  "manpower_present",
  "manpower_absence_detail",
  "paper_report_requests",
] as const;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

function snapshotToState(data: AppSnapshot): Partial<AppState> {
  const users = (data.users ?? []).map((row) =>
    memberToUser(row as MemberApiRow),
  );
  return {
    ...data,
    users,
    assignments: (data.assignments ?? []) as DailyAssignment[],
    tag_requests: (data.tag_requests ?? []) as TagRequest[],
    senders: (data.senders ?? []) as SenderAccount[],
    rates: (data.rates ?? []).map((r) => ({
      tag: r.tag as DailyTag,
      amount_per_day: r.amount_per_day,
    })) as AllowanceRate[],
  };
}

function stateToPayload(state: AppState) {
  return {
    users: state.users,
    assignments: state.assignments,
    tag_requests: state.tag_requests.filter(
      (row) => !String(row.id ?? "").startsWith("tr_demo_"),
    ),
    senders: state.senders,
    rates: state.rates,
    ...Object.fromEntries(CATALOG_KEYS.map((key) => [key, state[key]])),
    authorized: state.authorized,
    manpower_officer_absent: state.manpower_officer_absent,
    manpower_held: state.manpower_held,
    manpower_absent: state.manpower_absent,
    manpower_present: state.manpower_present,
    manpower_absence_detail: state.manpower_absence_detail,
    approved_dates: state.approved_dates,
    suppressed_carries: state.suppressed_carries,
    boro_khana_dates: state.boro_khana_dates,
    state_reports: state.state_reports,
    meal_shifts: state.meal_shifts,
    meal_plans: state.meal_plans,
    meal_assigns: state.meal_assigns,
    guest_meals: state.guest_meals,
    pritibhoj_events: (state.pritibhoj_events ?? []).filter(
      (row) => !String(row.id ?? "").startsWith("pb_demo_"),
    ),
    paper_report_requests: state.paper_report_requests ?? [],
  };
}

export function fetchAppSnapshot() {
  if (isLegacyLiveApi() || isApiFeatureMissing("snapshot")) {
    return Promise.reject(new Error("snapshot unavailable"));
  }
  return apiJson<AppSnapshot>("/api/v1/app/snapshot");
}

export function saveAppSnapshot(state: AppState) {
  if (isLegacyLiveApi() || isApiFeatureMissing("snapshot")) {
    return Promise.resolve({} as AppSnapshot);
  }
  return apiJson<AppSnapshot>("/api/v1/app/snapshot", {
    method: "PUT",
    body: JSON.stringify(stateToPayload(state)),
  });
}

export function importAppSnapshot(state: AppState) {
  if (isLegacyLiveApi() || isApiFeatureMissing("snapshot")) {
    return Promise.resolve({} as AppSnapshot);
  }
  return apiJson<AppSnapshot>("/api/v1/app/import", {
    method: "POST",
    body: JSON.stringify(stateToPayload(state)),
  });
}

export async function syncStoreFromApi() {
  if (!isCcApiEnabled() || !getAccessToken() || syncing) return;
  if (isLegacyLiveApi() || isApiFeatureMissing("snapshot")) return;
  syncing = true;
  try {
    const remote = await fetchAppSnapshot();
    applyApiSnapshot(snapshotToState(remote));
  } catch (err) {
    // Older hosts (api.ms.apptriangle.com) have login but no snapshot.
    // A 404 page often has no CORS headers, so fetch throws without .status.
    rememberMissingRoute("snapshot", err);
    markApiFeatureMissing("snapshot");
  } finally {
    syncing = false;
  }
}

function canPersistSnapshot() {
  return (
    isCcApiEnabled() &&
    Boolean(getAccessToken()) &&
    !syncing &&
    !isLegacyLiveApi() &&
    !isApiFeatureMissing("snapshot")
  );
}

function persistSnapshot(state: AppState) {
  void saveAppSnapshot(state).catch((err) => {
    if (rememberMissingRoute("snapshot", err)) return;
    console.error("Failed to persist app state to Docker API", err);
  });
}

/** Write catalog (wings, serials, labels) to Postgres now — not after the 2s debounce. */
export function persistAppStateNow(state?: AppState) {
  if (!canPersistSnapshot()) return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistSnapshot(state ?? getState());
}

function schedulePersist(state: AppState) {
  if (!canPersistSnapshot()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistSnapshot(state), 2000);
}

setPersistHook(schedulePersist);
