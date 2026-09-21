import { ApiClientError, apiJson } from "@/lib/api/client";
import { todayISO } from "@/lib/date";
import {
  isApiFeatureMissing,
  isLegacyLiveApi,
  rememberMissingRoute,
} from "@/lib/api/compat";
import { normalizeDocuments } from "@/lib/api/files";
import { toMemberEntryBody } from "@/lib/api/register";
import type { UserFormValues } from "@/components/users/user-form";
import type { ApprovalStatus, MemberType, User, UserStatus, DailyTag } from "@/lib/types";

export type MemberListParams = {
  q?: string;
  status?: string;
  approval?: string;
  wing?: string;
  rank?: string;
  member_type?: string;
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
  force?: string;
  force_rank?: string;
  religion?: string;
  member_type: string;
  dropdown_no: string;
  phone: string;
  blood_group?: string;
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
  duty_start?: string | null;
  default_tag?: string;
  jl_end_date?: string;
  inactive_spans?: User["inactive_spans"];
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
    force: row.force ?? "",
    force_rank: row.force_rank ?? "",
    religion: row.religion ?? "",
    member_type: asMemberType(row.member_type),
    dropdown_no: row.dropdown_no ?? "",
    phone: row.phone ?? "",
    blood_group: row.blood_group ?? "",
    documents: normalizeDocuments(row.documents),
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
    duty_start: row.duty_start ?? "",
    out_date: row.out_date ?? "",
    default_tag: ((row.default_tag || "").toUpperCase() || "") as DailyTag,
    jl_end_date:
      (row as MemberApiRow & { jl_end_date?: string }).jl_end_date ?? "",
    inactive_spans: Array.isArray(
      (row as MemberApiRow & { inactive_spans?: User["inactive_spans"] })
        .inactive_spans,
    )
      ? (row as MemberApiRow & { inactive_spans: User["inactive_spans"] })
          .inactive_spans
      : row.status !== "1"
        ? [{ from: todayISO(), to: null }]
        : [],
    emergency_contacts: row.emergency_contacts ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Every member (all approval states), paging past the first 500. */
export async function listAllMembers() {
  const pageSize = 500;
  const first = await listMembers({ page: 1, page_size: pageSize });
  const items = [...(first.items ?? [])];
  const total = first.total ?? items.length;
  const pages = Math.min(20, Math.ceil(total / pageSize) || 1);
  if (pages <= 1) return items;

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      listMembers({ page: i + 2, page_size: pageSize }),
    ),
  );
  for (const data of rest) items.push(...(data.items ?? []));
  return items;
}

/** Every approved member, paging past the first 500. Default: active only. */
export async function listAllApprovedMembers(opts?: { status?: string }) {
  const pageSize = 500;
  const query = {
    approval: "approved" as const,
    status: opts?.status ?? "1",
    page_size: pageSize,
  };
  const first = await listMembers({ ...query, page: 1 });
  const items = [...(first.items ?? [])];
  const total = first.total ?? items.length;
  const pages = Math.min(50, Math.ceil(total / pageSize) || 1);
  if (pages <= 1) return items;

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      listMembers({ ...query, page: i + 2 }),
    ),
  );
  for (const data of rest) items.push(...(data.items ?? []));
  return items;
}

export function listMembers(params: MemberListParams = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiJson<MemberListData>(`/api/v1/members${suffix}`).then((data) => ({
    ...data,
    items: [...(data.items ?? [])].sort((a, b) => {
      const created = (b.created_at || "").localeCompare(a.created_at || "");
      if (created !== 0) return created;
      const updated = (b.updated_at || "").localeCompare(a.updated_at || "");
      if (updated !== 0) return updated;
      return (b.id || "").localeCompare(a.id || "");
    }),
  }));
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

async function getMemberFromList(id: string) {
  const pageSize = 200;
  let page = 1;
  let total = Infinity;
  while ((page - 1) * pageSize < total) {
    const data = await listMembers({ page, page_size: pageSize });
    const row = data.items.find((item) => item.id === id);
    if (row) return row;
    total = data.total ?? data.items.length;
    if (!data.items.length) break;
    page += 1;
    if (page > 25) break;
  }
  throw new ApiClientError(404, "NOT_FOUND", "User not found");
}

export async function getMember(id: string) {
  if (isLegacyLiveApi() || isApiFeatureMissing("member-get")) {
    return getMemberFromList(id);
  }
  try {
    return await apiJson<MemberApiRow>(`/api/v1/members/${id}`);
  } catch (err) {
    if (rememberMissingRoute("member-get", err)) return getMemberFromList(id);
    throw err;
  }
}

export function updateMember(id: string, values: UserFormValues) {
  return apiJson<MemberApiRow>(`/api/v1/members/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...toMemberEntryBody(values),
      status: values.status ?? "1",
    }),
  });
}

export function acceptMember(id: string, tag?: DailyTag) {
  return apiJson<MemberApiRow>(`/api/v1/members/${id}/accept`, {
    method: "PATCH",
    body: JSON.stringify(tag ? { tag } : {}),
  });
}

export function rejectMember(id: string) {
  return apiJson<MemberApiRow>(`/api/v1/members/${id}/reject`, {
    method: "PATCH",
  });
}

export function updateMemberTag(id: string, tag: DailyTag) {
  return apiJson<MemberApiRow>(`/api/v1/members/${id}/tag`, {
    method: "PATCH",
    body: JSON.stringify({ tag }),
  });
}

export function updateMemberStatus(id: string, status: UserStatus) {
  return apiJson<MemberApiRow>(`/api/v1/members/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
