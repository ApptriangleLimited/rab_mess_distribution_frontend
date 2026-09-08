export type Role = "cc" | "daily" | "mess" | "consume" | "ration" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "ended";
export type UserStatus = "0" | "1";

/** Inclusive ISO dates. `to` is null while the member is still inactive. */
export interface InactiveSpan {
  from: string;
  to: string | null;
}

/** How the member is classified on create/edit. */
export type MemberType = "new" | "attached" | "permanent" | "guest" | "civilian";

export type BuiltInDailyTag =
  | "FR"
  | "CL"
  | "PL"
  | "WR"
  | "CD"
  | "WIT"
  | "MED"
  | "TRG"
  | "MS"
  | "MOL"
  | "CMH"
  | "RBH"
  | "BGH"
  | "AWL"
  | "OSL"
  | "RL"
  | "JL"
  | "PE"
  | "LNK"
  | "MFR";

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
  /** Parent force (Army, Navy, …). */
  force: string;
  religion: string;
  /** new | attached | permanent | civilian */
  member_type: MemberType;
  dropdown_no: string;
  phone: string;
  /** ABO blood group, e.g. `A+`. Empty if not set. */
  blood_group: string;
  documents: DocumentMeta[];
  /** Civilian: staff confirmed NID/birth-cert docs. */
  documents_verified: boolean;
  status: UserStatus;
  /**
   * Days the member was inactive. Those cockpit cells stay empty
   * (no default/carry) even after they are activated again.
   */
  inactive_spans: InactiveSpan[];
  approval_status: ApprovalStatus;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  branch_location: string;
  /** ISO `YYYY-MM-DD` — when member joined. */
  joining_date: string;
  /** ISO `YYYY-MM-DD` — when member left; empty if still active. */
  out_date: string;
  /**
   * Standing duty tag. Empty cockpit cells project this (not last painted tag).
   * Temp paints (e.g. CL) only affect stored days; after them, default resumes.
   */
  default_tag: DailyTag;
  /**
   * Last painted JL date. Days after this stay empty; on the next calendar
   * day the member is set inactive. Cleared once inactivation is applied.
   */
  jl_end_date: string;
  emergency_contacts: EmergencyContact[];
  created_at: string;
  updated_at: string;
}

/** TRG day color — Army/Navy/Air Force (or Police + Sarda) vs everyone else. */
export type TrgTone = "black" | "red";

export interface DailyAssignment {
  id: string;
  user_id: string;
  date: string;
  tag: DailyTag;
  /** Set when `tag` is TRG. Black = white label; red = other forces. */
  trg_tone?: TrgTone;
  updated_by: string;
  updated_at: string;
}

export type TagRequestStatus = "requested" | "updated" | "rejected";

/** Who must approve the cockpit tag change. */
export type TagRequestQueue = "daily" | "ration" | "consume";

/** CC→Daily, or Daily→Ration (FR/CD), or Daily→Consume (other tags). */
export interface TagRequest {
  id: string;
  user_id: string;
  /** ISO date the request was made for (usually today). */
  date: string;
  /** Inclusive range to apply on approve. */
  from_date: string;
  to_date: string;
  from_tag: DailyTag | "";
  to_tag: DailyTag;
  /** Snapshot when Daily requests TRG. Applied to cockpit days on approve. */
  trg_tone?: TrgTone;
  trg_sarda?: boolean;
  queue: TagRequestQueue;
  status: TagRequestStatus;
  requested_by: string;
  requested_at: string;
  updated_by?: string;
  updated_at?: string;
}

