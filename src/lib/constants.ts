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

/** Result columns on Consume / Ration / Admin monthly ledger + print.
 *  FR column is FR+MFR; day cells still show MFR when painted. */
export const CONSUME_LEDGER_TAGS: DailyTag[] = [
  "MS",
  "FR",
  "CL",
  "PL",
  "CD",
  "TRG",
  "WIT",
  "MED",
  "BGH",
  "LNK",
  "WR",
];

/** Day marks included in the consume ledger. MFR days roll into the FR column. */
export const CONSUME_LEDGER_SOURCE_TAGS: DailyTag[] = [
  "MS",
  "FR",
  "MFR",
  "CL",
  "PL",
  "CD",
  "TRG",
  "WIT",
  "MED",
  "BGH",
  "LNK",
  "WR",
];

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
  { code: "ML", labelKey: "tags.ML", allowance: false, mess: false },
  { code: "TRG", labelKey: "tags.TRG", allowance: false, mess: false },
  { code: "MS", labelKey: "tags.MS", allowance: true, mess: true },
  { code: "MOL", labelKey: "tags.MOL", allowance: true, mess: false },
  { code: "CMH", labelKey: "tags.CMH", allowance: true, mess: false },
  { code: "RBH", labelKey: "tags.RBH", allowance: true, mess: false },
  { code: "BGH", labelKey: "tags.BGH", allowance: true, mess: false },
  { code: "AWL", labelKey: "tags.AWL", allowance: true, mess: false },
  { code: "OSL", labelKey: "tags.OSL", allowance: true, mess: false },
  { code: "RL", labelKey: "tags.RL", allowance: false, mess: false },
  { code: "JL", labelKey: "tags.JL", allowance: false, mess: false },
  { code: "PE", labelKey: "tags.PE", allowance: false, mess: false },
  { code: "LNK", labelKey: "tags.LNK", allowance: false, mess: false },
  { code: "MFR", labelKey: "tags.MFR", allowance: true, mess: false },
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
 * Main SRB wings (short form = stored value). Order = official serial 1–10.
 */
export const WINGS = [
  "Admin",
  "Ops Wg",
  "Int Wg",
  "Comm & MIS Wg",
  "Trg Wg",
  "L & M Wg",
  "Inv Wg",
  "Air Wg",
  "R & D Cell",
  "Training School",
] as const;

/** Former main-wing roots no longer on the official serial. */
export const DROPPED_MAIN_WINGS = [] as const;

/** Old Form 1 roots — dropped so the sheet matches the official list. */
export const LEGACY_FORM1_WINGS = [
  "Admin (New)",
  "Admin (Old)",
  "RFTS",
] as const;

/**
 * Admin & Finance Wing children (short = stored). Serial 1–15 from the
 * official Admin list.
 */
export const ADMIN_SUB_WINGS = [
  "DG Office",
  "ADG (Ops) Office",
  "ADG (Admin) Office",
  "Dir Office",
  "Sup Br",
  "Per Br",
  "Gen Br",
  "Med Br",
  "Rec Br",
  "Fin Br",
  "Proc Br",
  "Proj Br",
  "Dev Br",
  "Wksp Br",
  "HQ Br",
] as const;

/**
 * Headquarters Branch children (short = stored). Serial 1–6 under HQ Br.
 */
export const HQ_SUB_WINGS = [
  "HQ Office",
  "SY Br",
  "Forces Mess",
  "Fd Mess",
  "MT Br",
  "New Temp Att",
] as const;

/** Old HQ / Admin names — remapped or stripped so the paper list wins. */
export const LEGACY_HQ_SUB_WINGS = [
  "Headquarters Branch",
  "Headquarters Office",
  "Security Branch",
  "Record Branch",
  "Field Mess",
  "MT Branch",
  "Director (Admin) Office",
  "New / Temporary Attached",
] as const;

/** Old stored short → official stored short. */
export const WING_RENAMES: Record<string, string> = {
  "director (admin) office": "Dir Office",
  "new / temporary attached": "New Temp Att",
  "newly temporary attach": "New Temp Att",
  "new temporary attach": "New Temp Att",
  "new temporary attached": "New Temp Att",
  "headquarters office": "HQ Office",
  "headquarters branch": "HQ Br",
  "security branch": "SY Br",
  "security branch - iec cell": "SY Br",
  "iec cell": "SY Br",
  "record branch": "Rec Br",
  "field mess": "Fd Mess",
  "mt branch": "MT Br",
  "admin (new)": "Admin",
  "admin (old)": "Admin",
  rfts: "Training School",
  "budget br": "Fin Br",
  "rat br": "HQ Br",
};

