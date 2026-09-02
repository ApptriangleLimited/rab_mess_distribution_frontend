import type {
  AuthorizedStrength,
  BuiltInDailyTag,
  DailyTag,
  MemberType,
  Role,
} from "@/lib/types";
import type { MessageKey } from "@/i18n";

export const ROLE_HOMES: Record<Role, string> = {
  cc: "/cc/users",
  daily: "/daily/tags",
  mess: "/mess/ledger",
  consume: "/consume/monthly/ledger",
  ration: "/ration/monthly",
  admin: "/admin",
};

/** @deprecated Prefer t(`roles.${role}`) — kept for non-UI code paths. */
export const ROLE_KEYS = [
  "cc",
  "daily",
  "mess",
  "consume",
  "ration",
  "admin",
] as const satisfies readonly Role[];

/** Login / switcher pickers — no roles hidden. */
export const HIDDEN_ROLES = new Set<Role>([]);

export const VISIBLE_ROLE_KEYS = ROLE_KEYS.filter(
  (r) => !HIDDEN_ROLES.has(r),
) as Role[];

/** Picker list: visible roles + current if it is hidden (so switch-away still works). */
export function rolesForPicker(current?: Role | null): Role[] {
  if (current && HIDDEN_ROLES.has(current)) {
    return ROLE_KEYS.filter((r) => !HIDDEN_ROLES.has(r) || r === current);
  }
  return VISIBLE_ROLE_KEYS;
}

/** Ration + Admin share consume/ration panels. */
export function isRationFamily(role?: Role | null) {
  return role === "ration" || role === "admin";
}

/** Tags visible on Mess Distributioner ledger. */
export const MESS_LEDGER_TAGS: DailyTag[] = ["MS", "CD"];

export const DAILY_TAGS: {
  code: BuiltInDailyTag;
  labelKey: MessageKey;
  allowance: boolean;
  mess: boolean;
}[] = [
  { code: "FR", labelKey: "tags.FR", allowance: true, mess: false },
  { code: "CL", labelKey: "tags.CL", allowance: false, mess: false },
  { code: "PL", labelKey: "tags.PL", allowance: false, mess: false },
  { code: "WR", labelKey: "tags.WR", allowance: false, mess: false },
  { code: "CD", labelKey: "tags.CD", allowance: false, mess: false },
  { code: "WIT", labelKey: "tags.WIT", allowance: false, mess: false },
  { code: "MED", labelKey: "tags.MED", allowance: false, mess: false },
  { code: "TRG", labelKey: "tags.TRG", allowance: false, mess: false },
  { code: "MS", labelKey: "tags.MS", allowance: true, mess: true },
  { code: "MOL", labelKey: "tags.MOL", allowance: true, mess: false },
  { code: "CMH", labelKey: "tags.CMH", allowance: true, mess: false },
  { code: "RBH", labelKey: "tags.RBH", allowance: true, mess: false },
  { code: "BGH", labelKey: "tags.BGH", allowance: true, mess: false },
  { code: "AWL", labelKey: "tags.AWL", allowance: true, mess: false },
  { code: "OSL", labelKey: "tags.OSL", allowance: true, mess: false },
];

/** Rate-only codes — Settings list yes, daily/consume tag pickers no. */
export const FUEL_RATE_TAG = "FUEL" as const;
/** Fixed monthly Fresh Ration for MS members' CL days (≠ FR daily rate). */
export const CL_FR_MONTHLY_TAG = "CLFR" as const;

export const RATE_ONLY_TAGS: {
  code: typeof FUEL_RATE_TAG | typeof CL_FR_MONTHLY_TAG;
  labelKey: MessageKey;
  /** FUEL = ৳/day; CLFR = fixed ৳/month. */
  defaultAmount: number;
}[] = [
  { code: FUEL_RATE_TAG, labelKey: "tags.FUEL", defaultAmount: 50 },
  {
    code: CL_FR_MONTHLY_TAG,
    labelKey: "tags.CLFR",
    defaultAmount: 2500,
  },
];

export function isRateOnlyTag(tag: string) {
  const key = tag.toLowerCase();
  return RATE_ONLY_TAGS.some((t) => t.code.toLowerCase() === key);
}

