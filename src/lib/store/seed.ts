import {
  BRANCH_DISTRICTS,
  DEFAULT_AUTHORIZED,
  DAILY_TAGS,
  defaultForceRanks,
  FORCES,
  FORCE_CATALOG_SERIALS,
  FORCE_LABELS,
  FORCE_LABELS_BN,
  RATE_ONLY_TAGS,
  RANKS,
  RANK_CATALOG_SERIALS,
  RANK_LABELS,
  RANK_LABELS_BN,
  RELIGIONS,
  BLOOD_GROUPS,
  WINGS,
  ADMIN_SUB_WINGS,
  HQ_SUB_WINGS,
  DEFAULT_WING_PARENT,
  WING_CATALOG_SERIALS,
  MEMBER_BANKS,
} from "@/lib/constants";
import {
  dateInMonth,
  daysInMonth,
  eachISODate,
  monthDateBounds,
  monthDatesThroughToday,
  monthKey,
  nowISO,
  shiftMonthKey,
  todayISO,
} from "@/lib/date";
import { officialSenderAccounts } from "@/lib/official-senders";
import { demoPritibhojEvents } from "@/lib/pritibhoj-demo";
import { demoTagRequests } from "@/lib/tag-request-demo";
import type {
  AllowanceRate,
  AppState,
  DailyAssignment,
  DailyTag,
  DocumentMeta,
  MealAssign,
  MealPlan,
  MealShift,
  MealShiftId,
  GuestMeal,
  MemberType,
  SenderAccount,
  User,
} from "@/lib/types";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Previous N full months + current month through today (demo Consume/Ration). */
function seedDemoDates(previousMonths = 3): string[] {
  const out: string[] = [];
  const current = monthKey();
  for (let i = previousMonths; i >= 1; i--) {
    const month = shiftMonthKey(current, -i);
    const last = daysInMonth(month);
    for (let day = 1; day <= last; day++) {
      out.push(dateInMonth(month, day));
    }
  }
  out.push(...monthDatesThroughToday());
  return out;
}

function user(
  partial: Omit<
    User,
    | "created_at"
    | "updated_at"
    | "documents"
    | "documents_verified"
    | "joining_date"
    | "duty_start"
    | "out_date"
    | "member_type"
    | "personal_id"
    | "force_rank"
    | "emergency_contacts"
    | "default_tag"
    | "inactive_spans"
    | "blood_group"
    | "jl_end_date"
  > & {
    documents?: User["documents"];
    documents_verified?: boolean;
    joining_date?: string;
    duty_start?: string;
    out_date?: string;
    member_type?: User["member_type"];
    personal_id?: string;
    force_rank?: string;
    emergency_contacts?: User["emergency_contacts"];
    default_tag?: DailyTag;
    inactive_spans?: User["inactive_spans"];
    blood_group?: string;
    jl_end_date?: string;
  },
): User {
  const ts = nowISO();
  return {
    ...partial,
    documents: partial.documents ?? [],
    documents_verified: partial.documents_verified ?? false,
    joining_date: partial.joining_date ?? todayISO(),
    duty_start:
      partial.duty_start ??
      (partial.approval_status === "approved"
        ? (partial.joining_date ?? todayISO())
        : ""),
    out_date: partial.out_date ?? "",
    member_type: partial.member_type ?? "permanent",
    personal_id: partial.personal_id ?? "",
    force_rank: partial.force_rank ?? "",
    emergency_contacts: partial.emergency_contacts ?? [],
    default_tag: partial.default_tag ?? "MS",
    blood_group: partial.blood_group ?? "",
    jl_end_date: partial.jl_end_date ?? "",
    inactive_spans:
      partial.inactive_spans ??
      (partial.status === "0"
        ? [{ from: partial.joining_date ?? "2020-01-01", to: null }]
        : []),
    created_at: ts,
    updated_at: ts,
  };
}

const BANK_BRANCHES = ["Mirpur", "Uttara", "Motijheel"] as const;

/** Cycle every daily tag so the cockpit counts light up. */
const BASE_TAGS: DailyTag[] = DAILY_TAGS.map((tag) => tag.code);

