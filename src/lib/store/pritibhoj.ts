import { ADMIN_SUB_WINGS } from "@/lib/constants";
import { nowISO } from "@/lib/date";
import { emptyPritibhojRow, finalizePritibhojRow } from "@/lib/pritibhoj-demo";
import { getState, setState } from "@/lib/store";
import type { PritibhojEvent, PritibhojRow } from "@/lib/types";

export function listPritibhojEvents(): PritibhojEvent[] {
  return [...(getState().pritibhoj_events ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );
}

export function getPritibhojEvent(id: string): PritibhojEvent | null {
  return (getState().pritibhoj_events ?? []).find((e) => e.id === id) ?? null;
}

export function defaultPritibhojMainRows(): PritibhojRow[] {
  const { wings, wing_parent } = getState();
  const roots = wings.filter((w) => !wing_parent[w]);
  const labels = roots.length > 0 ? roots : ["Ops Wg", "Int Wg", "Admin"];
  return labels.map(emptyPritibhojRow);
}

export function defaultPritibhojAdminRows(): PritibhojRow[] {
  return ADMIN_SUB_WINGS.map((wing) => emptyPritibhojRow(wing));
}

export type PritibhojInput = {
  title: string;
  occasion: string;
  date: string;
  org: string;
  main_rows: PritibhojRow[];
  admin_rows: PritibhojRow[];
};

function normalizeEvent(input: PritibhojInput): Omit<PritibhojEvent, "id" | "created_at"> {
  return {
    title: input.title.trim(),
    occasion: input.occasion.trim(),
    date: input.date,
    org: input.org.trim(),
    main_rows: input.main_rows
      .filter((r) => r.wing.trim())
      .map(finalizePritibhojRow),
    admin_rows: input.admin_rows
      .filter((r) => r.wing.trim())
      .map(finalizePritibhojRow),
  };
}

export function createPritibhojEvent(input: PritibhojInput): PritibhojEvent {
  const event: PritibhojEvent = {
    id: `pb_${Date.now().toString(36)}`,
    created_at: nowISO(),
    ...normalizeEvent(input),
  };
  setState((prev) => ({
    ...prev,
    pritibhoj_events: [event, ...(prev.pritibhoj_events ?? [])],
  }));
  return event;
}

export function updatePritibhojEvent(
  id: string,
  input: PritibhojInput,
): PritibhojEvent | null {
  const current = getPritibhojEvent(id);
  if (!current) return null;
  const event: PritibhojEvent = {
    ...current,
    ...normalizeEvent(input),
  };
  setState((prev) => ({
    ...prev,
    pritibhoj_events: (prev.pritibhoj_events ?? []).map((row) =>
      row.id === id ? event : row,
    ),
  }));
  return event;
}

export function deletePritibhojEvent(id: string): void {
  setState((prev) => ({
    ...prev,
    pritibhoj_events: (prev.pritibhoj_events ?? []).filter((row) => row.id !== id),
  }));
}

export function eventManpower(event: PritibhojEvent): number {
  return event.main_rows.reduce((sum, row) => sum + row.total, 0);
}