export function canonicalWingName(label: string): string {
  const next = label.trim().replace(/\s+/g, " ");
  if (!next) return next;
  return WING_RENAMES[next.toLowerCase()] ?? next;
}

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
  RFTS: "SRB Forces Training School",
  "Training School": "SRB Forces Training School",
  "R & D Cell": "Research & Development Cell",
  Admin: "Admin & Finance Wing",
  "Admin (New)": "Admin (New)",
  "Admin (Old)": "Admin (Old)",
  "DG Office": "DG Office",
  "ADG (Ops) Office": "ADG (Ops) Office",
  "ADG (Admin) Office": "ADG (Admin) Office",
  "Dir Office": "Dir Office",
  "Director (Admin) Office": "Dir Office",
  "Sup Br": "Supply Branch",
  "Per Br": "Personnel Branch",
  "Gen Br": "General Branch",
  "Med Br": "Medical Branch",
  "Rec Br": "Record Branch",
  "Fin Br": "Finance Branch",
  "Proc Br": "Procurement Branch",
  "Proj Br": "Project Branch",
  "Dev Br": "Development Branch",
  "Wksp Br": "Central Workshop Branch",
  "HQ Br": "Headquarters Branch",
  "HQ Office": "Headquarters Office",
  "SY Br": "Security Branch",
  "Forces Mess": "Forces Mess",
  "Fd Mess": "Field Mess",
  "MT Br": "MT Branch",
  "New Temp Att": "Newly Temporary Attach",
  "New / Temporary Attached": "Newly Temporary Attach",
  "Budget Br": "Budget Branch",
  "Rat Br": "Ration Office",
};

/** Bangla print / Settings names for official shorts. */
export const WING_LABELS_BN: Record<string, string> = {
  Admin: "প্রশাসন ও অর্থ উইং",
  "Ops Wg": "অপস উইং",
  "Int Wg": "ইন্ট উইং",
  "Comm & MIS Wg": "যোগাযোগ উইং",
  "Trg Wg": "ট্রেনিং উইং",
  "L & M Wg": "লিঃ এন্ড মিডিঃ উইং",
  "Inv Wg": "তদন্ত উইং",
  "Air Wg": "এয়ার উইং",
  "R & D Cell": "রিসার্চ অ্যান্ড ডেভেলপমেন্ট সেল",
  "Training School": "এসআরবি ফোর্সেস ট্রেনিং স্কুল",
  "DG Office": "ডিজি দপ্তর",
  "ADG (Ops) Office": "এডিজি (অপস) দপ্তর",
  "ADG (Admin) Office": "এডিজি (এ্যাডমিন) দপ্তর",
  "Dir Office": "পরিচালক দপ্তর",
  "Sup Br": "সরবরাহ শাখা",
  "Per Br": "পার্সোনেল শাখা",
  "Gen Br": "জেনারেল শাখা",
  "Med Br": "চিকিৎসা শাখা",
  "Rec Br": "রেকর্ড শাখা",
  "Fin Br": "অর্থ শাখা",
  "Proc Br": "প্রকিউরমেন্ট শাখা",
  "Proj Br": "প্রকল্প শাখা",
  "Dev Br": "উন্নয়ন শাখা",
  "Wksp Br": "কেন্দ্রীয় ওয়ার্কশপ শাখা",
  "HQ Br": "সদর দপ্তর শাখা",
  "HQ Office": "সদর দপ্তর অফিস",
  "SY Br": "নিরাপত্তা শাখা",
  "Forces Mess": "ফোর্সেস মেস",
  "Fd Mess": "ফিল্ড মেস",
  "MT Br": "এমটি শাখা",
  "New Temp Att": "নতুন অস্থায়ী সংযুক্ত",
};

/** Official serials: mains 1–10, Admin children 1–15, HQ children 1–6. */
export const WING_CATALOG_SERIALS: Record<string, number> = {
  ...Object.fromEntries(WINGS.map((wing, i) => [wing, i + 1])),
  ...Object.fromEntries(ADMIN_SUB_WINGS.map((wing, i) => [wing, i + 1])),
  ...Object.fromEntries(HQ_SUB_WINGS.map((wing, i) => [wing, i + 1])),
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

/** Member blood group picklist (register form). */
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
] as const;

/** Member religion picklist (register form). */
export const RELIGIONS = [
  "Islam",
  "Hinduism",
  "Buddhism",
  "Christianity",
  "Other",
] as const;

/** Pre–SRB-catalog wing seed (stripped on load; not in live catalog). */
export const LEGACY_WINGS = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "HQ",
  "Support",
] as const;