export interface SenderAccount {
  id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  branch_location: string;
  mapped_tags: DailyTag[];
  /** false = deactivated; hidden from payout pickers. Default active. */
  active?: boolean;
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

export type MealShiftId = string;

export interface MealShift {
  id: MealShiftId;
  name: string;
  start_time: string;
  end_time: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MealPlanMeal {
  shift_id: MealShiftId;
  count: number;
}

/** CMS meal-allowance analog: date + per-shift counts (single mess, no branch). */
export interface MealPlan {
  id: string;
  date: string;
  meals: MealPlanMeal[];
  created_at: string;
  updated_at: string;
}

export type MealAssignStatus = 1 | 2;

/** CMS meal_assigns analog: check-in row. 1 = unique, 2 = duplicate. */
export interface MealAssign {
  id: string;
  member_id: string;
  shift_id: MealShiftId;
  status: MealAssignStatus;
  date: string;
  check_in_time: string;
  created_at: string;
  updated_at: string;
}

/** CMS guest_meals analog: named visitor check-in. No create UI. */
export interface GuestMeal {
  id: string;
  shift_id: MealShiftId;
  date: string;
  check_in_time: string;
  guest_name: string;
  guest_info: string;
  ref_info: string;
  created_at: string;
  updated_at: string;
}


/** Authorized strength row (Settings → Authorized). */
export interface AuthorizedStrength {
  id: string;
  label: string;
  /** HQ / category total — equals sum of `wings` when any wing set. */
  count: number;
  /** Per-wing প্রাধিকৃত (root wing label → count). */
  wings: Record<string, number>;
  /**
   * Officer-only per-wing প্রাপ্ত (held).
   * Form 1: wing Officer প্রাপ্ত + HQ Officer প্রাপ্ত = sum.
   */
  held_wings?: Record<string, number>;
}

export type PritibhojRow = {
  wing: string;
  officer: number;
  dad: number;
  azadHall: number;
  distribution: number;
  others: number;
  civilian: number;
  nonMuslim: number;
  total: number;
  azadHallDist: number;
  distribution2: number;
  totalDistribution: number;
};

export type PritibhojEvent = {
  id: string;
  title: string;
  occasion: string;
  date: string;
  org: string;
  created_at: string;
  main_rows: PritibhojRow[];
  admin_rows: PritibhojRow[];
};

export interface AppState {
  users: User[];
  assignments: DailyAssignment[];
  /** CC → Daily cockpit tag change requests. */
  tag_requests: TagRequest[];
  senders: SenderAccount[];
  rates: AllowanceRate[];
  /** Editable rank ladder (order = seniority for sort). */
  ranks: string[];
  /** Editable wing / unit labels (flat catalog; tree via wing_parent). Short forms. */
  wings: string[];
  /** Child wing → parent wing. Roots omit / missing. Nested sub-wings OK. */
  wing_parent: Record<string, string>;
  /** Elaborate names for wings (`short` → full), overrides defaults. */
  wing_labels: Record<string, string>;
  /** Parent forces (Army, Navy, …) — editable in Settings. */
  forces: string[];
  /** Ranks assigned under each force (`force` → service rank labels). */
  force_ranks: Record<string, string[]>;
  /** User-added service ranks beyond defaults (`force` → short labels). */
  force_rank_extras: Record<string, string[]>;
  /** Default ladder ranks hidden by user (`force` → short labels). */
  force_rank_removed: Record<string, string[]>;
  /** Elaborate names for force service ranks (`force` → short → full). */
  force_rank_labels: Record<string, Record<string, string>>;
  /** Elaborate names for RAB ranks (`short` → full), overrides defaults. */
  rank_labels: Record<string, string>;
  /** Forces linked under each RAB rank (`rab rank` → force labels). */
  rank_forces: Record<string, string[]>;
  /**
   * RAB rank ↔ force service-rank equivalents
   * (`rab rank` → `force` → service ranks).
   * e.g. DAD → Army → [OR, L/CPL]; DAD → Police → [Insp].
   */
  rank_equivalents: Record<string, Record<string, string[]>>;
  /** Wings under each rank+force (`rank` → `force` → wing labels). */
  rank_force_wings: Record<string, Record<string, string[]>>;
  /** Bank names for member register / edit form picklist. */
  member_banks: string[];
  /** Authorized strength categories (label + count). */
  authorized: AuthorizedStrength[];
  /**
   * Form 1 Officer অনুপস্থিত by date + wing
   * (`YYYY-MM-DD` → wing label → count).
   * উপস্থিত = প্রাপ্ত − this.
   */
  manpower_officer_absent: Record<string, Record<string, number>>;
  /** ISO dates Daily has confirmed (carry + edits locked as approved). */
  approved_dates: string[];
  /** `${userId}|${date}` — hide carry ghost until Approve restores or new tag set. */
  suppressed_carries: string[];
  /** ISO dates marked Boro Khana (special mess day — everyone eats). */
  boro_khana_dates: string[];
  /** Daily duty-state snapshots submitted for Admin approval. */
  state_reports: DailyStateReport[];
  /** Mess kitchen plan: one row per date, counts per meal shift. */
  meal_plans: MealPlan[];
  /** Check-ins for Meal reports (CMS meal_assigns). */
  meal_assigns: MealAssign[];
  /** Kitchen windows (CMS shifts). */
  meal_shifts: MealShift[];
  /** Named guest check-ins (CMS guest_meals). */
  guest_meals: GuestMeal[];
  /** Saved Pritibhoj feast manpower sheets. */
  pritibhoj_events: PritibhojEvent[];
  version: number;
}