const OVERLAY_TAGS: DailyTag[] = [
  "CL",
  "TRG",
  "WIT",
  "MED",
  "PL",
  "CD",
  "MS",
  "WR",
  "MOL",
  "CMH",
  "RBH",
  "BGH",
  "AWL",
  "OSL",
  "RL",
  "PE",
  "LNK",
  "ML",
];

type MemberPlan = {
  user_id: string;
  base: DailyTag;
  spans?: { tag: DailyTag; from: number; to: number }[];
};

/** Full tag history only for first N roster members (mess/consume demos). */
const SEED_FULL_HISTORY_ROSTER = 25;

function seedDocuments(n: number, kind: "posting" | "nid" | "guest"): DocumentMeta[] {
  if (kind === "guest") {
    return [{ name: "guest-note.pdf", size: 42_000 + n * 800 }];
  }
  return [
    {
      name: kind === "nid" ? "nid-copy.pdf" : n % 2 === 0 ? "posting-order.pdf" : "joining-order.pdf",
      size: 180_000 + n * 4_200,
    },
    {
      name: kind === "nid" ? "birth-certificate.pdf" : "id-photo.jpg",
      size: 96_000 + n * 1_100,
    },
  ];
}

type SeedRow = {
  id: string;
  name: string;
  member_type: MemberType;
  wing: string;
  rank: string;
  force: string;
  approval_status: User["approval_status"];
  status: User["status"];
  default_tag: DailyTag;
  contact: string;
  out_date?: string;
};