/** Official main-wing serial (1-based). Stored serials win over catalog order. */
export function wingOfficialSerial(
  wing: string,
  serials?: Record<string, number>,
): number | null {
  const stored = serials?.[wing];
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.floor(stored);
  }
  const key = wing.trim().toLowerCase();
  const match = Object.entries(serials ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match && typeof match[1] === "number" && match[1] > 0) {
    return Math.floor(match[1]);
  }
  const catalog = WING_CATALOG_SERIALS[wing];
  if (typeof catalog === "number" && catalog > 0) return catalog;
  const catalogMatch = Object.entries(WING_CATALOG_SERIALS).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (catalogMatch) return catalogMatch[1];
  const index = WINGS.findIndex((item) => item.toLowerCase() === key);
  return index >= 0 ? index + 1 : null;
}

/** Official / catalog full name for a stored short wing. */
export function wingOfficialName(
  wing: string,
  labelOverrides?: Record<string, string>,
): string {
  const catalog = WING_LABELS[wing];
  const override = labelOverrides?.[wing]?.trim();
  if (
    override &&
    override.toLowerCase() !== wing.toLowerCase() &&
    override.toLowerCase() !== (catalog ?? "").toLowerCase() &&
    override.toLowerCase() !== "admin wing" &&
    override.toLowerCase() !== "training school"
  ) {
    return override;
  }
  return catalog || override || wing;
}

/** Display `SHORT — Full name` when elaborate form known. */
export function wingDisplayLabel(
  short: string,
  labelOverrides?: Record<string, string>,
): string {
  const long = wingOfficialName(short, labelOverrides);
  if (long && long.toLowerCase() !== short.toLowerCase()) {
    return `${short} — ${long}`;
  }
  return short;
}

/**
 * Parent forces that contribute members to SRB mess.
 * Force expand → that force’s own service ladder (FORCE_DEFAULT_RANKS).
 * Rank tab → SRB mess ranks only (RANKS).
 */
export const FORCES = [
  "Army",
  "Navy",
  "Air Force",
  "Police",
  "BGB",
  "Ansar",
  "Coast Guard",
  "Civilian",
] as const;

export const FORCE_LABELS: Record<string, string> = {
  Army: "Army",
  Navy: "Navy",
  "Air Force": "Air Force",
  Police: "Police",
  BGB: "Border Guard Bangladesh",
  Ansar: "Ansar",
  "Coast Guard": "Coast Guard",
  Civilian: "Civilian",
};

export const FORCE_LABELS_BN: Record<string, string> = {
  Army: "আর্মি",
  Navy: "নৌবাহিনী",
  "Air Force": "বিমানবাহিনী",
  Police: "পুলিশ",
  BGB: "বর্ডার গার্ড বাংলাদেশ",
  Ansar: "আনসার",
  "Coast Guard": "কোস্ট গার্ড",
  Civilian: "সিভিলিয়ান",
};

export const FORCE_CATALOG_SERIALS: Record<string, number> = Object.fromEntries(
  FORCES.map((force, i) => [force, i + 1]),
);

export function forceOfficialSerial(
  force: string,
  serials?: Record<string, number>,
): number | null {
  const stored = serials?.[force];
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.floor(stored);
  }
  const key = force.trim().toLowerCase();
  const match = Object.entries(serials ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match && typeof match[1] === "number" && match[1] > 0) {
    return Math.floor(match[1]);
  }
  return FORCE_CATALOG_SERIALS[force] ?? null;
}

export function forceOfficialName(
  force: string,
  labelOverrides?: Record<string, string>,
): string {
  const catalog = FORCE_LABELS[force];
  const override = labelOverrides?.[force]?.trim();
  if (
    override &&
    override.toLowerCase() !== force.toLowerCase() &&
    override.toLowerCase() !== (catalog ?? "").toLowerCase()
  ) {
    return override;
  }
  return catalog || override || force;
}

export function forceLabelBn(
  force: string,
  overrides?: Record<string, string>,
): string {
  const over = overrides?.[force]?.trim();
  if (over) return over;
  const key = force.trim().toLowerCase();
  const match = Object.entries(overrides ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match?.[1]?.trim()) return match[1].trim();
  return FORCE_LABELS_BN[force] ?? force;
}

/** SRB mess ranks only (Settings → Rank). Order = seniority. Short codes. */
export const RANKS = [
  "DAD",
  "RT",
  "SI",
  "ASI",
  "Naik",
  "Constable",
  "Cook",
  "NCE",
  "Civil",
] as const;

/** Full names for SRB short ranks. */
export const RANK_LABELS: Record<string, string> = {
  DAD: "Deputy Assistant Director",
  RT: "Recruit Training",
  SI: "Sub-Inspector",
  ASI: "Assistant Sub-Inspector",
  Naik: "Naik",
  Constable: "Constable",
  Cook: "Cook",
  NCE: "Non-Combatant Employee",
  Civil: "Civilian",
  Attached: "Attached",
};

export const RANK_LABELS_BN: Record<string, string> = {
  DAD: "ডিএডি",
  RT: "আরটি",
  SI: "এসআই",
  ASI: "এএসআই",
  AASI: "এএসআই",
  Naik: "নায়েক",
  Constable: "কনস্টেবল",
  Cook: "পাচক",
  NCE: "এনসি(ই)",
  Civil: "সিভিল",
  Attached: "সংযুক্ত",
};

