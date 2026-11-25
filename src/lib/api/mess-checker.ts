import { apiJson } from "@/lib/api/client";

export type CheckerBranch = "hq" | "haji";

export type CheckerBoard = {
  branch: CheckerBranch;
  branch_label: string;
  manager: string;
  online: boolean;
  date: string;
  now: string;
  shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    seconds_left: number;
  } | null;
  next_shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  } | null;
  stats: {
    planned: number;
    consumptions: number;
    duplicates: number;
    guests: number;
  };
};

export type CheckerResult = {
  ok: boolean;
  code: "accepted" | "not_found" | "has_rfid" | "not_ms" | "no_shift" | "duplicate";
  name?: string;
  shift_name?: string;
  branch_label?: string;
  guest_name?: string;
};

export type GuestListItem = {
  id: string;
  date: string;
  check_in_time: string;
  shift_id: string;
  shift_name: string;
  guest_name: string;
  guest_info: string;
  ref_info: string;
  branch: string;
  branch_label: string;
};

export function fetchCheckerBoard() {
  return apiJson<CheckerBoard>("/api/v1/mess/checker/board");
}

export function checkInMeal(srbId: string) {
  return apiJson<CheckerResult>("/api/v1/mess/checker/check-in", {
    method: "POST",
    body: JSON.stringify({ srb_id: srbId }),
  });
}

export function checkInGuest(body: {
  guest_name: string;
  guest_info: string;
  ref_info: string;
}) {
  return apiJson<CheckerResult>("/api/v1/mess/checker/guests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchGuestList(date: string, branch = "", to = "") {
  const search = new URLSearchParams({ day: date });
  if (to) search.set("to", to);
  if (branch) search.set("branch", branch);
  return apiJson<{ date: string; branch: string; items: GuestListItem[] }>(
    `/api/v1/mess/guest-list?${search}`,
  );
}