/** One complete member per catalog wing, plus extras so every member type is present. */
const SEED_MEMBERS: SeedRow[] = [
  { id: "u_seed_01", name: "Karim Hossain", member_type: "permanent", wing: "Ops Wg", rank: "Constable", force: "Army", approval_status: "approved", status: "1", default_tag: "MS", contact: "Father" },
  { id: "u_seed_02", name: "Nusrat Jahan", member_type: "new", wing: "Int Wg", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Spouse" },
  { id: "u_seed_03", name: "Rafiq Ahmed", member_type: "attached", wing: "L & M Wg", rank: "SI", force: "BGB", approval_status: "approved", status: "1", default_tag: "MS", contact: "Brother" },
  { id: "u_seed_04", name: "Farhana Akter", member_type: "civilian", wing: "Air Wg", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "MS", contact: "Mother" },
  { id: "u_seed_05", name: "Jamal Uddin", member_type: "guest", wing: "Comm & MIS Wg", rank: "DAD", force: "Army", approval_status: "approved", status: "1", default_tag: "MS", contact: "Host" },
  { id: "u_seed_06", name: "Tania Rahman", member_type: "permanent", wing: "Inv Wg", rank: "DAD", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Spouse" },
  { id: "u_seed_07", name: "Hasan Mahmud", member_type: "new", wing: "Trg Wg", rank: "Naik", force: "Ansar", approval_status: "pending", status: "1", default_tag: "TRG", contact: "Father" },
  { id: "u_seed_08", name: "Shila Begum", member_type: "attached", wing: "Training School", rank: "RT", force: "Navy", approval_status: "approved", status: "1", default_tag: "ML", contact: "Sister" },
  { id: "u_seed_09", name: "Mehedi Hasan", member_type: "civilian", wing: "Training School", rank: "Civil", force: "Civilian", approval_status: "pending", status: "1", default_tag: "MS", contact: "Uncle" },
  { id: "u_seed_10", name: "Rina Chowdhury", member_type: "permanent", wing: "R & D Cell", rank: "ASI", force: "Air Force", approval_status: "approved", status: "1", default_tag: "CD", contact: "Spouse" },
  { id: "u_seed_11", name: "Omar Faruk", member_type: "permanent", wing: "Admin", rank: "DAD", force: "Army", approval_status: "approved", status: "1", default_tag: "MS", contact: "Father" },
  { id: "u_seed_12", name: "Lamia Sultana", member_type: "permanent", wing: "Admin", rank: "Cook", force: "Army", approval_status: "approved", status: "1", default_tag: "ML", contact: "Mother" },
  { id: "u_seed_13", name: "Sajjad Mia", member_type: "permanent", wing: "Admin", rank: "SI", force: "Police", approval_status: "ended", status: "0", default_tag: "MS", contact: "Brother", out_date: `${shiftMonthKey(monthKey(), -1)}-15` },
  { id: "u_seed_14", name: "Ayesha Islam", member_type: "new", wing: "Fin Br", rank: "NCE", force: "Ansar", approval_status: "approved", status: "1", default_tag: "WR", contact: "Spouse" },
  { id: "u_seed_15", name: "Babul Karim", member_type: "civilian", wing: "Forces Mess", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "MS", contact: "Father" },
  { id: "u_seed_16", name: "Nazmul Alam", member_type: "attached", wing: "HQ Br", rank: "SI", force: "BGB", approval_status: "approved", status: "1", default_tag: "CL", contact: "Cousin" },
  { id: "u_seed_17", name: "Imran Kabir", member_type: "permanent", wing: "Per Br", rank: "Constable", force: "Army", approval_status: "approved", status: "1", default_tag: "FR", contact: "Father" },
  { id: "u_seed_18", name: "Sadia Noor", member_type: "new", wing: "Gen Br", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "CL", contact: "Spouse" },
  { id: "u_seed_19", name: "Kamal Sheikh", member_type: "attached", wing: "Sup Br", rank: "SI", force: "BGB", approval_status: "approved", status: "1", default_tag: "PL", contact: "Brother" },
  { id: "u_seed_20", name: "Rehana Parvin", member_type: "civilian", wing: "Med Br", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "WR", contact: "Mother" },
  { id: "u_seed_21", name: "Anwar Hossain", member_type: "permanent", wing: "Rec Br", rank: "Naik", force: "Army", approval_status: "approved", status: "1", default_tag: "CD", contact: "Father" },
  { id: "u_seed_22", name: "Mitu Akter", member_type: "new", wing: "Proc Br", rank: "ASI", force: "Air Force", approval_status: "approved", status: "1", default_tag: "WIT", contact: "Sister" },
  { id: "u_seed_23", name: "Sohel Rana", member_type: "attached", wing: "Fin Br", rank: "SI", force: "Navy", approval_status: "approved", status: "1", default_tag: "ML", contact: "Uncle" },
  { id: "u_seed_24", name: "Nasrin Sultana", member_type: "civilian", wing: "Dev Br", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "TRG", contact: "Spouse" },
  { id: "u_seed_25", name: "Jahangir Alam", member_type: "permanent", wing: "Wksp Br", rank: "DAD", force: "Police", approval_status: "approved", status: "1", default_tag: "MS", contact: "Father" },
  { id: "u_seed_26", name: "Popy Das", member_type: "new", wing: "MT Br", rank: "NCE", force: "Ansar", approval_status: "approved", status: "1", default_tag: "MOL", contact: "Mother" },
  { id: "u_seed_27", name: "Liton Miah", member_type: "attached", wing: "HQ Br", rank: "SI", force: "BGB", approval_status: "approved", status: "1", default_tag: "CMH", contact: "Brother" },
  { id: "u_seed_28", name: "Sharmin Nahar", member_type: "civilian", wing: "Proj Br", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "RBH", contact: "Sister" },
  { id: "u_seed_29", name: "Faisal Ahmed", member_type: "permanent", wing: "SY Br", rank: "RT", force: "Navy", approval_status: "approved", status: "1", default_tag: "BGH", contact: "Spouse" },
  { id: "u_seed_30", name: "Rubina Yasmin", member_type: "new", wing: "HQ Br", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "AWL", contact: "Father" },
  { id: "u_seed_31", name: "Shahidul Islam", member_type: "attached", wing: "HQ Office", rank: "SI", force: "Army", approval_status: "approved", status: "1", default_tag: "OSL", contact: "Cousin" },
  { id: "u_seed_32", name: "Jannatul Ferdous", member_type: "civilian", wing: "SY Br", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "RL", contact: "Mother" },
  { id: "u_seed_33", name: "Mamun Reza", member_type: "permanent", wing: "Rec Br", rank: "Cook", force: "Army", approval_status: "approved", status: "1", default_tag: "PE", contact: "Brother" },
  { id: "u_seed_34", name: "Sumaiya Khan", member_type: "new", wing: "Fd Mess", rank: "Constable", force: "Ansar", approval_status: "approved", status: "1", default_tag: "LNK", contact: "Spouse" },
  { id: "u_seed_35", name: "Arif Chowdhury", member_type: "attached", wing: "MT Br", rank: "SI", force: "BGB", approval_status: "approved", status: "1", default_tag: "MFR", contact: "Uncle" },
  { id: "u_seed_36", name: "Dilara Begum", member_type: "civilian", wing: "New Temp Att", rank: "Civil", force: "Civilian", approval_status: "approved", status: "1", default_tag: "JL", contact: "Sister" },
  { id: "u_seed_37", name: "Rashid Khan", member_type: "new", wing: "DG Office", rank: "Naik", force: "Army", approval_status: "pending", status: "1", default_tag: "TRG", contact: "Father" },
  { id: "u_seed_38", name: "Mini Roy", member_type: "civilian", wing: "ADG (Ops) Office", rank: "Civil", force: "Civilian", approval_status: "pending", status: "1", default_tag: "MS", contact: "Mother" },
  { id: "u_seed_39", name: "Tanvir Hasan", member_type: "guest", wing: "ADG (Admin) Office", rank: "DAD", force: "Army", approval_status: "approved", status: "1", default_tag: "MS", contact: "Host" },
  { id: "u_seed_40", name: "Khaled Mostafa", member_type: "permanent", wing: "Ops Wg", rank: "SI", force: "Police", approval_status: "ended", status: "0", default_tag: "MS", contact: "Brother", out_date: `${shiftMonthKey(monthKey(), -1)}-20` },
  { id: "u_seed_41", name: "Rashedul Islam", member_type: "permanent", wing: "Ops Wg", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "MS", contact: "Father" },
  { id: "u_seed_42", name: "Farzana Akter", member_type: "permanent", wing: "Int Wg", rank: "Constable", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Spouse" },
];

const COCKPIT_POLICE_IDS = new Set(["u_seed_41", "u_seed_42"]);

function userFromSeedRow(row: SeedRow, i: number): User {
  const n = i + 1;
    const isCivilian = row.member_type === "civilian";
    const isGuest = row.member_type === "guest";
    const bank = MEMBER_BANKS[i % MEMBER_BANKS.length]!;
    const cardNo = isCivilian ? `CARD-${String(n).padStart(4, "0")}` : "";
    const rab_id = isCivilian
      ? `CIV-${cardNo.replace(/^CARD-/, "")}`
      : isGuest
        ? `GST-${String(5000 + n)}`
        : `SRB-${String(3100 + n)}`;
    const personal_id = isCivilian
      ? `${1984 + (n % 12)}${String(1000000 + n * 137).slice(0, 8)}`
      : isGuest
        ? `GST-PN-${String(n).padStart(4, "0")}`
        : `PN-${String(11000 + n)}`;
    return user({
      id: row.id,
      name: row.name,
      personal_id,
      rab_id,
      rfid: isCivilian ? `CIV-RF-${String(n).padStart(4, "0")}` : `RFID-${3100 + n}`,
      rank: isCivilian ? "Civil" : row.rank,
      wing: row.wing,
      force: row.force,
      religion: RELIGIONS[i % RELIGIONS.length]!,
      member_type: row.member_type,
      dropdown_no: cardNo,
      phone: `01711${String(200000 + n).slice(-6)}`,
      blood_group: BLOOD_GROUPS[i % BLOOD_GROUPS.length]!,
      status: row.status,
      approval_status: row.approval_status,
      bank_name: bank,
      account_name: row.name,
      account_number: `${row.approval_status === "pending" ? "11" : "22"}02${String(3100 + n).padStart(6, "0")}`,
      routing: `20027${String(n).padStart(4, "0")}`,
      branch: BANK_BRANCHES[i % BANK_BRANCHES.length]!,
      branch_location: BRANCH_DISTRICTS[i % BRANCH_DISTRICTS.length]!,
      documents: seedDocuments(n, isCivilian ? "nid" : isGuest ? "guest" : "posting"),
      documents_verified: isCivilian && row.approval_status === "approved",
      joining_date: dateInMonth(shiftMonthKey(monthKey(), -((n % 4) + 1)), 2 + (n % 20)),
      out_date: row.out_date ?? "",
      default_tag: row.default_tag,
      emergency_contacts: [
        {
          name: `${row.name.split(" ").at(-1) ?? "Family"} ${row.contact}`,
          relation: row.contact,
          phone: `01811${String(300000 + n).slice(-6)}`,
        },
      ],
    });
}

function buildDemoUsers(): User[] {
  return SEED_MEMBERS.map((row, i) => userFromSeedRow(row, i));
}

/** Approved Police members for Daily cockpit. Merge if local roster predates them. */
export function extraCockpitPoliceMembers(): User[] {
  return SEED_MEMBERS.flatMap((row, i) =>
    COCKPIT_POLICE_IDS.has(row.id) ? [userFromSeedRow(row, i)] : [],
  );
}

const TRUST_FIREWOOD_ROWS: SeedRow[] = [
  { id: "u_fw_trust_01", name: "Kamrul Hasan", member_type: "permanent", wing: "Ops Wg", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Spouse" },
  { id: "u_fw_trust_02", name: "Shahida Begum", member_type: "permanent", wing: "Int Wg", rank: "SI", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Father" },
  { id: "u_fw_trust_03", name: "Rezaul Karim", member_type: "permanent", wing: "Per Br", rank: "Constable", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Spouse" },
  { id: "u_fw_trust_04", name: "Nargis Akter", member_type: "permanent", wing: "Inv Wg", rank: "Insp", force: "Police", approval_status: "approved", status: "1", default_tag: "FR", contact: "Brother" },
];

/** Trust Bank + FR days so Firewood FR generate-report has a letter to preview. */
export function extraTrustFirewoodMembers(): User[] {
  return TRUST_FIREWOOD_ROWS.map((row, i) => {
    const n = 9101 + i;
    return {
      ...userFromSeedRow(row, 900 + i),
      default_tag: "FR" as DailyTag,
      bank_name: "Trust bank",
      account_name: row.name,
      account_number: `2202${String(n).padStart(6, "0")}`,
      routing: `2002791${String(i).padStart(2, "0")}`,
      branch: "Mirpur",
      rab_id: `SRB-FW${String(i + 1).padStart(2, "0")}`,
      personal_id: `PN-FW${n}`,
      rfid: `RFID-FW${n}`,
    };
  });
}

/** FR tags for the current month (and Sept 2026) so the Trust Firewood letter is not empty. */
export function extraTrustFirewoodAssignments(): DailyAssignment[] {
  const stamp = nowISO();
  const months = new Set([monthKey(), "2026-09"]);
  const today = todayISO();
  const out: DailyAssignment[] = [];
  for (const month of months) {
    const last =
      month === monthKey()
        ? Number(today.slice(8, 10))
        : daysInMonth(month);
    for (const row of TRUST_FIREWOOD_ROWS) {
      for (let day = 1; day <= last; day++) {
        const date = dateInMonth(month, day);
        out.push({
          id: `a_fw_${row.id}_${date.replaceAll("-", "")}`,
          user_id: row.id,
          date,
          tag: "FR",
          updated_by: "daily",
          updated_at: stamp,
        });
      }
    }
  }
  return out;
}

function buildMemberPlans(users: User[]): MemberPlan[] {
  const roster = users.filter(
    (u) => u.approval_status === "approved" && u.status === "1",
  );

  return roster.map((u, i) => {
    const base = BASE_TAGS[i % BASE_TAGS.length]!;
    const spans: MemberPlan["spans"] = [];

    // ~70% get mid-month overlay so ledger / cockpit look mixed
    if (i % 10 !== 0) {
      const tag = OVERLAY_TAGS[i % OVERLAY_TAGS.length]!;
      if (tag !== base) {
        const from = 3 + (i % 12);
        const len = 2 + (i % 4);
        spans.push({ tag, from, to: from + len });
      }
    }

    // Extra end-of-month span for every 4th FR/MS member
    if (i % 4 === 0 && (base === "MS" || base === "FR")) {
      spans.push({
        tag: base === "MS" ? "CL" : "TRG",
        from: -4,
        to: -1,
      });
    }

    return { user_id: u.id, base, spans: spans.length ? spans : undefined };
  });
}

function seedMealShifts(): MealShift[] {
  const stamp = nowISO();
  return [
    {
      id: "breakfast",
      name: "Breakfast",
      start_time: "06:00",
      end_time: "09:00",
      description: "Breakfast",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "lunch",
      name: "Lunch",
      start_time: "12:00",
      end_time: "15:00",
      description: "Lunch",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: "dinner",
      name: "Dinner",
      start_time: "19:00",
      end_time: "22:00",
      description: "Dinner",
      created_at: stamp,
      updated_at: stamp,
    },
  ];
}

function seedMealPlans(): MealPlan[] {
  const stamp = nowISO();
  const { from, to } = monthDateBounds();
  return eachISODate(from, to).map((date) => {
    const day = Number(date.slice(8, 10));
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const weekend = weekday === 0 || weekday === 6;
    const breakfast = weekend ? 28 + (day % 5) : 44 + (day % 9);
    const lunch = weekend ? 72 + (day % 8) : 98 + (day % 14);
    const dinner = day % 6 === 0 ? 0 : weekend ? 40 + (day % 6) : 70 + (day % 8);
    const meals = [
      { shift_id: "breakfast" as const, count: breakfast },
      { shift_id: "lunch" as const, count: lunch },
      ...(dinner > 0
        ? [{ shift_id: "dinner" as const, count: dinner }]
        : []),
    ];
    return {
      id: `mp_${date.replaceAll("-", "")}`,
      date,
      meals,
      created_at: stamp,
      updated_at: stamp,
    };
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function seedMealAssigns(users: User[], plans: MealPlan[]): MealAssign[] {
  const roster = users.filter(
    (u) => u.approval_status === "approved" && u.status === "1",
  );
  if (roster.length === 0) return [];
  const stamp = nowISO();
  const start: Record<MealShiftId, [number, number]> = {
    breakfast: [7, 10],
    lunch: [12, 35],
    dinner: [19, 20],
  };
  const out: MealAssign[] = [];
  let n = 0;

  for (const plan of plans) {
    const day = Number(plan.date.slice(8, 10));
    const offset = day % roster.length;
    for (const meal of plan.meals) {
      const take = Math.min(meal.count, 10);
      const [h, m] = start[meal.shift_id];
      for (let i = 0; i < take; i++) {
        const u = roster[(offset + i) % roster.length]!;
        const totalMin = m + (i % 18);
        const hh = h + Math.floor(totalMin / 60);
        const mm = totalMin % 60;
        n += 1;
        out.push({
          id: `ma_${n}`,
          member_id: u.id,
          shift_id: meal.shift_id,
          status: 1,
          date: plan.date,
          check_in_time: `${plan.date}T${pad2(hh)}:${pad2(mm)}:00`,
          created_at: stamp,
          updated_at: stamp,
        });
      }
      const dupCount =
        take >= 8 ? Math.max(2, Math.floor(take * 0.08)) : take >= 3 ? 1 : 0;
      for (let d = 0; d < dupCount; d++) {
        const u = roster[(offset + d) % roster.length]!;
        n += 1;
        out.push({
          id: `ma_${n}`,
          member_id: u.id,
          shift_id: meal.shift_id,
          status: 2,
          date: plan.date,
          check_in_time: `${plan.date}T${pad2(h)}:${pad2((m + 42 + d) % 60)}:00`,
          created_at: stamp,
          updated_at: stamp,
        });
      }
    }
  }
  return out;
}

const GUEST_NAMES = [
  "Md. Abdul Karim",
  "Shamima Akter",
  "Rafiqul Islam",
  "Taslima Begum",
  "Engineer Hasan Chowdhury",
  "SI Kamal Hossain",
  "Advocate Nurul Amin",
  "Dr. Farzana Yasmin",
  "Contractor Rana Traders",
  "Audit Officer Rezaul Karim",
  "HQ Visitor Anwar Hossain",
  "Fatema Khatun",
];

const GUEST_INFOS = ["Visitor", "Vendor", "Family", "HQ", "Audit"];

function seedGuestMeals(users: User[]): GuestMeal[] {
  const stamp = nowISO();
  const { from, to } = monthDateBounds();
  const hosts = users.filter(
    (u) => u.approval_status === "approved" && u.status === "1",
  );
  const shiftIds: MealShiftId[] = ["breakfast", "lunch", "dinner"];
  const start: Record<MealShiftId, [number, number]> = {
    breakfast: [7, 20],
    lunch: [12, 40],
    dinner: [19, 30],
  };
  const out: GuestMeal[] = [];
  let n = 0;

  for (const date of eachISODate(from, to)) {
    const day = Number(date.slice(8, 10));
    if (day % 3 === 0) continue;
    const count = 1 + (day % 4);
    for (let i = 0; i < count; i++) {
      const shift_id = shiftIds[(day + i) % shiftIds.length]!;
      const [h, m] = start[shift_id];
      const host = hosts.length
        ? hosts[(day + i) % hosts.length]
        : null;
      n += 1;
      const mm = (m + i * 7) % 60;
      out.push({
        id: `gm_${n}`,
        shift_id,
        date,
        check_in_time: `${date}T${pad2(h)}:${pad2(mm)}:00`,
        guest_name: GUEST_NAMES[(n - 1) % GUEST_NAMES.length]!,
        guest_info: GUEST_INFOS[(n + day) % GUEST_INFOS.length]!,
        ref_info: host
          ? `Hosted by ${host.name}`
          : `REF-${date.replaceAll("-", "")}-${i + 1}`,
        created_at: stamp,
        updated_at: stamp,
      });
    }
  }
  return out;
}

/** Bump → auto wipe localStorage + reseed on next load. */
export const SEED_VERSION = 32;

/** Catalog/rates only — no demo members, assignments, requests, or Pritibhoj. */
export function createLiveCatalogState(): AppState {
  const seeded = createSeedState();
  return {
    ...seeded,
    users: [],
    assignments: [],
    tag_requests: [],
    pritibhoj_events: [],
    paper_report_requests: [],
    meal_plans: [],
    meal_assigns: [],
    guest_meals: [],
    state_reports: [],
  };
}

export function createSeedState(): AppState {
  const today = todayISO();
  const users = buildDemoUsers();
  const fullHistoryDates = seedDemoDates(3);
  const currentMonthDates = monthDatesThroughToday();
  const memberPlans = buildMemberPlans(users);
  const defaultByUser = new Map(
    memberPlans.map((plan) => [plan.user_id, plan.base] as const),
  );
  const mlMemberIds = new Set(["u_seed_08", "u_seed_12", "u_seed_23"]);
  for (const u of users) {
    u.default_tag = mlMemberIds.has(u.id)
      ? "ML"
      : (defaultByUser.get(u.id) ?? "MS");
  }

  function resolveDayBound(bound: number, lastDay: number) {
    if (bound < 0) return lastDay + bound + 1;
    return bound;
  }

  function tagForPlan(plan: MemberPlan, day: number, lastDay: number): DailyTag {
    for (const span of plan.spans ?? []) {
      const from = Math.max(1, resolveDayBound(span.from, lastDay));
      const to = Math.min(lastDay, resolveDayBound(span.to, lastDay));
      if (from <= to && day >= from && day <= to) return span.tag;
    }
    return plan.base;
  }

  const assignments: DailyAssignment[] = [];
  const rosterPlans = memberPlans;
  for (let pi = 0; pi < rosterPlans.length; pi++) {
    const plan = rosterPlans[pi]!;
    const dates =
      pi < SEED_FULL_HISTORY_ROSTER ? fullHistoryDates : currentMonthDates;
    for (const date of dates) {
      const day = Number(date.slice(8, 10));
      const month = date.slice(0, 7);
      const lastDay =
        month === monthKey()
          ? Number(today.slice(8, 10))
          : daysInMonth(month);

      assignments.push({
        id: id("a"),
        user_id: plan.user_id,
        date,
        tag: mlMemberIds.has(plan.user_id)
          ? "ML"
          : tagForPlan(plan, day, lastDay),
        updated_by: "daily",
        updated_at: nowISO(),
      });
    }
  }

  const extraUsers = extraTrustFirewoodMembers();
  const haveIds = new Set(users.map((u) => u.id));
  for (const extra of extraUsers) {
    if (!haveIds.has(extra.id)) users.push(extra);
  }
  assignments.push(...extraTrustFirewoodAssignments());

  const senders: SenderAccount[] = officialSenderAccounts();

  const rates: AllowanceRate[] = [
    ...DAILY_TAGS.map((tag) => ({
      tag: tag.code,
      amount_per_day: tag.allowance ? (tag.code === "MS" ? 180 : 220) : 0,
    })),
    ...RATE_ONLY_TAGS.map((tag) => ({
      tag: tag.code,
      amount_per_day: tag.defaultAmount,
    })),
  ];

  const meal_shifts = seedMealShifts();
  const meal_plans = seedMealPlans();

  return {
    users,
    assignments,
    senders,
    rates,
    ranks: [...RANKS, "Attached"],
    wings: [...new Set([...WINGS, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS])],
    wing_parent: { ...DEFAULT_WING_PARENT },
    wing_labels: {},
    wing_labels_bn: {},
    wing_serials: { ...WING_CATALOG_SERIALS },
    forces: [...FORCES],
    force_labels: { ...FORCE_LABELS },
    force_labels_bn: { ...FORCE_LABELS_BN },
    force_serials: { ...FORCE_CATALOG_SERIALS },
    force_ranks: defaultForceRanks(),
    force_rank_extras: Object.fromEntries(FORCES.map((f) => [f, [] as string[]])),
    force_rank_removed: Object.fromEntries(FORCES.map((f) => [f, [] as string[]])),
    force_rank_labels: Object.fromEntries(
      FORCES.map((f) => [f, {} as Record<string, string>]),
    ),
    force_rank_labels_bn: Object.fromEntries(
      FORCES.map((f) => [f, {} as Record<string, string>]),
    ),
    force_rank_serials: Object.fromEntries(
      FORCES.map((f) => [f, {} as Record<string, number>]),
    ),
    rank_labels: { ...RANK_LABELS },
    rank_labels_bn: { ...RANK_LABELS_BN },
    rank_serials: { ...RANK_CATALOG_SERIALS },
    rank_forces: {
      DAD: ["Army", "Police"],
      ...Object.fromEntries(
        RANKS.filter((r) => r !== "DAD").map((r) => [r, [] as string[]]),
      ),
    },
    rank_equivalents: {
      DAD: {
        Army: ["Sainik", "L/Cpl"],
        Police: ["Insp"],
      },
    },
    rank_force_wings: Object.fromEntries(
      RANKS.map((r) => [r, {} as Record<string, string[]>]),
    ),
    member_banks: [...MEMBER_BANKS],
    authorized: DEFAULT_AUTHORIZED.map((row) => ({
      ...row,
      wings: { ...(row.wings ?? {}) },
    })),
    manpower_officer_absent: {},
    manpower_held: {},
    manpower_absent: {},
    approved_dates: [],
    suppressed_carries: [],
    boro_khana_dates: [],
    state_reports: [],
    meal_plans,
    meal_assigns: seedMealAssigns(users, meal_plans),
    meal_shifts,
    guest_meals: seedGuestMeals(users),
    pritibhoj_events: demoPritibhojEvents(),
    paper_report_requests: [],
    tag_requests: demoTagRequests(users),
    version: SEED_VERSION,
  };
}
