import { nowISO, todayISO } from "@/lib/date";
import { digitsOnly, isValidBdPhone, normalizeBdPhone } from "@/lib/utils";
import { listRanks, listMemberBanks } from "@/lib/store/org-options";
import { getState, setState } from "@/lib/store";
import { applyStatusToSpans, isMfrLocked, isUserInactiveOnDate, MFR_TAG } from "@/lib/store/daily";
import type {
  ApprovalStatus,
  DailyTag,
  DocumentMeta,
  EmergencyContact,
  MemberType,
  User,
  UserStatus,
} from "@/lib/types";

/** Bank must be in Settings → Member bank catalog. */
export function clampMemberBank(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const banks = listMemberBanks();
  const hit = banks.find((b) => b.toLowerCase() === trimmed.toLowerCase());
  return hit ?? "";
}

export type UserInput = {
  name: string;
  personal_id: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
  force: string;
  religion: string;
  member_type: MemberType;
  dropdown_no: string;
  phone: string;
  documents: DocumentMeta[];
  documents_verified: boolean;
  status: UserStatus;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  branch_location: string;
  joining_date: string;
  out_date: string;
  default_tag: DailyTag;
  emergency_contacts: EmergencyContact[];
};

export function emptyEmergencyContact(): EmergencyContact {
  return { name: "", relation: "", phone: "" };
}

export type UserFormRequiredField =
  | "personal_no"
  | "card_number"
  | "nid"
  | "name"
  | "rank"
  | "wing"
  | "documents";

/** First missing required member field, else null. */
export function missingUserFormRequired(
  input: Pick<
    UserInput,
    "personal_id" | "name" | "rank" | "wing" | "documents" | "member_type" | "dropdown_no"
  >,
): UserFormRequiredField | null {
  if (input.member_type === "guest") {
    if (!input.name.trim()) return "name";
    return null;
  }
  if (input.member_type === "civilian") {
    if (!input.dropdown_no.trim()) return "card_number";
    if (!input.personal_id.trim()) return "nid";
  } else if (!input.personal_id.trim()) {
    return "personal_no";
  }
  if (!input.name.trim()) return "name";
  if (!input.rank.trim()) return "rank";
  if (!input.wing.trim()) return "wing";
  if (!input.documents?.length) return "documents";
  return null;
}

/** Hidden RAB ID for civilians — derived from card no. or NID. */
export function deriveCivilianRabId(
  input: Pick<UserInput, "dropdown_no" | "personal_id">,
): string {
  const card = input.dropdown_no.trim().replace(/\s+/g, "").toUpperCase();
  if (card) return `CIV-${card}`;
  const nid = input.personal_id.trim().replace(/\s+/g, "");
  if (nid) return `CIV-NID-${nid}`;
  return "";
}

export function prepareUserFormSubmit(input: UserInput): UserInput {
  if (input.member_type === "guest") {
    return {
      ...input,
      personal_id: "",
      rank: "",
      wing: "",
      force: "",
      religion: "",
      joining_date: "",
      out_date: "",
      bank_name: "",
      account_name: "",
      account_number: "",
      routing: "",
      branch: "",
      branch_location: "",
      documents: [],
      documents_verified: false,
      emergency_contacts: [],
    };
  }
  if (input.member_type !== "civilian") return input;
  const rab_id = input.rab_id.trim() || deriveCivilianRabId(input);
  return { ...input, rab_id };
}

/** Drop rows with all fields blank. */
export function cleanEmergencyContacts(
  contacts: EmergencyContact[],
): EmergencyContact[] {
  return contacts
    .map((c) => ({
      name: c.name.trim(),
      relation: c.relation.trim(),
      phone: normalizeBdPhone(c.phone.trim()),
    }))
    .filter((c) => c.name || c.relation || c.phone);
}

function newId() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export function listUsers() {
  return getState().users;
}

export function isGuestMember(user: Pick<User, "member_type">): boolean {
  return user.member_type === "guest";
}

/** Guest members live in CC/members — not Daily cockpit grids. */
export function isCockpitMember(user: Pick<User, "member_type">): boolean {
  return !isGuestMember(user);
}

export function filterCockpitMembers<T extends Pick<User, "member_type">>(
  users: T[],
): T[] {
  return users.filter(isCockpitMember);
}

/** Member table order: RAB ID → Rank → Name. */
export function compareUsers(a: User, b: User) {
  const id = a.rab_id.localeCompare(b.rab_id, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (id !== 0) return id;
  const ranks = listRanks();
  const ai = ranks.indexOf(a.rank);
  const bi = ranks.indexOf(b.rank);
  const rd = (ai === -1 ? ranks.length : ai) - (bi === -1 ? ranks.length : bi);
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
    rank: input.rank,
    wing: input.wing,
    bank_name: clampMemberBank(input.bank_name),
    account_number: digitsOnly(input.account_number),
    routing: digitsOnly(input.routing),
    branch_location: input.branch_location.trim(),
    phone: normalizeBdPhone(input.phone),
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
    documents_verified:
      input.member_type === "civilian" ? !!input.documents_verified : false,
    status: input.status,
    approval_status,
    default_tag: (input.default_tag || "MS") as DailyTag,
    inactive_spans:
      input.status === "0"
        ? [{ from: input.joining_date || "1970-01-01", to: null }]
        : [],
    created_at: ts,
    updated_at: ts,
  };
  setState((prev) => ({ ...prev, users: [user, ...prev.users] }));
  return user;
}

export function updateUser(id: string, input: UserInput): User | null {
  const existing = getUser(id);
  if (!existing) return null;
  const statusChanged = input.status !== existing.status;
  const inactive_spans = statusChanged
    ? applyStatusToSpans(
        existing.inactive_spans,
        input.status,
        existing.joining_date || input.joining_date,
      )
    : (existing.inactive_spans ?? []);
  const updated: User = {
    ...existing,
    ...input,
    name: input.name.trim(),
    rab_id: input.rab_id.trim(),
    member_type: input.member_type || existing.member_type || "permanent",
    rank: input.rank,
    wing: input.wing,
    bank_name: clampMemberBank(input.bank_name),
    account_number: digitsOnly(input.account_number),
    routing: digitsOnly(input.routing),
    branch_location: input.branch_location.trim(),
    phone: normalizeBdPhone(input.phone),
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
    documents_verified:
      (input.member_type || existing.member_type) === "civilian"
        ? !!input.documents_verified
        : false,
    default_tag: (isMfrLocked(existing)
      ? MFR_TAG
      : input.default_tag || existing.default_tag || "MS") as DailyTag,
    inactive_spans,
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    users: prev.users.map((u) => (u.id === id ? updated : u)),
    assignments: prev.assignments.filter(
      (a) => !(a.user_id === id && isUserInactiveOnDate(updated, a.date)),
    ),
  }));
  return updated;
}

/** Patch member bank fields only (ration desk). */
export function updateUserBank(
  id: string,
  bank: Pick<
    User,
    "bank_name" | "account_name" | "account_number" | "routing" | "branch" | "branch_location"
  >,
): User | null {
  const existing = getUser(id);
  if (!existing) return null;
  const updated: User = {
    ...existing,
    bank_name: clampMemberBank(bank.bank_name),
    account_name: bank.account_name.trim(),
    account_number: digitsOnly(bank.account_number),
    routing: digitsOnly(bank.routing),
    branch: bank.branch.trim(),
    branch_location: bank.branch_location.trim(),
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
