import { apiJson } from "@/lib/api/client";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";

export function listPritibhojEventsApi() {
  return apiJson<PritibhojEvent[]>("/api/v1/pritibhoj");
}

export function fetchPritibhojEvent(id: string) {
  return apiJson<PritibhojEvent>(`/api/v1/pritibhoj/${id}`);
}

export function createPritibhojEventApi(input: PritibhojInput) {
  return apiJson<PritibhojEvent>("/api/v1/pritibhoj", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePritibhojEventApi(id: string, input: PritibhojInput) {
  return apiJson<PritibhojEvent>(`/api/v1/pritibhoj/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePritibhojEventApi(id: string) {
  return apiJson<{ id: string }>(`/api/v1/pritibhoj/${id}`, {
    method: "DELETE",
  });
}
