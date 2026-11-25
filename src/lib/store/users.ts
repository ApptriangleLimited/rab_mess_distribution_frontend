import { rankOfficialSerial } from "@/lib/constants";
import { nowISO, todayISO } from "@/lib/date";
import { digitsOnly, isValidBdPhone, normalizeBdPhone } from "@/lib/utils";
import {
  isAdminRootName,
  isHqBranchName,
  listMemberBanks,
  memberMatchesWingFilter,
} from "@/lib/store/org-options";
import { getState, setState } from "@/lib/store";
import { applyStatusToSpans, isJlTag, isMfrLocked, isMfrTag, isUserInactiveOnDate, JL_TAG, MFR_TAG } from "@/lib/store/daily";
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
  force_rank: string;
  religion: string;
  member_type: MemberType;
  dropdown_no: string;
  phone: string;
  blood_group: string;
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
  | "nid"
  | "name"
  | "rank"
  | "wing"
  | "sub_wing"
  | "hq_wing"
  | "force_rank"
  | "documents"
  | "bank"
  | "rab_id";

/** First missing required member field, else null. SRB ID is required only for permanent. */
export function missingUserFormRequired(
  input: Pick<
    UserInput,
    | "personal_id"
    | "rab_id"
    | "name"
    | "rank"
    | "wing"
    | "force"
    | "force_rank"
    | "documents"
    | "member_type"
    | "bank_name"
    | "account_name"
    | "account_number"
    | "routing"
    | "branch"
    | "branch_location"
  >,
): UserFormRequiredField | null {
  if (input.member_type === "guest") {
    if (!input.name.trim()) return "name";
    return null;
  }
  if (!input.personal_id.trim()) {
    return input.member_type === "civilian" ? "nid" : "personal_no";
  }
  if (!input.name.trim()) return "name";
  if (!input.rank.trim()) return "rank";
  if (!input.wing.trim()) return "wing";
  if (isAdminRootName(input.wing)) return "sub_wing";
  if (isHqBranchName(input.wing)) return "hq_wing";
  if (!input.documents?.length) return "documents";
  if (input.member_type === "permanent" && !input.rab_id.trim()) {
    return "rab_id";
  }
  if (input.member_type === "permanent") {
    if (
      !input.bank_name.trim() ||
      !input.account_name.trim() ||
      !input.account_number.trim() ||
      !input.routing.trim() ||
      !input.branch.trim() ||
      !input.branch_location.trim()
    ) {
      return "bank";
    }
  }
  return null;
}

/** Hidden SRB ID for civilians — derived from card no. or NID. */
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
      force_rank: "",
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
  return sortUsersNewestFirst(getState().users);
}

export function isGuestMember(user: Pick<User, "member_type">): boolean {
  return user.member_type === "guest";
}

export function isCivilianMember(user: Pick<User, "member_type">): boolean {
  return user.member_type === "civilian";
}

/** Guest / civilian live in the member list — not Daily RR / cockpit grids. */
export function isCockpitMember(user: Pick<User, "member_type">): boolean {
  return !isGuestMember(user) && !isCivilianMember(user);
}

export function filterCockpitMembers<T extends Pick<User, "member_type">>(
  users: T[],
): T[] {
  return users.filter(isCockpitMember);
}

/** Daily RR / print order: Settings SRB rank serial → name. */
export function compareUsersByRankSerial(a: User, b: User) {
  const serials = getState().rank_serials;
  const as = rankOfficialSerial(a.rank, serials) ?? 10_000;
  const bs = rankOfficialSerial(b.rank, serials) ?? 10_000;
  if (as !== bs) return as - bs;
  return a.name.localeCompare(b.name);
}

/** Duty / bill order: SRB rank serial → Name. */
export function compareUsers(a: User, b: User) {
  return compareUsersByRankSerial(a, b);
}

/** Member / request lists: last created first. */
export function compareUsersNewestFirst(a: User, b: User) {
  const created = (b.created_at || "").localeCompare(a.created_at || "");
  if (created !== 0) return created;
  const updated = (b.updated_at || "").localeCompare(a.updated_at || "");
  if (updated !== 0) return updated;
  return b.id.localeCompare(a.id);
}

export function sortUsers(users: User[]) {
  return [...users].sort(compareUsers);
}

