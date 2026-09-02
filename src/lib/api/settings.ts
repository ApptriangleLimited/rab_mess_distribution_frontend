import { apiJson } from "@/lib/api/client";
import type { AllowanceRate, DailyTag, SenderAccount } from "@/lib/types";

export type RateApiRow = {
  tag: string;
  amount_per_day: number;
  is_builtin: boolean;
  is_protected: boolean;
};

export function listRates() {
  return apiJson<{ items: RateApiRow[] }>("/api/v1/settings/rates");
}

export function putRates(items: { tag: string; amount_per_day: number }[]) {
  return apiJson<{ items: RateApiRow[] }>("/api/v1/settings/rates", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function createRate(tag: string, amount_per_day: number) {
  return apiJson<RateApiRow>("/api/v1/settings/rates", {
    method: "POST",
    body: JSON.stringify({ tag, amount_per_day }),
  });
}

export function deleteRate(tag: string) {
  return apiJson<{ tag: string }>(`/api/v1/settings/rates/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
}

export function rateApiToAllowanceRate(row: RateApiRow): AllowanceRate {
  return {
    tag: row.tag as DailyTag,
    amount_per_day: row.amount_per_day,
  };
}

export function listSenders() {
  return apiJson<{ items: SenderAccount[] }>("/api/v1/senders");
}

export function createSenderApi(body: Omit<SenderAccount, "id">) {
  return apiJson<SenderAccount>("/api/v1/senders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateSenderApi(id: string, body: Omit<SenderAccount, "id">) {
  return apiJson<SenderAccount>(`/api/v1/senders/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteSenderApi(id: string) {
  return apiJson<{ id: string }>(`/api/v1/senders/${id}`, {
    method: "DELETE",
  });
}
