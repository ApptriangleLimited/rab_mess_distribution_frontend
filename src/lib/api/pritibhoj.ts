import { ApiClientError, apiJson } from "@/lib/api/client";
import { isOldPublicApiHost } from "@/lib/api/compat";
import {
  finalizePritibhojRow,
  lockPritibhojSheets,
  normalizePritibhojEvent,
} from "@/lib/pritibhoj-demo";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type { PritibhojEvent, PritibhojRow } from "@/lib/types";

function missingPritibhoj() {
  return new ApiClientError(
    404,
    "API_FEATURE_MISSING",
    "Pritibhoj is not available on this API.",
  );
}

function asEvent(raw: unknown): PritibhojEvent {
  const event = normalizePritibhojEvent(raw);
  if (!event) {
    throw new ApiClientError(502, "BAD_PAYLOAD", "Invalid Pritibhoj payload.");
  }
  return event;
}

function asEventList(raw: unknown): PritibhojEvent[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  return rows
    .map(normalizePritibhojEvent)
    .filter((row): row is PritibhojEvent => row !== null);
}

function serializeRow(row: PritibhojRow) {
  const live = finalizePritibhojRow(row);
  return {
    ...live,
    azad_hall: live.azadHall,
    azad_hall_dist: live.azadHallDist,
    distribution_2: live.distribution2,
    non_muslim: live.nonMuslim,
    total_distribution: live.totalDistribution,
  };
}

export function serializePritibhojInput(input: PritibhojInput) {
  const locked = lockPritibhojSheets(input);
  return {
    title: locked.title.trim(),
    occasion: locked.occasion.trim(),
    date: locked.date,
    org: locked.org.trim(),
    main_rows: locked.main_rows.map(serializeRow),
    admin_rows: locked.admin_rows.map(serializeRow),
    roster: locked.roster ?? {},
  };
}

export function listPritibhojEventsApi() {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>("/api/v1/pritibhoj").then(asEventList);
}

export function fetchPritibhojEvent(id: string) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>(`/api/v1/pritibhoj/${id}`).then(asEvent);
}

export function createPritibhojEventApi(input: PritibhojInput) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>("/api/v1/pritibhoj", {
    method: "POST",
    body: JSON.stringify(serializePritibhojInput(input)),
  }).then(asEvent);
}

export function updatePritibhojEventApi(id: string, input: PritibhojInput) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>(`/api/v1/pritibhoj/${id}`, {
    method: "PUT",
    body: JSON.stringify(serializePritibhojInput(input)),
  }).then(asEvent);
}

export function deletePritibhojEventApi(id: string) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<{ id: string }>(`/api/v1/pritibhoj/${id}`, {
    method: "DELETE",
  });
}