export function sortUsersNewestFirst(users: User[]) {
  return [...users].sort(compareUsersNewestFirst);
}

export function getUser(id: string) {
  return getState().users.find((u) => u.id === id) ?? null;
}

export function findUserByRabId(rabId: string, excludeId?: string) {
  const normalized = rabId.trim().toLowerCase();
  if (!normalized) return null;
  return (
    getState().users.find(
      (u) =>
        u.rab_id.trim().toLowerCase() === normalized &&
        u.approval_status !== "rejected" &&
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
    blood_group: input.blood_group.trim(),
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
    documents_verified:
      input.member_type === "civilian" ? !!input.documents_verified : false,
    status: input.status,
    approval_status,
    default_tag: (approval_status === "pending"
      ? ""
      : input.default_tag || "") as DailyTag,
    duty_start:
      approval_status === "approved" ? input.joining_date || todayISO() : "",
    jl_end_date: "",
    inactive_spans:
      input.status === "0"
        ? [{ from: todayISO(), to: null }]
        : [],
    created_at: ts,
    updated_at: ts,
  };
  const rabKey = user.rab_id.trim().toLowerCase();
  setState((prev) => ({
    ...prev,
    users: [
      user,
      ...prev.users.filter(
        (u) =>
          !(
            u.approval_status === "rejected" &&
            rabKey &&
            u.rab_id.trim().toLowerCase() === rabKey
          ),
      ),
    ],
  }));
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
    blood_group: input.blood_group.trim(),
    emergency_contacts: cleanEmergencyContacts(input.emergency_contacts ?? []),
    documents_verified:
      (input.member_type || existing.member_type) === "civilian"
        ? !!input.documents_verified
        : false,
    default_tag: (isMfrLocked(existing)
      ? isJlTag(input.default_tag)
        ? JL_TAG
        : MFR_TAG
      : isMfrTag(input.default_tag)
        ? existing.default_tag || ""
        : input.default_tag || existing.default_tag || "") as DailyTag,
    jl_end_date: input.status === "1" ? "" : existing.jl_end_date,
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
  member_type?: MemberType | "all";
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
      if (
        (!filters.approval || filters.approval === "all") &&
        u.approval_status === "rejected"
      ) {
        return false;
      }
      if (
        filters.wing &&
        filters.wing !== "all" &&
        !memberMatchesWingFilter(u.wing, filters.wing)
      ) {
        return false;
      }
      if (filters.rank && filters.rank !== "all" && u.rank !== filters.rank) {
        return false;
      }
      if (
        filters.member_type &&
        filters.member_type !== "all" &&
        (u.member_type ?? "permanent") !== filters.member_type
      ) {
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
    .sort(compareUsersNewestFirst);
}

export function userFiltersToSearchParams(filters: UserFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim() ?? "";
  if (q) params.set("q", q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.approval && filters.approval !== "all") {
    params.set("approval", filters.approval);
  }
  if (filters.member_type && filters.member_type !== "all") {
    params.set("member_type", filters.member_type);
  }
  if (filters.wing && filters.wing !== "all") params.set("wing", filters.wing);
  if (filters.rank && filters.rank !== "all") params.set("rank", filters.rank);
  if (filters.date_from?.trim()) params.set("date_from", filters.date_from.trim());
  if (filters.date_to?.trim()) params.set("date_to", filters.date_to.trim());
  return params;
}

export function userFiltersFromSearchParams(
  search: Pick<URLSearchParams, "get">,
): UserFilters {
  const status = search.get("status");
  const approval = search.get("approval");
  const memberType = search.get("member_type");
  return {
    q: search.get("q") ?? "",
    status: status === "0" || status === "1" ? status : "all",
    approval:
      approval === "pending" ||
      approval === "approved" ||
      approval === "rejected" ||
      approval === "ended"
        ? approval
        : "all",
    member_type:
      memberType === "new" ||
      memberType === "attached" ||
      memberType === "permanent" ||
      memberType === "guest" ||
      memberType === "civilian"
        ? memberType
        : "all",
    wing: search.get("wing") || "all",
    rank: search.get("rank") || "all",
    date_from: search.get("date_from") ?? "",
    date_to: search.get("date_to") ?? "",
  };
}
