import { ApiClientError, apiJson } from "@/lib/api/client";
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
  setState,
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
  "force_rank_officer",
  "force_rank_cells",
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

function catalogSlice(state: AppState): Partial<AppState> {
  return Object.fromEntries(CATALOG_KEYS.map((key) => [key, state[key]]));
}

function stateToPayload(state: AppState, includeCatalog = true) {
  return {
    users: state.users,
    assignments: state.assignments,
    tag_requests: state.tag_requests.filter(
      (row) => !String(row.id ?? "").startsWith("tr_demo_"),
    ),
    senders: state.senders,
    rates: state.rates,
    ...(includeCatalog ? catalogSlice(state) : {}),
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

export function saveAppSnapshot(state: AppState, includeCatalog = true) {
  if (isLegacyLiveApi() || isApiFeatureMissing("snapshot")) {
    return Promise.resolve({} as AppSnapshot);
  }
  return apiJson<AppSnapshot>("/api/v1/app/snapshot", {
    method: "PUT",
    body: JSON.stringify(stateToPayload(state, includeCatalog)),
  });
}

function saveCatalog(state: AppState) {
  return apiJson<Record<string, unknown>>("/api/v1/catalog", {
    method: "PUT",
    body: JSON.stringify({ payload: catalogSlice(state) }),
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
  const catalogBefore = JSON.stringify(catalogSlice(getState()));
  try {
    const remote = await fetchAppSnapshot();
    const catalogNow = catalogSlice(getState());
    const edited = JSON.stringify(catalogNow) !== catalogBefore;
    applyApiSnapshot(snapshotToState(remote));
    if (edited) {
      // The load started before the rank was added. Put the new catalog back.
      setState((prev) => ({ ...prev, ...catalogNow }));
      persistDirty = true;
    }
  } catch (err) {
    // Older hosts (api.ms.apptriangle.com) have login but no snapshot.
    // A 404 page often has no CORS headers, so fetch throws without .status.
    rememberMissingRoute("snapshot", err);
    markApiFeatureMissing("snapshot");
  } finally {
    syncing = false;
    const waiters = syncWaiters.splice(0);
    let job = Promise.resolve();
    if (persistDirty) {
      persistDirty = false;
      job = startFlush();
    }
    flushAfterSync = job;
    waiters.forEach((release) => release());
    try {
      await job;
    } catch {
      /* persistAppStateNow already surfaces this to the settings form */
    }
  }
}

let persistDirty = false;
let flushAfterSync: Promise<void> = Promise.resolve();
const syncWaiters: Array<() => void> = [];
let pendingFlush: Promise<void> | null = null;
let flushAgain = false;

function canPersistSnapshot() {
  return (
    isCcApiEnabled() &&
    Boolean(getAccessToken()) &&
    !isLegacyLiveApi() &&
    !isApiFeatureMissing("snapshot")
  );
}

function catalogSaveRejected(err: unknown) {
  return (
    err instanceof ApiClientError &&
    (err.status === 403 || err.status === 404)
  );
}

/** Ranks, wings, and forces are a small catalog row. The full snapshot also
 * rewrites every member and was dropping a new rank when that request lost
 * the race or never finished before refresh. */
async function writeCurrent() {
  const state = getState();
  let catalogSaved = false;
  try {
    await saveCatalog(state);
    catalogSaved = true;
  } catch (err) {
    if (!catalogSaveRejected(err)) {
      console.error("Failed to persist rank catalog", err);
    }
  }
  if (flushAgain) return;
  if (catalogSaved) {
    // Catalog is already committed. Keep it out of the member snapshot so a
    // slow snapshot cannot put the old rank list back.
    void saveAppSnapshot(getState(), false).catch((err) => {
      if (rememberMissingRoute("snapshot", err)) return;
      console.error("Failed to persist app state to Docker API", err);
    });
    return;
  }
  try {
    await saveAppSnapshot(getState(), true);
  } catch (err) {
    if (rememberMissingRoute("snapshot", err)) throw err;
    console.error("Failed to persist app state to Docker API", err);
    throw err;
  }
}

function startFlush(): Promise<void> {
  flushAgain = true;
  if (!pendingFlush) {
    pendingFlush = (async () => {
      try {
        while (flushAgain) {
          flushAgain = false;
          await writeCurrent();
        }
      } finally {
        pendingFlush = null;
      }
    })();
  }
  return pendingFlush;
}

/** Write catalog (wings, ranks, labels) to Postgres now — not after the 2s debounce. */
export function persistAppStateNow(_state?: AppState): Promise<void> {
  if (!canPersistSnapshot()) return Promise.resolve();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (syncing) {
    persistDirty = true;
    return new Promise<void>((resolve) => {
      syncWaiters.push(resolve);
    }).then(() => flushAfterSync);
  }
  return startFlush();
}

function schedulePersist(_state: AppState) {
  if (!canPersistSnapshot()) return;
  if (syncing) {
    persistDirty = true;
    return;
  }
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void startFlush().catch((err) => {
      console.error("Failed to persist app state to Docker API", err);
    });
  }, 2000);
}

setPersistHook(schedulePersist);
