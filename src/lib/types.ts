export type Role = "cc" | "daily" | "mess" | "consume" | "ration" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "ended";
export type UserStatus = "0" | "1";

/** How the member is classified on create/edit. */
export type MemberType = "new" | "attached" | "permanent";

export type BuiltInDailyTag =
  | "FR"
  | "CL"
  | "PL"
  | "WR"
  | "CD"
  | "WIT"
  | "MED"
  | "TRG"
  | "MS";

/** Built-in duty tags + custom allowance codes (ration). */
export type DailyTag = BuiltInDailyTag | (string & {});

export interface DocumentMeta {
  name: string;
  size: number;
  url?: string;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  /** National / personal identity number. */
  personal_id: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
  /** new | attached | permanent — New has no rank/wing. */
  member_type: MemberType;
  dropdown_no: string;
  phone: string;
  documents: DocumentMeta[];
  status: UserStatus;
  approval_status: ApprovalStatus;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  /** ISO `YYYY-MM-DD` — when member joined. */
  joining_date: string;
  /** ISO `YYYY-MM-DD` — when member left; empty if still active. */
  out_date: string;
  emergency_contacts: EmergencyContact[];
  created_at: string;
  updated_at: string;
}

export interface DailyAssignment {
  id: string;
  user_id: string;
  date: string;
  tag: DailyTag;
  updated_by: string;
  updated_at: string;
}

export interface SenderAccount {
  id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  mapped_tags: DailyTag[];
}

export interface AllowanceRate {
  tag: DailyTag;
  amount_per_day: number;
}

export interface Session {
  role: Role;
  name: string;
  loggedInAt: string;
}

export type StateReportStatus = "pending" | "approved" | "rejected";

export type StateReportMember = {
  user_id: string;
  /** Projected or explicit duty tag for the report date. */
  tag: DailyTag | "";
  /** Mess list reason when Boro Khana; null on normal days. */
  mess_reason?: "MS" | "FR" | "BK" | null;
  name: string;
  rab_id: string;
  rank: string;
  wing: string;
};

export type DailyStateReport = {
  id: string;
  date: string;
  status: StateReportStatus;
  submitted_at: string;
  submitted_by: string;
  reviewed_at?: string;
  reviewed_by?: string;
  note?: string;
  boro_khana: boolean;
  members: StateReportMember[];
  totals: {
    active: number;
    by_tag: Partial<Record<DailyTag, number>>;
    mess_eaters: number;
  };
};

export interface AppState {
  users: User[];
  assignments: DailyAssignment[];
  senders: SenderAccount[];
  rates: AllowanceRate[];
  /** ISO dates Daily has confirmed (carry + edits locked as approved). */
  approved_dates: string[];
  /** `${userId}|${date}` — hide carry ghost until Approve restores or new tag set. */
  suppressed_carries: string[];
  /** ISO dates marked Boro Khana (special mess day — everyone eats). */
  boro_khana_dates: string[];
  /** Daily duty-state snapshots submitted for Admin approval. */
  state_reports: DailyStateReport[];
  version: number;
}
