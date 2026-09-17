import { ApiClientError, apiJson } from "@/lib/api/client";
import { isOldPublicApiHost } from "@/lib/api/compat";
import type { AuthorizedStrength, DailyTag, MemberType, User } from "@/lib/types";

export type ManpowerDayMember = {
  id: string;
  name: string;
  rank: string;
  wing: string;
  member_type: string;
  status: string;
  approval_status: string;
  default_tag: string;
  tag: string;
  source: string;
};

export type ManpowerDayData = {
  date: string;
  members: ManpowerDayMember[];
  authorized: AuthorizedStrength[];
  officer_absent: Record<string, number>;
  wings: string[];
  wing_parent: Record<string, string>;
};

export function fetchManpowerDay(day: string) {
  if (isOldPublicApiHost()) {
    return Promise.reject(
      new ApiClientError(
        404,
        "API_FEATURE_MISSING",
        "Manpower reports are not available on this API.",
      ),
    );
  }
  return apiJson<ManpowerDayData>(
    `/api/v1/reports/manpower?day=${encodeURIComponent(day)}`,
  );
}

function asMemberType(value: string): MemberType {
  if (
    value === "new" ||
    value === "attached" ||
    value === "permanent" ||
    value === "guest" ||
    value === "civilian"
  ) {
    return value;
  }
  return "permanent";
}

/** Slim user for report builders — already filtered by the API. */
export function manpowerMemberToUser(row: ManpowerDayMember): User {
  return {
    id: row.id,
    name: row.name,
    personal_id: "",
    rab_id: "",
    rfid: "",
    rank: row.rank,
    wing: row.wing,
    force: "",
    force_rank: "",
    religion: "",
    member_type: asMemberType(row.member_type),
    dropdown_no: "",
    phone: "",
    blood_group: "",
    documents: [],
    documents_verified: false,
    status: row.status === "0" ? "0" : "1",
    inactive_spans: [],
    approval_status:
      row.approval_status === "approved" ? "approved" : "pending",
    bank_name: "",
    account_name: "",
    account_number: "",
    routing: "",
    branch: "",
    branch_location: "",
    joining_date: "",
    duty_start: "",
    out_date: "",
    default_tag: (row.default_tag || "MS").toUpperCase() as DailyTag,
    jl_end_date: "",
    emergency_contacts: [],
    created_at: "",
    updated_at: "",
  };
}