export const RANK_CATALOG_SERIALS: Record<string, number> = Object.fromEntries(
  RANKS.map((rank, i) => [rank, i + 1]),
);

export function isPreviousSrbRankCatalog(ranks?: string[]): boolean {
  const set = new Set(
    (ranks ?? []).map((rank) => rank.trim().toLowerCase()).filter(Boolean),
  );
  return (
    set.has("aasi") ||
    set.has("ance") ||
    (set.has("asi") && !set.has("si"))
  );
}

export function canonicalRankName(
  label: string,
  catalog?: string[],
): string {
  const key = label.trim().replace(/\s+/g, " ");
  if (!key) return "";
  const lower = key.toLowerCase();
  if (lower === "civill" || lower === "civilian") return "Civil";
  if (lower === "ance") return "NCE";
  if (lower === "aasi") return "ASI";
  if (lower === "attached") return "SI";
  if (lower === "asi" && isPreviousSrbRankCatalog(catalog)) return "SI";
  const match = RANKS.find((rank) => rank.toLowerCase() === lower);
  return match ?? key;
}

export function rankOfficialSerial(
  rank: string,
  serials?: Record<string, number>,
): number | null {
  const stored = serials?.[rank];
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.floor(stored);
  }
  const key = rank.trim().toLowerCase();
  const match = Object.entries(serials ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match && typeof match[1] === "number" && match[1] > 0) {
    return Math.floor(match[1]);
  }
  const canon = canonicalRankName(rank);
  return RANK_CATALOG_SERIALS[canon] ?? RANK_CATALOG_SERIALS[rank] ?? null;
}

export function rankOfficialName(
  rank: string,
  labelOverrides?: Record<string, string>,
): string {
  const catalog = RANK_LABELS[canonicalRankName(rank)] ?? RANK_LABELS[rank];
  const override = labelOverrides?.[rank]?.trim();
  if (
    override &&
    override.toLowerCase() !== rank.toLowerCase() &&
    override.toLowerCase() !== (catalog ?? "").toLowerCase()
  ) {
    return override;
  }
  return catalog || override || rank;
}

