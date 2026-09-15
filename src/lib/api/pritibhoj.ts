import { ApiClientError, apiJson } from "@/lib/api/client";
import { isOldPublicApiHost } from "@/lib/api/compat";
import { normalizePritibhojEvent } from "@/lib/pritibhoj-demo";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";

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

export function listPritibhojEventsApi() {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown[]>("/api/v1/pritibhoj").then((rows) =>
    (Array.isArray(rows) ? rows : [])
      .map(normalizePritibhojEvent)
      .filter((row): row is PritibhojEvent => row !== null),
  );
}

export function fetchPritibhojEvent(id: string) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>(`/api/v1/pritibhoj/${id}`).then(asEvent);
}

export function createPritibhojEventApi(input: PritibhojInput) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>("/api/v1/pritibhoj", {
    method: "POST",
    body: JSON.stringify(input),
  }).then(asEvent);
}

export function updatePritibhojEventApi(id: string, input: PritibhojInput) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<unknown>(`/api/v1/pritibhoj/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).then(asEvent);
}

export function deletePritibhojEventApi(id: string) {
  if (isOldPublicApiHost()) return Promise.reject(missingPritibhoj());
  return apiJson<{ id: string }>(`/api/v1/pritibhoj/${id}`, {
    method: "DELETE",
  });
}
