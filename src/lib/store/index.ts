import { STORE_KEY } from "@/lib/constants";
import { createSeedState } from "@/lib/store/seed";
import type { AppState } from "@/lib/types";

type Listener = () => void;

let memory: AppState | null = null;
const listeners = new Set<Listener>();

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

export function getState(): AppState {
  if (memory) return memory;
  const fromDisk = readStorage();
  if (fromDisk) {
    memory = normalizeState(fromDisk);
    return memory;
  }
  const seeded = createSeedState();
  memory = seeded;
  writeStorage(seeded);
  return seeded;
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    approved_dates: Array.isArray(state.approved_dates)
      ? state.approved_dates
      : [],
    suppressed_carries: Array.isArray(state.suppressed_carries)
      ? state.suppressed_carries
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
    version: 0,
  };
}

export function hydrateStore() {
  getState();
}