export function rankLabelBn(
  rank: string,
  overrides?: Record<string, string>,
): string {
  const over = overrides?.[rank]?.trim();
  if (over) return over;
  const key = rank.trim().toLowerCase();
  const match = Object.entries(overrides ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match?.[1]?.trim()) return match[1].trim();
  const canon = canonicalRankName(rank);
  return RANK_LABELS_BN[canon] ?? RANK_LABELS_BN[rank] ?? rank;
}

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
  authRow("auth_asi", "SI", {
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
  authRow("auth_aasi", "ASI", {
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
  authRow("auth_ance", "NCE", {
    Admin: 17,
    "Ops Wg": 2,
    "Inv Wg": 7,
    "Air Wg": 1,
    "Training School": 5,
  }),
  authRow("auth_civil", "Civil", {
    Admin: 11,
    "Int Wg": 2,
    "Inv Wg": 18,
    "Air Wg": 1,
    "Training School": 4,
  }),
  authRow("auth_attached", "Attached", {}),
];

const FORCE_CIVIL_TAIL = [
  "CK",
  "Msg",
  "MW",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
] as const;

const BGB_CIVIL_TAIL = [
  "CK",
  "MLSS",
  "MW",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
] as const;

const NAVY_CIVIL_TAIL = [
  "OD",
  "LCK/CK",
  "NCE/Top",
  "Msg",
  "L/Std",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
] as const;

/** Own rank ladder per parent force (Force expand). Not SRB ranks. */
export const FORCE_DEFAULT_RANKS: Record<
  (typeof FORCES)[number],
  readonly string[]
> = {
  Army: [
    "MWO",
    "SWO",
    "WO",
    "RT",
    "Sgt",
    "Cpl",
    "L/Cpl",
    "Sainik",
    ...FORCE_CIVIL_TAIL,
  ],
  Navy: [
    "MCPO",
    "SCPO",
    "CPO",
    "RT",
    "PO",
    "LS",
    "AB",
    "Seaman",
    ...NAVY_CIVIL_TAIL,
  ],
  "Air Force": [
    "MWO",
    "SWO",
    "WO",
    "RT",
    "Sgt",
    "Cpl",
    "LAC",
    "AC",
    ...FORCE_CIVIL_TAIL,
  ],
  Police: [
    "ASP",
    "Inspector",
    "RT",
    "SI",
    "ASI",
    "Naik",
    "Constable",
    ...FORCE_CIVIL_TAIL,
  ],
  BGB: [
    "SM",
    "Sub",
    "Nb Sub",
    "RT",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    ...BGB_CIVIL_TAIL,
  ],
  Ansar: [
    "CD",
    "RT",
    "PC",
    "APC",
    "Subedar",
    "Nb Subedar",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    ...FORCE_CIVIL_TAIL,
  ],
  "Coast Guard": [
    "MCPO",
    "SCPO",
    "CPO",
    "RT",
    "PO",
    "LS",
    "AB",
    "Seaman",
    ...NAVY_CIVIL_TAIL,
  ],
  Civilian: ["S A EB"],
};

/** Map leftover force names onto the official 1–8 list. */
export function canonicalForceName(
  force: string,
  rank = "",
  memberType = "",
): string {
  if (memberType === "civilian") return "Civilian";
  const key = force.trim().replace(/\s+/g, " ");
  if (
    !key ||
    /^rab[- ]?(1|2|3|4|hq)$/i.test(key)
  ) {
    return rank === "Civil" ? "Civilian" : "Army";
  }
  const match = FORCES.find((f) => f.toLowerCase() === key.toLowerCase());
  return match ?? key;
}

const SRB_TO_FORCE_RANK: Record<string, Partial<Record<(typeof FORCES)[number], string>>> = {
  DAD: {
    Army: "MWO",
    Navy: "MCPO",
    "Air Force": "MWO",
    Police: "ASP",
    BGB: "SM",
    Ansar: "CD",
    "Coast Guard": "MCPO",
    Civilian: "S A EB",
  },
  RT: {
    Army: "RT",
    Navy: "RT",
    "Air Force": "RT",
    Police: "RT",
    BGB: "RT",
    Ansar: "RT",
    "Coast Guard": "RT",
    Civilian: "S A EB",
  },
  SI: {
    Army: "Sgt",
    Navy: "PO",
    "Air Force": "Sgt",
    Police: "SI",
    BGB: "Havildar",
    Ansar: "PC",
    "Coast Guard": "PO",
    Civilian: "S A EB",
  },
  ASI: {
    Army: "Cpl",
    Navy: "LS",
    "Air Force": "Cpl",
    Police: "ASI",
    BGB: "Naik",
    Ansar: "APC",
    "Coast Guard": "LS",
    Civilian: "S A EB",
  },
  Naik: {
    Army: "L/Cpl",
    Navy: "AB",
    "Air Force": "LAC",
    Police: "Naik",
    BGB: "Naik",
    Ansar: "Naik",
    "Coast Guard": "AB",
    Civilian: "S A EB",
  },
  Constable: {
    Army: "Sainik",
    Navy: "Seaman",
    "Air Force": "AC",
    Police: "Constable",
    BGB: "Sepoy",
    Ansar: "Sepoy",
    "Coast Guard": "Seaman",
    Civilian: "S A EB",
  },
  Cook: {
    Army: "CK",
    Navy: "LCK/CK",
    "Air Force": "CK",
    Police: "CK",
    BGB: "CK",
    Ansar: "CK",
    "Coast Guard": "LCK/CK",
    Civilian: "S A EB",
  },
  NCE: {
    Army: "Civ",
    Navy: "NCE/Top",
    "Air Force": "Civ",
    Police: "Civ",
    BGB: "Civ",
    Ansar: "Civ",
    "Coast Guard": "NCE/Top",
    Civilian: "S A EB",
  },
  Civil: {
    Army: "Civ",
    Navy: "Civ",
    "Air Force": "Civ",
    Police: "Civ",
    BGB: "Civ",
    Ansar: "Civ",
    "Coast Guard": "Civ",
    Civilian: "S A EB",
  },
};

export function defaultForceRankForSrb(force: string, srbRank: string): string {
  if (force === "Civilian") return "S A EB";
  return (
    SRB_TO_FORCE_RANK[srbRank]?.[force as (typeof FORCES)[number]] ?? ""
  );
}

export const PINNED_FORCE_LADDERS = [
  "Army",
  "Navy",
  "Air Force",
  "Police",
  "BGB",
  "Ansar",
  "Coast Guard",
] as const;

const FORCE_CIVIL_LABELS: Record<string, string> = {
  CK: "Cook",
  Msg: "Messenger",
  MW: "Mess Waiter",
  Msl: "Mosalchi",
  Mali: "Mali",
  LA: "Lab Assistant",
  WB: "Ward Boy",
  Civ: "Civil",
  MLSS: "MLSS / Messenger",
  OD: "Ordinary Seaman",
  "LCK/CK": "LCK/CK Cook",
  "NCE/Top": "NCE / Top",
  "L/Std": "Leading Steward",
};

const FORCE_CIVIL_LABELS_BN: Record<string, string> = {
  CK: "পাচক",
  Msg: "বার্তাবাহক",
  MW: "মেস ওয়েটার",
  Msl: "মসালচি",
  Mali: "মালি",
  LA: "ল্যাব অ্যাসিস্ট্যান্ট",
  WB: "ওয়ার্ড বয়",
  Civ: "সিভিল",
  MLSS: "এমএলএসএস / বার্তাবাহক",
  OD: "ওডি",
  "LCK/CK": "এলসিকে/সিকে কুক",
  "NCE/Top": "এনসিই / টপ",
  "L/Std": "এল স্টুয়ার্ড",
};

/** Old long force-rank labels → short codes (same style as MWO / SI / L/Cpl). */
export const FORCE_RANK_SHORT_RENAMES: Record<string, string> = {
  cook: "CK",
  messenger: "Msg",
  "mess waiter": "MW",
  mosalchi: "Msl",
  "lab assistant": "LA",
  "lab asssistant": "LA",
  "ward boy": "WB",
  civil: "Civ",
  "mlss/messenger": "MLSS",
  "mlss / messenger": "MLSS",
  "lck/ck cook": "LCK/CK",
  "lck/ck": "LCK/CK",
  "nce/top": "NCE/Top",
  "l steward": "L/Std",
  "leading steward": "L/Std",
};

export function canonicalForceServiceRank(label: string): string {
  const key = label.trim().replace(/\s+/g, " ");
  if (!key) return "";
  const mapped = FORCE_RANK_SHORT_RENAMES[key.toLowerCase()];
  return mapped ?? key;
}

/** Suggest a short code when the add form is given a known full name. */
export function suggestForceRankShort(fullOrShort: string): string {
  const key = fullOrShort.trim().replace(/\s+/g, " ");
  if (!key) return "";
  const canon = canonicalForceServiceRank(key);
  if (canon && canon.toLowerCase() !== key.toLowerCase()) return canon;
  const lower = key.toLowerCase();
  for (const labels of Object.values(FORCE_RANK_LABELS)) {
    for (const [short, long] of Object.entries(labels ?? {})) {
      if (long.toLowerCase() === lower) return short;
    }
  }
  return "";
}

/** Full names for force short ranks (Army first; others optional). */
export const FORCE_RANK_LABELS: Partial<
  Record<(typeof FORCES)[number], Record<string, string>>
> = {
  Army: {
    MWO: "Master Warrant Officer",
    SWO: "Senior Warrant Officer",
    WO: "Warrant Officer",
    RT: "Recruit Training",
    Sgt: "Sergeant",
    Cpl: "Corporal",
    "L/Cpl": "Lance Corporal",
    Sainik: "Sainik",
    OR: "Sainik",
    ...FORCE_CIVIL_LABELS,
  },
  Navy: {
    MCPO: "Master Chief Petty Officer",
    SCPO: "Senior Chief Petty Officer",
    CPO: "Chief Petty Officer",
    RT: "Recruit Training",
    PO: "Petty Officer",
    LS: "Leading Seaman",
    AB: "Able Seaman",
    Seaman: "Seaman",
    ...FORCE_CIVIL_LABELS,
  },
  "Air Force": {
    MWO: "Master Warrant Officer",
    SWO: "Senior Warrant Officer",
    WO: "Warrant Officer",
    RT: "Recruit Training",
    Sgt: "Sergeant",
    Cpl: "Corporal",
    LAC: "Leading Aircraftman",
    AC: "Aircraftman",
    ...FORCE_CIVIL_LABELS,
  },
  Police: {
    ASP: "Assistant Superintendent of Police",
    Inspector: "Inspector",
    RT: "Recruit Training",
    SI: "Sub-Inspector",
    ASI: "Assistant Sub-Inspector",
    Naik: "Naik",
    Constable: "Constable",
    ...FORCE_CIVIL_LABELS,
  },
  BGB: {
    SM: "Subedar Major",
    Sub: "Subedar",
    "Nb Sub": "Naib Subedar",
    RT: "Recruit Training",
    Havildar: "Havildar",
    Naik: "Naik",
    "Lance Naik": "Lance Naik",
    Sepoy: "Sepoy",
    ...FORCE_CIVIL_LABELS,
  },
  Ansar: {
    CD: "Circle Adjutant",
    RT: "Recruit Training",
    PC: "Platoon Commander",
    APC: "Assistant Platoon Commander",
    Subedar: "Subedar",
    "Nb Subedar": "Naib Subedar",
    Havildar: "Havildar",
    Naik: "Naik",
    "Lance Naik": "Lance Naik",
    Sepoy: "Sepoy",
    ...FORCE_CIVIL_LABELS,
  },
  "Coast Guard": {
    MCPO: "Master Chief Petty Officer",
    SCPO: "Senior Chief Petty Officer",
    CPO: "Chief Petty Officer",
    RT: "Recruit Training",
    PO: "Petty Officer",
    LS: "Leading Seaman",
    AB: "Able Seaman",
    Seaman: "Seaman",
    ...FORCE_CIVIL_LABELS,
  },
  Civilian: {
    "S A EB": "S A EB",
  },
};

export const FORCE_RANK_LABELS_BN: Partial<
  Record<(typeof FORCES)[number], Record<string, string>>
> = {
  Army: {
    MWO: "মাস্টার ওয়ারেন্ট অফিসার",
    SWO: "সিনিয়র ওয়ারেন্ট অফিসার",
    WO: "ওয়ারেন্ট অফিসার",
    RT: "আরটি",
    Sgt: "সার্জেন্ট",
    Cpl: "কর্পোরাল",
    "L/Cpl": "ল্যান্স কর্পোরাল",
    Sainik: "সৈনিক",
    ...FORCE_CIVIL_LABELS_BN,
  },
  Navy: {
    MCPO: "মাস্টার চিফ পেটি অফিসার",
    SCPO: "সিনিয়র চিফ পেটি অফিসার",
    CPO: "চিফ পেটি অফিসার",
    RT: "আরটি",
    PO: "পেটি অফিসার",
    LS: "লিডিং সিম্যান",
    AB: "এবল সিম্যান",
    Seaman: "সিম্যান",
    ...FORCE_CIVIL_LABELS_BN,
  },
  "Air Force": {
    MWO: "মাস্টার ওয়ারেন্ট অফিসার",
    SWO: "সিনিয়র ওয়ারেন্ট অফিসার",
    WO: "ওয়ারেন্ট অফিসার",
    RT: "আরটি",
    Sgt: "সার্জেন্ট",
    Cpl: "কর্পোরাল",
    LAC: "লিডিং এয়ারক্র্যাফটম্যান",
    AC: "এয়ারক্র্যাফটম্যান",
    ...FORCE_CIVIL_LABELS_BN,
  },
  Police: {
    ASP: "সহকারী পুলিশ সুপার",
    Inspector: "ইন্সপেক্টর",
    RT: "আরটি",
    SI: "সাব-ইন্সপেক্টর",
    ASI: "সহকারী সাব-ইন্সপেক্টর",
    Naik: "নায়েক",
    Constable: "কনস্টেবল",
    ...FORCE_CIVIL_LABELS_BN,
  },
  BGB: {
    SM: "সুবেদার মেজর",
    Sub: "সুবেদার",
    "Nb Sub": "নায়েব সুবেদার",
    RT: "আরটি",
    Havildar: "হাবিলদার",
    Naik: "নায়েক",
    "Lance Naik": "ল্যান্স নায়েক",
    Sepoy: "সিপাহি",
    ...FORCE_CIVIL_LABELS_BN,
  },
  Ansar: {
    CD: "সার্কেল অ্যাডজুটেন্ট",
    RT: "আরটি",
    PC: "প্লাটুন কমান্ডার",
    APC: "সহকারী প্লাটুন কমান্ডার",
    Subedar: "সুবেদার",
    "Nb Subedar": "নায়েব সুবেদার",
    Havildar: "হাবিলদার",
    Naik: "নায়েক",
    "Lance Naik": "ল্যান্স নায়েক",
    Sepoy: "সিপাহি",
    ...FORCE_CIVIL_LABELS_BN,
  },
  "Coast Guard": {
    MCPO: "মাস্টার চিফ পেটি অফিসার",
    SCPO: "সিনিয়র চিফ পেটি অফিসার",
    CPO: "চিফ পেটি অফিসার",
    RT: "আরটি",
    PO: "পেটি অফিসার",
    LS: "লিডিং সিম্যান",
    AB: "এবল সিম্যান",
    Seaman: "সিম্যান",
    ...FORCE_CIVIL_LABELS_BN,
  },
  Civilian: {
    "S A EB": "এস এ ইবি",
  },
};

export const FORCE_RANK_SERIALS: Record<string, Record<string, number>> =
  Object.fromEntries(
    Object.entries(FORCE_DEFAULT_RANKS).map(([force, ranks]) => [
      force,
      Object.fromEntries(ranks.map((rank, i) => [rank, i + 1])),
    ]),
  );

export function forceRankOfficialSerial(
  force: string,
  rank: string,
  serials?: Record<string, Record<string, number>>,
): number | null {
  const canon = canonicalForceServiceRank(rank);
  const stored = serials?.[force]?.[canon] ?? serials?.[force]?.[rank];
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.floor(stored);
  }
  const byForce = serials?.[force] ?? {};
  const key = canon.trim().toLowerCase();
  const match = Object.entries(byForce).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match && typeof match[1] === "number" && match[1] > 0) {
    return Math.floor(match[1]);
  }
  return FORCE_RANK_SERIALS[force]?.[canon] ?? FORCE_RANK_SERIALS[force]?.[rank] ?? null;
}

export function forceRankLabelBn(
  force: string,
  rank: string,
  overrides?: Record<string, Record<string, string>>,
): string {
  const canon = canonicalForceServiceRank(rank);
  const over =
    overrides?.[force]?.[canon]?.trim() || overrides?.[force]?.[rank]?.trim();
  if (over) return over;
  const byForce = overrides?.[force] ?? {};
  const key = canon.trim().toLowerCase();
  const match = Object.entries(byForce).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match?.[1]?.trim()) return match[1].trim();
  return (
    FORCE_RANK_LABELS_BN[force as (typeof FORCES)[number]]?.[canon] ??
    FORCE_RANK_LABELS_BN[force as (typeof FORCES)[number]]?.[rank] ??
    rank
  );
}

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
  const canon = force ? canonicalForceServiceRank(short) : short;
  const long =
    labelOverrides?.[canon] ??
    labelOverrides?.[short] ??
    (force
      ? FORCE_RANK_LABELS[force as (typeof FORCES)[number]]?.[canon] ??
        FORCE_RANK_LABELS[force as (typeof FORCES)[number]]?.[short]
      : undefined) ??
    RANK_LABELS[short];
  const shown = force ? canon : short;
  if (long && long.toLowerCase() !== shown.toLowerCase()) {
    return `${shown} — ${long}`;
  }
  return shown;
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
  orgName: "Special Response Battalion (SRB) Headquarters",
  orgNameBn: "স্পেশাল রেসপন্স ব্যাটালিয়ন (এসআরবি) সদর দপ্তর",
  station: "Kurmitola, Dhaka",
  stationBn: "কুর্মিটোলা, ঢাকা",
  campBn: "স্পেশাল রেসপন্স ব্যাটালিয়ন (এসআরবি) সদর দপ্তর ক্যাম্প, কুর্মিটোলা ঢাকা",
  wing: "Administration & Finance Wing",
  wingBn: "প্রশাসন ও অর্থ উইং",
  formNo: "Bangladesh Form No-5211",
} as const;

