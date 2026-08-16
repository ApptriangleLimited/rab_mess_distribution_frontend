import { RATE_ONLY_TAGS, STORE_KEY } from "@/lib/constants";
import { parseMoney } from "@/lib/money";
import { createSeedState, SEED_VERSION } from "@/lib/store/seed";
import type {
  AllowanceRate,
  AppState,
  EmergencyContact,
  User,
} from "@/lib/types";

type Listener = () => void;

let memory: AppState | null = null;
const listeners = new Set<Listener>();

type LegacyUser = User & {
  emergency_name?: string;
  emergency_relation?: string;
  emergency_phone?: string;
};

function normalizeEmergencyContacts(u: LegacyUser): EmergencyContact[] {
  if (Array.isArray(u.emergency_contacts) && u.emergency_contacts.length > 0) {
    return u.emergency_contacts.map((c) => ({
      name: c?.name ?? "",
      relation: c?.relation ?? "",
      phone: c?.phone ?? "",
    }));
  }
  const name = u.emergency_name ?? "";
  const relation = u.emergency_relation ?? "";
  const phone = u.emergency_phone ?? "";
  if (name || relation || phone) {
    return [{ name, relation, phone }];
  }
  return [];
}

function ensureRateOnlyRates(rates: AllowanceRate[]): AllowanceRate[] {
  const next = rates.map((r) => ({
    ...r,
    amount_per_day: parseMoney(r.amount_per_day),
  }));
  for (const only of RATE_ONLY_TAGS) {
    const exists = next.some(
      (r) => r.tag.toLowerCase() === only.code.toLowerCase(),
    );
    if (!exists) {
      next.push({ tag: only.code, amount_per_day: only.defaultAmount });
    }
  }
  return next;
}

function readStorage(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

function writeStorage(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function isCurrentSeed(state: AppState | null): state is AppState {
  return !!state && (state.version ?? 0) >= SEED_VERSION;
}

export function getState(): AppState {
  if (isCurrentSeed(memory)) return memory;

  const fromDisk = readStorage();
  if (isCurrentSeed(fromDisk)) {
    memory = normalizeState(fromDisk);
    return memory;
  }

  // Stale / missing seed version → auto restore demo data
  const seeded = createSeedState();
  memory = seeded;
  writeStorage(seeded);
  return seeded;
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    users: (state.users ?? []).map((u) => {
      const legacy = u as LegacyUser;
      const {
        emergency_name: _n,
        emergency_relation: _r,
        emergency_phone: _p,
        ...rest
      } = legacy;
      return {
        ...rest,
        joining_date: legacy.joining_date ?? "",
        out_date: legacy.out_date ?? "",
        member_type: legacy.member_type ?? "permanent",
        personal_id: legacy.personal_id ?? "",
        emergency_contacts: normalizeEmergencyContacts(legacy),
      };
    }),
    rates: ensureRateOnlyRates(state.rates ?? []),
    approved_dates: Array.isArray(state.approved_dates)
      ? state.approved_dates
      : [],
    suppressed_carries: Array.isArray(state.suppressed_carries)
      ? state.suppressed_carries
      : [],
    boro_khana_dates: Array.isArray(state.boro_khana_dates)
      ? state.boro_khana_dates
      : [],
    state_reports: Array.isArray(state.state_reports)
      ? state.state_reports
      : [],
  };
}

export function setState(next: AppState | ((prev: AppState) => AppState)) {
  const prev = getState();
  const resolved = typeof next === "function" ? next(prev) : next;
  memory = resolved;
  writeStorage(resolved);
  listeners.forEach((l) => l());
}

export function resetToSeed() {
  const seeded = createSeedState();
  setState(seeded);
  return seeded;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerSnapshot(): AppState {
  return {
    users: [],
    assignments: [],
    senders: [],
    rates: [],
    approved_dates: [],
    suppressed_carries: [],
    boro_khana_dates: [],
    state_reports: [],
    version: 0,
  };
}

export function hydrateStore() {
  getState();
}
