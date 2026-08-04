import { nowISO } from "@/lib/date";
import { RANKS } from "@/lib/constants";
import { getState, setState } from "@/lib/store";
import type {
  ApprovalStatus,
  DocumentMeta,
  User,
  UserStatus,
} from "@/lib/types";

export type UserInput = {
  name: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
  dropdown_no: string;
  phone: string;
  documents: DocumentMeta[];
  status: UserStatus;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
};

function newId() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export function listUsers() {
  return getState().users;
}

/** Member table order: RAB ID → Rank → Name. */
export function compareUsers(a: User, b: User) {
  const id = a.rab_id.localeCompare(b.rab_id, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (id !== 0) return id;
  const ai = RANKS.indexOf(a.rank);
  const bi = RANKS.indexOf(b.rank);
  const rd = (ai === -1 ? RANKS.length : ai) - (bi === -1 ? RANKS.length : bi);
  if (rd !== 0) return rd;
  return a.name.localeCompare(b.name);
}

export function sortUsers(users: User[]) {
  return [...users].sort(compareUsers);
}

export function getUser(id: string) {
  return getState().users.find((u) => u.id === id) ?? null;
}

export function findUserByRabId(rabId: string, excludeId?: string) {
  const normalized = rabId.trim().toLowerCase();
  return (
    getState().users.find(
      (u) =>
        u.rab_id.trim().toLowerCase() === normalized &&
        (!excludeId || u.id !== excludeId),
    ) ?? null
  );
}

export function createUser(
  input: UserInput,
  opts?: { approval_status?: ApprovalStatus },
): User {
  const ts = nowISO();
  const approval_status = opts?.approval_status ?? "pending";
  const user: User = {
    id: newId(),
    ...input,
    name: input.name.trim(),
    rab_id: input.rab_id.trim(),
    status: input.status,
    approval_status,
    created_at: ts,
    updated_at: ts,
  };
  setState((prev) => ({ ...prev, users: [user, ...prev.users] }));
  return user;
}

export function updateUser(id: string, input: UserInput): User | null {
  const existing = getUser(id);
  if (!existing) return null;
  const updated: User = {
    ...existing,
    ...input,
    name: input.name.trim(),
    rab_id: input.rab_id.trim(),
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? updated : u)),
  }));
  return updated;
}

/** Patch member bank fields only (ration desk). */
export function updateUserBank(
  id: string,
  bank: Pick<
    User,
    "bank_name" | "account_name" | "account_number" | "routing" | "branch"
  >,
): User | null {
  const existing = getUser(id);
  if (!existing) return null;
  const updated: User = {
    ...existing,
    bank_name: bank.bank_name.trim(),
    account_name: bank.account_name.trim(),
    account_number: bank.account_number.trim(),
    routing: bank.routing.trim(),
    branch: bank.branch.trim(),
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? updated : u)),
  }));
  return updated;
}

export type UserFilters = {
  q?: string;
  status?: UserStatus | "all";
  approval?: ApprovalStatus | "all";
  wing?: string | "all";
  rank?: string | "all";
};

export function filterUsers(users: User[], filters: UserFilters) {
  const q = filters.q?.trim().toLowerCase() ?? "";
  return users
    .filter((u) => {
      if (filters.status && filters.status !== "all" && u.status !== filters.status) {
        return false;
      }
      if (
        filters.approval &&
        filters.approval !== "all" &&
        u.approval_status !== filters.approval
      ) {
        return false;
      }
      if (filters.wing && filters.wing !== "all" && u.wing !== filters.wing) {
        return false;
      }
      if (filters.rank && filters.rank !== "all" && u.rank !== filters.rank) {
        return false;
      }
      if (!q) return true;
      const hay = [u.name, u.rab_id, u.rfid, u.phone, u.dropdown_no]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .sort(compareUsers);
}