export function isProtectedRateTag(tag: string) {
  const key = tag.toLowerCase();
  return (
    DAILY_TAGS.some((t) => t.code.toLowerCase() === key) || isRateOnlyTag(tag)
  );
}

/**
 * Main RAB wings / branches (short form = stored value).
 * Admin rows have no short — store full name.
 */
export const WINGS = [
  "Ops Wg",
  "Int Wg",
  "L & M Wg",
  "Air Wg",
  "Comm & MIS Wg",
  "Inv Wg",
  "Trg Wg",
  "RFTS",
  "Training School",
  "R & D Cell",
  "Admin",
  "Admin (New)",
  "Admin (Old)",
] as const;

/** Admin sub-branches (short = stored value; parent = Admin only). */
export const ADMIN_SUB_WINGS = [
  "DG Office",
  "ADG (Ops) Office",
  "ADG (Admin) Office",
  "Fin Br",
  "Per Br",
  "Gen Br",
  "Sup Br",
  "HQ Br",
  "Med Br",
  "Rec Br",
  "Proc Br",
  "Budget Br",
  "Dev Br",
  "Wksp Br",
  "MT Br",
  "Rat Br",
  "Proj Br",
  "Security Branch - IEC Cell",
] as const;

/** HQ Br hub-wings (parent = HQ Br only). */
export const HQ_SUB_WINGS = [
  "Headquarters Branch",
  "Headquarters Office",
  "Security Branch",
  "Record Branch",
  "Forces Mess",
  "Field Mess",
  "MT Branch",
  "New / Temporary Attached",
] as const;

/** Default child → parent links for catalog sub-wings. */
export const DEFAULT_WING_PARENT: Record<string, string> = {
  ...Object.fromEntries(ADMIN_SUB_WINGS.map((wing) => [wing, "Admin"])),
  ...Object.fromEntries(HQ_SUB_WINGS.map((wing) => [wing, "HQ Br"])),
};

/** Full wing / branch names for short forms. */
export const WING_LABELS: Record<string, string> = {
  "Ops Wg": "Operations Wing",
  "Int Wg": "Intelligence Wing",
  "L & M Wg": "Legal & Media Wing",
  "Air Wg": "Air Wing",
  "Comm & MIS Wg": "Communication & MIS Wing",
  "Inv Wg": "Investigation & Forensic Wing",
  "Trg Wg": "Training & Orientation Wing",
  RFTS: "RAB Forces Training School",
  "Training School": "Training School",
  "R & D Cell": "Research & Development Cell",
  Admin: "Admin",
  "Admin (New)": "Admin (New)",
  "Admin (Old)": "Admin (Old)",
  "Fin Br": "Finance Branch",
  "Per Br": "Personnel Branch",
  "Gen Br": "General Branch",
  "Sup Br": "Supply Branch",
  "HQ Br": "Headquarters Branch",
  "Med Br": "Medical Branch",
  "Rec Br": "Record Branch",
  "Proc Br": "Procurement Branch",
  "Budget Br": "Budget Branch",
  "Dev Br": "Development Branch",
  "Wksp Br": "Central Workshop Branch",
  "MT Br": "MT Branch",
  "Rat Br": "Ration Office",
  "Proj Br": "Project Branch",
};

/** Bank names for member register form picklist. */
export const MEMBER_BANKS = [
  "Trust bank",
  "Community bank",
  "Sonali Bank",
] as const;

/** Pre–catalog member-bank seed (replaced by MEMBER_BANKS on normalize). */
export const LEGACY_MEMBER_BANKS = [
  "Bangladesh Bank",
  "Agrani Bank",
  "Janata Bank",
  "Pubali Bank",
  "BRAC Bank",
  "City Bank",
  "Dutch Bangla Bank",
  "Islami Bank",
] as const;


/** Bank branch districts (Bangladesh) — searchable picklist. */
export const BRANCH_DISTRICTS = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chattogram",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
] as const;

/** Member religion picklist (register form). */
export const RELIGIONS = [
  "Islam",
  "Hinduism",
  "Buddhism",
  "Christianity",
  "Other",
] as const;