/** Fallback fuel ৳/day for FR bills when Settings FUEL rate missing. */
export const FR_FUEL_RATE_PER_DAY =
  RATE_ONLY_TAGS.find((t) => t.code === FUEL_RATE_TAG)?.defaultAmount ?? 50;

/** Org / letter defaults for Ration Accounts print & transfer export. */
export const RATION_REPORT_META = {
  orgName: "Special Response Battalion (SRB) Headquarters",
  orgNameBn: "স্পেশাল রেসপন্স ব্যাটালিয়ন (এসআরবি) সদর দপ্তর",
  govLine: "Government of the People's Republic of Bangladesh",
  policeLine: "Bangladesh Police",
  station: "Kurmitola, Dhaka",
  stationBn: "কুর্মিটোলা, ঢাকা",
  institute: "SRB HQ",
  currency: "BDT",
  transferType: "C",
  entryDescription: "Fresh Money Bill",
  paymentInfo: "Fresh Money",
  refPrefix: "SRB HQ/Finance/S33/Pay",
  refPrefixPayAllce: "SRB HQ/Finance/S33/Pay & Allce",
  /** Official generate-report Ref. No stem — row 1 is 150120250000500001. */
  transferRefPrefix: "1501202500005",
  subjectFreshMoney: "Disbursement of Fresh Money Bill {month}",
  subjectTagBill:
    "Disbursement of Payment Fresh Money Bill-{monthLabel} Transfer BEFTN to {bank}.",
  subjectFreshMoneyTransfer:
    "Disbursement of Fresh Money Bill {monthLabel} transfer to {bank}.",
  subjectTrustBeftn:
    "Disbursement of Fresh Money Bill {monthLabel} BEFTN to Trust Bank.",
  subjectCommunityBeftn:
    "Disbursement of Fresh Money Bill {monthLabel} BEFTN to Community Bank.",
  subjectSonaliTransfer:
    "Disbursement of Fresh Money Bill {monthLabel} transfer to Sonali Bank.",
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
export const REFRESH_TOKEN_KEY = "mess_refresh_token";
/** Hard session: 2 hours from login, then the user must sign in again. */
export const SESSION_TTL_SECONDS = 2 * 60 * 60;
export const PROFILE_AVATAR_KEY = "mess_profile_avatar_v1";
export const REMEMBER_EMAIL_KEY = "mess_login_email";
/** Demo seed staff. Matches backend `SEED_STAFF_PASSWORD` / `SRB-{ROLE}`. */
export const SEED_STAFF_PASSWORD = "ChangeMe!";
export const SEED_STAFF_RAB_ID = (role: Role) => `SRB-${role.toUpperCase()}`;
export const SEED_STAFF_EMAIL = SEED_STAFF_RAB_ID;
export const STORE_KEY = "mess_proto_v1";
