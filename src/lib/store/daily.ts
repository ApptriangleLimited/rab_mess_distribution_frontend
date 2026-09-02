import { nowISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import type { ApprovalStatus, User, UserStatus } from "@/lib/types";

/**
 * False when inactive, or date after out_date (out day itself still allowed).
 * Inactive → no paint / no carry ghost; stored history still readable elsewhere.
 */
export function canAssignOnDate(
  user: Pick<User, "out_date" | "status">,
  date: string,
): boolean {
  if (user.status !== "1") return false;
  const out = (user.out_date ?? "").trim();
  if (out && date > out) return false;
  return true;
}

function patchUser(
  id: string,
  patch: Partial<Pick<User, "approval_status" | "status">>,
): User | null {
  const existing = getState().users.find((u) => u.id === id);
  if (!existing) return null;
  const updated: User = {
    ...existing,
    ...patch,
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? updated : u)),
  }));
  return updated;
}

export function listPendingUsers() {
  return getState().users.filter((u) => u.approval_status === "pending");
}

export function listApprovedUsers(opts?: { includeInactive?: boolean }) {
  return getState().users.filter((u) => {
    if (u.approval_status !== "approved") return false;
    if (!opts?.includeInactive && u.status !== "1") return false;
    return true;
  });
}

export function approveUser(id: string) {
  return patchUser(id, { approval_status: "approved", status: "1" });
}

export function rejectUser(id: string) {
  return patchUser(id, { approval_status: "rejected" });
}

export function endEntry(id: string) {
  return patchUser(id, { approval_status: "ended", status: "0" });
}

export function setUserStatus(id: string, status: UserStatus) {
  return patchUser(id, { status });
}

export function setApprovalStatus(id: string, approval_status: ApprovalStatus) {
  return patchUser(id, { approval_status });
}
