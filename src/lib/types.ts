export type Role = "cc" | "daily" | "mess" | "consume" | "ration";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "ended";
export type UserStatus = "0" | "1";

export type DailyTag =
  | "FR"
  | "CL"
  | "PL"
  | "WR"
  | "CD"
  | "WIT"
  | "MED"
  | "TRG"
  | "MS";

export interface DocumentMeta {
  name: string;
  size: number;
  url?: string;
}

export interface User {
  id: string;
  name: string;
  rab_id: string;
  rfid: string;
  rank: string;
  wing: string;
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

export interface AppState {
  users: User[];
  assignments: DailyAssignment[];
  senders: SenderAccount[];
  rates: AllowanceRate[];
  /** ISO dates Daily has confirmed (carry + edits locked as approved). */
  approved_dates: string[];
  /** `${userId}|${date}` — hide carry ghost until Approve restores or new tag set. */
  suppressed_carries: string[];
  version: number;
}
