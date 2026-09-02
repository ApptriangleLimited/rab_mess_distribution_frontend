import { apiJson } from "@/lib/api/client";

export function listBoroKhanaDates(from: string, to: string) {
  return apiJson<{ dates: string[]; from: string; to: string }>(
    `/api/v1/boro-khana?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

export function setBoroKhanaDate(date: string, on: boolean) {
  return apiJson<{ date: string; on: boolean }>(`/api/v1/boro-khana/${date}`, {
    method: "PUT",
    body: JSON.stringify({ on }),
  });
}
