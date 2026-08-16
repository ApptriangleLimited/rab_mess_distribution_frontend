import { nowISO } from "@/lib/date";
import { RANKS } from "@/lib/constants";
import { getState, setState } from "@/lib/store";
import type {
  ApprovalStatus,
  DocumentMeta,
  EmergencyContact,
  MemberType,
  User,
  UserStatus,
} from "@/lib/types";

export type UserInput = {
  name: string;
  personal_id: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
  member_type: MemberType;
  dropdown_no: string;
  phone: string;
  documents: DocumentMeta[];
  status: UserStatus;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  joining_date: string;
  out_date: string;
  emergency_contacts: EmergencyContact[];
};

export function emptyEmergencyContact(): EmergencyContact {
  return { name: "", relation: "", phone: "" };
}

/** Drop rows with all fields blank. */
export function cleanEmergencyContacts(
  contacts: EmergencyContact[],
): EmergencyContact[] {
  return contacts
    .map((c) => ({
      name: c.name.trim(),
      relation: c.relation.trim(),
      phone: c.phone.trim(),
    }))
    .filter((c) => c.name || c.relation || c.phone);
}

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
    member_type: input.member_type || "permanent",
    rank: input.member_type === "new" ? "" : input.rank,
    wing: input.member_type === "new" ? "" : input.wing,
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
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
    member_type: input.member_type || existing.member_type || "permanent",
    rank: input.member_type === "new" ? "" : input.rank,
    wing: input.member_type === "new" ? "" : input.wing,
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
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
  /**
   * Inclusive ISO `YYYY-MM-DD` window for joining_date or out_date.
   * One side only = single day; both = range.
   */
  date_from?: string;
  date_to?: string;
};

/** Normalize single/range date filter. Empty → null (no filter). */
export function normalizeDateFilter(
  from: string,
  to: string,
): { from: string; to: string } | null {
  const f = from.trim();
  const t = to.trim();
  if (!f && !t) return null;
  if (f && !t) return { from: f, to: f };
  if (!f && t) return { from: t, to: t };
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

function dateInWindow(value: string, from: string, to: string) {
  if (!value) return false;
  return value >= from && value <= to;
}

/** True when joining or out date falls in filter (single day or range). */
export function matchesMemberDateFilter(
  user: Pick<User, "joining_date" | "out_date">,
  from: string,
  to: string,
) {
  const range = normalizeDateFilter(from, to);
  if (!range) return true;
  return (
    dateInWindow(user.joining_date ?? "", range.from, range.to) ||
    dateInWindow(user.out_date ?? "", range.from, range.to)
  );
}

export function filterUsers(users: User[], filters: UserFilters) {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const dateFrom = filters.date_from?.trim() ?? "";
  const dateTo = filters.date_to?.trim() ?? "";
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
      if (!matchesMemberDateFilter(u, dateFrom, dateTo)) {
        return false;
      }
      if (!q) return true;
      const hay = [u.name, u.personal_id, u.rab_id, u.rfid, u.phone, u.dropdown_no]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .sort(compareUsers);
}