/** Pre–RAB-catalog wing seed (stripped on load; not in live catalog). */
export const LEGACY_WINGS = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "HQ",
  "Support",
] as const;

/** Display `SHORT — Full name` when elaborate form known. */
export function wingDisplayLabel(
  short: string,
  labelOverrides?: Record<string, string>,
): string {
  const long = labelOverrides?.[short] ?? WING_LABELS[short];
  if (long && long.toLowerCase() !== short.toLowerCase()) {
    return `${short} — ${long}`;
  }
  return short;
}

/**
 * Parent forces that contribute members to RAB mess.
 * Force expand → that force’s own service ladder (FORCE_DEFAULT_RANKS).
 * Rank tab → RAB mess ranks only (RANKS).
 */
export const FORCES = [
  "Army",
  "Navy",
  "Air Force",
  "BGB",
  "Police",
  "Ansar",
  "Civilian",
] as const;

/** RAB mess ranks only (Settings → Rank). Order = seniority. Short codes. */
export const RANKS = [
  "DAD",
  "RT",
  "ASI",
  "AASI",
  "Naik",
  "Constable",
  "Cook",
  "ANCE",
  "Civill",
  "Attached",
] as const;

/** Id slug for authorized row from English label. */
export function authorizedIdForLabel(label: string): string {
  const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return key === "officer" ? "auth_officer" : `auth_${key}`;
}

/**
 * Authorized strength (Settings → Authorized).
 * Officer + one row per Settings rank.
 * `count` = sum of per-wing প্রাধিকৃত. Seeded from live Settings (client demo).
 */
function authRow(
  id: string,
  label: string,
  wings: Record<string, number>,
): AuthorizedStrength {
  const count = Object.values(wings).reduce((a, b) => a + b, 0);
  return { id, label, count, wings };
}

export const DEFAULT_AUTHORIZED: AuthorizedStrength[] = [
  authRow("auth_officer", "Officer", {
    Admin: 24,
    "Ops Wg": 16,
    "Int Wg": 49,
    "Comm & MIS Wg": 9,
    "Trg Wg": 7,
    "L & M Wg": 11,
    "Inv Wg": 25,
    "Air Wg": 11,
    "R & D Cell": 13,
    "Training School": 19,
  }),
  authRow("auth_dad", "DAD", {
    Admin: 18,
    "Ops Wg": 12,
    "Int Wg": 47,
    "Comm & MIS Wg": 8,
    "Trg Wg": 3,
    "L & M Wg": 2,
    "Inv Wg": 23,
    "Air Wg": 5,
    "R & D Cell": 4,
    "Training School": 13,
  }),
  authRow("auth_rt", "RT", { Admin: 1 }),
  authRow("auth_asi", "ASI", {
    Admin: 67,
    "Ops Wg": 31,
    "Int Wg": 64,
    "Comm & MIS Wg": 69,
    "Trg Wg": 3,
    "L & M Wg": 2,
    "Inv Wg": 19,
    "Air Wg": 15,
    "R & D Cell": 5,
    "Training School": 20,
  }),
  authRow("auth_aasi", "AASI", {
    Admin: 42,
    "Ops Wg": 49,
    "Int Wg": 31,
    "Comm & MIS Wg": 60,
    "Trg Wg": 5,
    "L & M Wg": 8,
    "Inv Wg": 22,
    "Air Wg": 1,
    "R & D Cell": 4,
    "Training School": 32,
  }),
  authRow("auth_naik", "Naik", { Admin: 9 }),
  authRow("auth_constable", "Constable", {
    Admin: 100,
    "Ops Wg": 96,
    "Int Wg": 87,
    "Comm & MIS Wg": 49,
    "Trg Wg": 12,
    "L & M Wg": 17,
    "Inv Wg": 25,
    "Air Wg": 5,
    "R & D Cell": 1,
    "Training School": 99,
  }),
  authRow("auth_cook", "Cook", {
    Admin: 19,
    "Ops Wg": 4,
    "Air Wg": 1,
    "Training School": 8,
  }),
  authRow("auth_ance", "ANCE", {
    Admin: 17,
    "Ops Wg": 2,
    "Inv Wg": 7,
    "Air Wg": 1,
    "Training School": 5,
  }),
  authRow("auth_civill", "Civill", {
    Admin: 11,
    "Int Wg": 2,
    "Inv Wg": 18,
    "Air Wg": 1,
    "Training School": 4,
  }),
  authRow("auth_attached", "Attached", {}),
];

