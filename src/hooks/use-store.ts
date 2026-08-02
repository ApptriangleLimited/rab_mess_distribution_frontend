"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getState, subscribe } from "@/lib/store";
import type { AppState } from "@/lib/types";

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getServerSnapshot);
}
