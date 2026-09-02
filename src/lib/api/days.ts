import { apiJson } from "@/lib/api/client";

export function approveDay(date: string) {
  return apiJson<{ date: string; filled: number; locked: boolean }>(
    `/api/v1/days/${date}/approve`,
    { method: "POST" },
  );
}

export function listLockedDates(from: string, to: string) {
  return apiJson<{ dates: string[]; from: string; to: string }>(
    `/api/v1/days/locks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}