/** Full names for RAB short ranks. */
export const RANK_LABELS: Record<string, string> = {
  DAD: "Deputy Assistant Director",
  RT: "Recruit Training",
  ASI: "Assistant Sub-Inspector",
  AASI: "Additional Assistant Sub-Inspector",
  Naik: "Naik",
  Constable: "Constable",
  Cook: "Cook",
  ANCE: "Ansar Non-Combatant Employee",
  Civill: "Civilian",
  Attached: "Attached",
};

/** Own rank ladder per parent force (Force expand). Not RAB ranks. */
export const FORCE_DEFAULT_RANKS: Record<
  (typeof FORCES)[number],
  readonly string[]
> = {
  Army: [
    "SWO",
    "WO",
    "RT",
    "Sgt",
    "Cpl",
    "L/Cpl",
    "OR",
    "Cook",
    "NCE",
    "Messenger",
    "Mess Waiter",
    "Cook Assistant",
    "Mali",
    "Lab Asst",
    "Ward Boy",
    "Civil",
  ],
  Navy: [
    "SCPO",
    "CPO",
    "PO",
    "LS",
    "LMA",
    "AB",
    "MA-1",
    "OD",
    "LStwd",
    "Cook",
    "NCE",
    "Top",
  ],
  "Air Force": [
    "SWO",
    "WO",
    "Sgt",
    "Cpl",
    "LAC",
    "AC",
    "Cook",
    "NCE",
    "Mess Waiter",
    "Civil",
  ],
  BGB: [
    "Sub",
    "Nb Sub",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    "Rifleman",
    "Cook",
    "NCE",
    "Mali",
  ],
  Police: [
    "Inspector",
    "SI",
    "ASI",
    "Naik",
    "Constable",
  ],
  Ansar: [
    "CA",
    "PC",
    "APC",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    "ML SS",
  ],
  Civilian: ["S A EB"],
};

/** Full names for force short ranks (Army first; others optional). */
export const FORCE_RANK_LABELS: Partial<
  Record<(typeof FORCES)[number], Record<string, string>>
> = {
  Army: {
    SWO: "Senior Warrant Officer",
    WO: "Warrant Officer",
    RT: "Recruit Training",
    Sgt: "Sergeant",
    Cpl: "Corporal",
    "L/Cpl": "Lance Corporal",
    OR: "Soldier",
    Cook: "Cook",
    NCE: "Non-Combatant Employee",
    Messenger: "Messenger",
    "Mess Waiter": "Mess Waiter",
    "Cook Assistant": "Cook Assistant",
    Mali: "Mali (Gardener)",
    "Lab Asst": "Laboratory Assistant",
    "Ward Boy": "Ward Boy",
    Civil: "Civilian",
  },
  Navy: {
    SCPO: "Senior Chief Petty Officer",
    CPO: "Chief Petty Officer",
    PO: "Petty Officer",
    LS: "Leading Seaman",
    LMA: "Leading Mechanician Assistant",
    AB: "Able Seaman",
    "MA-1": "Mechanician Assistant-1",
    OD: "Ordinary Seaman",
    LStwd: "Leading Steward",
    Cook: "Steward Cook",
    NCE: "Non-Combatant Employee",
    Top: "Topas",
  },
  "Air Force": {
    SWO: "Senior Warrant Officer",
    WO: "Warrant Officer",
    Sgt: "Sergeant",
    Cpl: "Corporal",
    LAC: "Leading Aircraftman",
    AC: "Aircraftman",
    Cook: "Cook",
    NCE: "Non-Combatant Employee",
    "Mess Waiter": "Mess Waiter",
    Civil: "Civilian",
  },
  BGB: {
    Sub: "Subedar",
    "Nb Sub": "Naib Subedar",
    Havildar: "Havildar",
    Naik: "Naik",
    "Lance Naik": "Lance Naik",
    Sepoy: "Sepoy",
    Rifleman: "Rifleman",
    Cook: "Cook",
    NCE: "Non-Combatant Employee",
    Mali: "Mali",
  },
  Police: {
    Inspector: "Inspector",
    SI: "Sub-Inspector",
    ASI: "Assistant Sub-Inspector",
    Naik: "Naik",
    Constable: "Constable",
  },
  Ansar: {
    CA: "Circle Adjutant",
    PC: "Platoon Commander",
    APC: "Assistant Platoon Commander",
    Havildar: "Havildar",
    Naik: "Naik",
    "Lance Naik": "Lance Naik",
    Sepoy: "Sepoy",
    "ML SS": "ML SS",
  },
  Civilian: {
    "S A EB": "S A EB",
  },
};

