import { apiJson } from "@/lib/api/client";
import { toMemberEntryBody } from "@/lib/api/register";
import type { UserFormValues } from "@/components/users/user-form";
import type { ApprovalStatus, MemberType, User, UserStatus, DailyTag } from "@/lib/types";

export type MemberListParams = {
  q?: string;
  status?: string;
  approval?: string;
  wing?: string;
  rank?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

export type MemberListData = {
  items: MemberApiRow[];
  total: number;
  page: number;
  page_size: number;
};

export type MemberApiRow = {
  id: string;
  name: string;
  personal_id: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
  member_type: string;
  dropdown_no: string;
  phone: string;
  documents: User["documents"];
  status: string;
  approval_status: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  branch_location: string;
  joining_date: string | null;
  out_date: string | null;
  default_tag?: string;
  emergency_contacts: User["emergency_contacts"];
  created_at: string;
  updated_at: string;
};

function asApproval(value: string): ApprovalStatus {
  if (value === "accepted") return "approved";
  if (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "ended"
  ) {
    return value;
  }
  return "pending";
}

function asMemberType(value: string): MemberType {
  if (
    value === "new" ||
    value === "attached" ||
    value === "permanent" ||
    value === "guest" ||
    value === "civilian"
  )
    return value;
  return "permanent";
}

/** Map API member row → FE `User` shape. */
export function memberToUser(row: MemberApiRow): User {
  return {
    id: row.id,
    name: row.name,
    personal_id: row.personal_id ?? "",
    rab_id: row.rab_id,
    rfid: row.rfid ?? "",
    rank: row.rank ?? "",
    wing: row.wing ?? "",
    force: "",
    religion: "",
    member_type: asMemberType(row.member_type),
    dropdown_no: row.dropdown_no ?? "",
    phone: row.phone ?? "",
    documents: row.documents ?? [],
    documents_verified: Boolean(
      (row as MemberApiRow & { documents_verified?: boolean }).documents_verified,
    ),
    status: (row.status === "1" ? "1" : "0") as UserStatus,
    approval_status: asApproval(row.approval_status),
    bank_name: row.bank_name ?? "",
    account_name: row.account_name ?? "",
    account_number: row.account_number ?? "",
    routing: row.routing ?? "",
    branch: row.branch ?? "",
    branch_location: row.branch_location ?? "",
    joining_date: row.joining_date ?? "",
    out_date: row.out_date ?? "",
    default_tag: ((row.default_tag || "MS").toUpperCase() || "MS") as DailyTag,
    inactive_spans: [],
    emergency_contacts: row.emergency_contacts ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listMembers(params: MemberListParams = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiJson<MemberListData>(`/api/v1/members${suffix}`);
}

export type CreateMemberOpts = {
  status?: "0" | "1";
  approval_status?: ApprovalStatus;
};

/** Staff create — `POST /api/v1/members` (Bearer). */
export function createMember(
  values: UserFormValues,
  opts: CreateMemberOpts = {},
) {
  return apiJson<MemberApiRow>("/api/v1/members", {
    method: "POST",
    body: JSON.stringify({
      ...toMemberEntryBody(values),
      status: opts.status ?? values.status ?? "1",
      approval_status: opts.approval_status ?? "pending",
    }),
  });
}
