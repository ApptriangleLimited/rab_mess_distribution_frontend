import { apiJson } from "@/lib/api/client";
import { isCcApiEnabled } from "@/lib/api/mode";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import { getAccessToken } from "@/lib/session";
import {
  applyApiSnapshot,
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
  "forces",
  "force_ranks",
  "force_rank_extras",
  "force_rank_removed",
  "force_rank_labels",
  "rank_labels",
  "rank_forces",
  "rank_equivalents",
  "rank_force_wings",
  "member_banks",
  "manpower_held",
  "manpower_absent",
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
  };
}

export function fetchAppSnapshot() {
  return apiJson<AppSnapshot>("/api/v1/app/snapshot");
}

export function saveAppSnapshot(state: AppState) {
  return apiJson<AppSnapshot>("/api/v1/app/snapshot", {
    method: "PUT",
    body: JSON.stringify(stateToPayload(state)),
  });
}

export function importAppSnapshot(state: AppState) {
  return apiJson<AppSnapshot>("/api/v1/app/import", {
    method: "POST",
    body: JSON.stringify(stateToPayload(state)),
  });
}

export async function syncStoreFromApi() {
  if (!isCcApiEnabled() || !getAccessToken() || syncing) return;
  syncing = true;
  try {
    const remote = await fetchAppSnapshot();
    applyApiSnapshot(snapshotToState(remote));
  } finally {
    syncing = false;
  }
}

function schedulePersist(state: AppState) {
  if (!isCcApiEnabled() || !getAccessToken() || syncing) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void saveAppSnapshot(state).catch((err) => {
      console.error("Failed to persist app state to Docker API", err);
    });
  }, 600);
}

setPersistHook(schedulePersist);