/** Old Army officer ladder — migrate localStorage once. */
export const LEGACY_ARMY_RANKS = [
  "OR",
  "L/CPL",
  "CPL",
  "SGT",
  "WO",
  "MWO",
  "2/Lt",
  "Lt",
  "Capt",
  "Maj",
  "Lt Col",
  "Col",
  "Brig Gen",
  "Maj Gen",
  "Lt Gen",
  "Gen",
] as const;

/** Old Navy officer / rating ladder — migrate localStorage once. */
export const LEGACY_NAVY_RANKS = [
  "OS",
  "AB",
  "LS",
  "PO",
  "CPO",
  "MCPO",
  "SLt",
  "Lt",
  "Lt Cdr",
  "Cdr",
  "Capt",
  "Cdre",
  "R Adm",
  "V Adm",
  "Adm",
] as const;

/** Old Air Force officer / airman ladder — migrate localStorage once. */
export const LEGACY_AIR_FORCE_RANKS = [
  "AC",
  "LAC",
  "Cpl",
  "Sgt",
  "FS",
  "WO",
  "Plt Off",
  "Fg Off",
  "Flt Lt",
  "Sqn Ldr",
  "Wg Cdr",
  "Gp Capt",
  "Air Cdre",
  "AVM",
  "Air Mshl",
  "ACM",
] as const;

/** Old BGB ladder — migrate localStorage once. */
export const LEGACY_BGB_RANKS = [
  "Rifleman",
  "L/Nk",
  "Nk",
  "Hav",
  "Nb Sub",
  "Sub",
  "SM",
  "AD",
  "DD",
  "Dir",
  "ADG",
  "DG",
] as const;

/** Old Police officer ladder — migrate localStorage once. */
export const LEGACY_POLICE_RANKS = [
  "Const",
  "Naik",
  "ASI",
  "SI",
  "Insp",
  "ASP",
  "Addl SP",
  "SP",
  "Addl DIG",
  "DIG",
  "Addl IG",
  "IGP",
] as const;

/** Old Ansar ladder — migrate localStorage once. */
export const LEGACY_ANSAR_RANKS = [
  "Ansar",
  "L/Nk",
  "Nk",
  "Hav",
  "CO",
  "DC",
  "Addl Dir",
  "DG",
] as const;

/** Old Civilian ladder — migrate localStorage once. */
export const LEGACY_CIVILIAN_RANKS = ["Civill", "S", "A", "EB"] as const;

/** Old service / police ladders — migrate localStorage once. */
export const LEGACY_RANKS = [
  "Constable",
  "Naik",
  "Havildar",
  "ASI",
  "SI",
  "Inspector",
  "ASP",
  "Addl SP",
] as const;

/** Pre-parent-force defaults — migrate localStorage once. */
export const LEGACY_FORCES = [
  "RAB-1",
  "RAB-2",
  "RAB-3",
  "RAB-4",
  "RAB-HQ",
] as const;

/** Display `SHORT — Full name` when elaborate form known. */
export function rankDisplayLabel(
  short: string,
  force?: string,
  labelOverrides?: Record<string, string>,
): string {
  const long =
    labelOverrides?.[short] ??
    (force
      ? FORCE_RANK_LABELS[force as (typeof FORCES)[number]]?.[short]
      : undefined) ??
    RANK_LABELS[short];
  if (long && long.toLowerCase() !== short.toLowerCase()) {
    return `${short} — ${long}`;
  }
  return short;
}

