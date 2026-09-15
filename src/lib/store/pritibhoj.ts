import { nowISO } from "@/lib/date";
import {
  lockPritibhojRows,
  lockPritibhojSheets,
  PRITIBHOJ_ADMIN_WING_DEFS,
  PRITIBHOJ_MAIN_WING_DEFS,
} from "@/lib/pritibhoj-demo";
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
  return lockPritibhojRows(PRITIBHOJ_MAIN_WING_DEFS);
}

export function defaultPritibhojAdminRows(): PritibhojRow[] {
  return lockPritibhojRows(PRITIBHOJ_ADMIN_WING_DEFS);
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
  const locked = lockPritibhojSheets(input);
  return {
    title: input.title.trim(),
    occasion: input.occasion.trim(),
    date: input.date,
    org: input.org.trim(),
    main_rows: locked.main_rows,
    admin_rows: locked.admin_rows,
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
    paper_report_requests: (prev.paper_report_requests ?? []).filter(
      (row) => !(row.kind === "pritibhoj" && row.ref === id),
    ),
  }));
}

export function upsertLocalPritibhojEvent(event: PritibhojEvent) {
  setState((prev) => {
    const current = prev.pritibhoj_events ?? [];
    const exists = current.some((row) => row.id === event.id);
    return {
      ...prev,
      pritibhoj_events: exists
        ? current.map((row) => (row.id === event.id ? event : row))
        : [event, ...current],
    };
  });
}

export function replaceLocalPritibhojEvents(events: PritibhojEvent[]) {
  setState((prev) => ({
    ...prev,
    pritibhoj_events: events,
  }));
}

export function eventManpower(event: PritibhojEvent): number {
  return event.main_rows.reduce((sum, row) => sum + row.total, 0);
}