/** Rank choices under a Force expand (defaults − removed + user extras). */
export function forceRankChoices(
  force: string,
  catalog: string[],
  extras: readonly string[] = [],
  removed: readonly string[] = [],
): string[] {
  const ladder =
    FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? catalog;
  const removedSet = new Set(
    removed.map((r) => r.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of [...ladder, ...extras]) {
    const label = String(r ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key) || removedSet.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function defaultForceRanks(
  forces: readonly string[] = FORCES,
): Record<string, string[]> {
  return Object.fromEntries(
    forces.map((f) => {
      const ladder =
        FORCE_DEFAULT_RANKS[f as (typeof FORCES)[number]] ?? RANKS;
      return [f, [...ladder]];
    }),
  );
}

/** Org header for Consume print bills (prototype defaults). */
export const CONSUME_REPORT_META = {
  orgName: "RAB Forces Headquarters",
  orgNameBn: "র‍্যাব ফোর্সেস সদর দপ্তর",
  station: "Kurmitola, Dhaka",
  stationBn: "কুর্মিটোলা, ঢাকা",
  campBn: "র‍্যাব ফোর্সেস সদর দপ্তর ক্যাম্প, কুর্মিটোলা ঢাকা",
  wing: "Administration & Finance Wing",
  wingBn: "প্রশাসন ও অর্থ উইং",
  formNo: "Bangladesh Form No-5211",
} as const;

/** Fallback fuel ৳/day for FR bills when Settings FUEL rate missing. */
export const FR_FUEL_RATE_PER_DAY =
  RATE_ONLY_TAGS.find((t) => t.code === FUEL_RATE_TAG)?.defaultAmount ?? 50;

/** Org / letter defaults for Ration Accounts print & transfer export. */
export const RATION_REPORT_META = {
  orgName: "RAB Forces Headquarters",
  orgNameBn: "র‍্যাব ফোর্সেস সদর দপ্তর",
  govLine: "Government of the People's Republic of Bangladesh",
  policeLine: "Bangladesh Police",
  station: "Kurmitola, Dhaka",
  stationBn: "কুর্মিটোলা, ঢাকা",
  institute: "RAB HQ",
  currency: "BDT",
  transferType: "C",
  entryDescription: "Fresh Money Bill",
  paymentInfo: "Fresh Money",
  refPrefix: "RAB HQ/Finance/S33/Pay",
  refPrefixPayAllce: "RAB HQ/Finance/S33/Pay & Allce",
  subjectFreshMoney: "Disbursement of Fresh Money Bill {month}",
  subjectTagBill:
    "Disbursement of Payment Fresh Money Bill-{monthLabel} Transfer BEFTN to {bank}.",
  subjectFreshMoneyTransfer:
    "Disbursement of Fresh Money Bill {monthLabel} transfer to {bank}.",
} as const;

export const MEMBER_TYPES: {
  value: MemberType;
  labelKey: MessageKey;
}[] = [
  { value: "new", labelKey: "cc.memberTypes.new" },
  { value: "attached", labelKey: "cc.memberTypes.attached" },
  { value: "permanent", labelKey: "cc.memberTypes.permanent" },
  { value: "guest", labelKey: "cc.memberTypes.guest" },
  { value: "civilian", labelKey: "cc.memberTypes.civilian" },
];

export const SESSION_COOKIE = "mess_session";
export const SESSION_STORAGE_KEY = "mess_session_v1";
export const ACCESS_TOKEN_KEY = "mess_access_token";
export const REMEMBER_EMAIL_KEY = "mess_login_email";
/** Demo seed staff. Matches backend `SEED_STAFF_PASSWORD` / `{role}@mess.rab`. */
export const SEED_STAFF_PASSWORD = "ChangeMe!";
export const SEED_STAFF_EMAIL = (role: Role) => `${role}@mess.rab`;
export const STORE_KEY = "mess_proto_v1";
