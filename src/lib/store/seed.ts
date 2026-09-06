import {
  BRANCH_DISTRICTS,
  DEFAULT_AUTHORIZED,
  DAILY_TAGS,
  defaultForceRanks,
  FORCES,
  RATE_ONLY_TAGS,
  RANKS,
  RELIGIONS,
  WINGS,
  ADMIN_SUB_WINGS,
  HQ_SUB_WINGS,
  DEFAULT_WING_PARENT,
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
    | "out_date"
    | "member_type"
    | "personal_id"
    | "emergency_contacts"
    | "default_tag"
    | "inactive_spans"
  > & {
    documents?: User["documents"];
    documents_verified?: boolean;
    joining_date?: string;
    out_date?: string;
    member_type?: User["member_type"];
    personal_id?: string;
    emergency_contacts?: User["emergency_contacts"];
    default_tag?: DailyTag;
    inactive_spans?: User["inactive_spans"];
  },
): User {
  const ts = nowISO();
  return {
    ...partial,
    documents: partial.documents ?? [],
    documents_verified: partial.documents_verified ?? false,
    joining_date: partial.joining_date ?? todayISO(),
    out_date: partial.out_date ?? "",
    member_type: partial.member_type ?? "permanent",
    personal_id: partial.personal_id ?? "",
    emergency_contacts: partial.emergency_contacts ?? [],
    default_tag: partial.default_tag ?? "MS",
    inactive_spans:
      partial.inactive_spans ??
      (partial.status === "0"
        ? [{ from: partial.joining_date ?? "2020-01-01", to: null }]
        : []),
    created_at: ts,
    updated_at: ts,
  };
}

const FIRST_NAMES = [
  "Karim",
  "Nusrat",
  "Rafiq",
  "Sabbir",
  "Imran",
  "Farhana",
  "Jamal",
  "Tania",
  "Hasan",
  "Shila",
  "Mehedi",
  "Rina",
  "Omar",
  "Lamia",
  "Sajjad",
  "Ayesha",
  "Babul",
  "Nazmul",
  "Sumaiya",
  "Arif",
  "Farzana",
  "Kamal",
  "Nadia",
  "Rubel",
  "Popy",
  "Jahid",
  "Mitu",
  "Sohel",
  "Jannat",
  "Rakib",
  "Salma",
  "Tanvir",
  "Mousumi",
  "Ashraf",
  "Faria",
  "Belal",
  "Ruma",
  "Shuvo",
  "Nasrin",
  "Habib",
  "Shahnaz",
  "Masud",
  "Laboni",
  "Yousuf",
  "Sharmin",
  "Anwar",
  "Keya",
  "Faisal",
  "Runa",
  "Nayeem",
];

const LAST_NAMES = [
  "Hossain",
  "Jahan",
  "Ahmed",
  "Khan",
  "Ali",
  "Akter",
  "Uddin",
  "Rahman",
  "Mahmud",
  "Begum",
  "Hasan",
  "Faruk",
  "Chowdhury",
  "Sultana",
  "Mia",
  "Islam",
  "Karim",
  "Siddique",
  "Alam",
  "Parveen",
];

/** Branches for Settings member-bank catalog (MEMBER_BANKS). */
const BANK_BRANCHES = ["Mirpur", "Uttara", "Motijheel"] as const;

const BANKS = MEMBER_BANKS.map((bank, i) => ({
  bank,
  branch: BANK_BRANCHES[i % BANK_BRANCHES.length]!,
}));

/** Base duty tags for roster members (pending/ended skip assignments). */
const BASE_TAGS: DailyTag[] = [
  "MS",
  "MS",
  "MS",
  "MS",
  "MS",
  "FR",
  "FR",
  "FR",
  "TRG",
  "WR",
  "CD",
  "MED",
  "CL",
  "PL",
  "WIT",
];

const OVERLAY_TAGS: DailyTag[] = [
  "CL",
  "TRG",
  "WIT",
  "MED",
  "PL",
  "CD",
  "MS",
  "WR",
];

type MemberPlan = {
  user_id: string;
  base: DailyTag;
  spans?: { tag: DailyTag; from: number; to: number }[];
};

const SEED_WINGS = [
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

/** Ranks that fill Manpower columns (Officer + Settings RANKS). */
const SEED_MANPOWER_RANKS = ["Officer", ...RANKS] as const;

/** How many approved members per wing for each rank — demo-sized Form 1. */
const SEED_RANK_PER_WING: Record<(typeof SEED_MANPOWER_RANKS)[number], number> =
  {
    Officer: 2,
    DAD: 2,
    RT: 1,
    ASI: 3,
    AASI: 3,
    Naik: 4,
    Constable: 7,
    Cook: 1,
    ANCE: 1,
    Civill: 1,
    Attached: 1,
  };

/** Full tag history only for first N roster members (mess/consume demos). */
const SEED_FULL_HISTORY_ROSTER = 25;

/** Total demo members (edge cases + grid + pending civilian). */
const SEED_DEMO_MEMBER_TOTAL = 25;

function seedDocuments(n: number): DocumentMeta[] {
  return [
    {
      name: n % 3 === 0 ? "posting-order.pdf" : "joining-order.pdf",
      size: 180_000 + n * 4_200,
    },
  ];
}

type SeedMemberProfile = {
  member_type: MemberType;
  approval_status: User["approval_status"];
  status: User["status"];
  idPrefix: string;
  rabBase: number;
  out_date?: string;
};

function buildDemoUsers(): User[] {
  const users: User[] = [];
  let n = 0;

  function pushMember(opts: {
    profile: SeedMemberProfile;
    rank: string;
    wing: string;
    force?: string;
  }) {
    n += 1;
    const i = n - 1;
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const name = `${first} ${last}`;
    const bank = BANKS[i % BANKS.length]!;
    const profile = opts.profile;
    const isCivilian =
      profile.member_type === "civilian" || opts.rank === "Civill";
    const force =
      opts.force ??
      (isCivilian ? "Civilian" : FORCES[i % (FORCES.length - 1)]!);
    const religion = RELIGIONS[i % RELIGIONS.length]!;
    const personalNo = isCivilian
      ? `${1980 + (n % 20)}${String(1000000 + n * 137).slice(0, 8)}`
      : `PN-${String(10000 + n).padStart(5, "0")}`;
    const cardNo = isCivilian ? `CARD-${String(n).padStart(4, "0")}` : "";
    const rab_id = isCivilian
      ? `CIV-${cardNo.replace(/^CARD-/, "")}`
      : `RAB-${profile.rabBase}`;

    users.push(
      user({
        id: `${profile.idPrefix}_${n}`,
        name,
        personal_id: personalNo,
        rab_id,
        rfid: isCivilian ? "" : `RFID-${profile.rabBase}`,
        rank: isCivilian ? "Civill" : opts.rank,
        wing: opts.wing,
        force,
        religion,
        member_type: profile.member_type,
        dropdown_no: cardNo,
        phone: `01711${String(n).padStart(6, "0")}`,
        status: profile.status,
        approval_status: profile.approval_status,
        bank_name: bank.bank,
        account_name: name,
        account_number: `${profile.approval_status === "pending" ? "11" : "22"}02${String(profile.rabBase).padStart(6, "0")}`,
        routing: `20027${String(n).padStart(4, "0")}`,
        branch: bank.branch,
        branch_location: BRANCH_DISTRICTS[i % BRANCH_DISTRICTS.length]!,
        documents: seedDocuments(n),
        out_date: profile.out_date ?? "",
        joining_date:
          n % 7 === 0
            ? dateInMonth(shiftMonthKey(monthKey(), -2), 1 + (n % 20))
            : todayISO(),
        emergency_contacts:
          n % 5 === 0
            ? [
                {
                  name: `${last} Contact`,
                  relation: n % 2 === 0 ? "Spouse" : "Father",
                  phone: `01811${String(n).padStart(6, "0")}`,
                },
              ]
            : [],
      }),
    );
  }

  // Edge-case rows for CC/Daily workflows (not on Manpower held).
  pushMember({
    profile: {
      member_type: "new",
      approval_status: "pending",
      status: "1",
      idPrefix: "u_pending",
      rabBase: 1001,
    },
    rank: "Constable",
    wing: "Ops Wg",
  });
  pushMember({
    profile: {
      member_type: "permanent",
      approval_status: "ended",
      status: "0",
      idPrefix: "u_ended",
      rabBase: 2002,
      out_date: shiftMonthKey(monthKey(), -1) + "-15",
    },
    rank: "ASI",
    wing: "Int Wg",
  });
  pushMember({
    profile: {
      member_type: "permanent",
      approval_status: "approved",
      status: "0",
      idPrefix: "u_off",
      rabBase: 2003,
    },
    rank: "DAD",
    wing: "Admin",
  });

  // Main Manpower grid: round-robin wings so SEED_DEMO_MEMBER_TOTAL
  // does not dump everyone on Admin (first wing).
  const gridSlots: { wing: string; rank: (typeof SEED_MANPOWER_RANKS)[number] }[] =
    [];
  for (const rank of SEED_MANPOWER_RANKS) {
    const copies = SEED_RANK_PER_WING[rank] ?? 1;
    for (let c = 0; c < copies; c++) {
      for (const wing of SEED_WINGS) {
        gridSlots.push({ wing, rank });
      }
    }
  }
  for (const slot of gridSlots) {
    if (users.length >= SEED_DEMO_MEMBER_TOTAL - 1) break;
    const isCiv = slot.rank === "Civill";
    const isAtt = slot.rank === "Attached";
    pushMember({
      profile: {
        member_type: isCiv
          ? "civilian"
          : isAtt
            ? "attached"
            : "permanent",
        approval_status: "approved",
        status: "1",
        idPrefix: isCiv ? "u_civ" : isAtt ? "u_att" : "u",
        rabBase: 3000 + n + 1,
      },
      rank: slot.rank,
      wing: slot.wing,
    });
  }

  // One pending civilian for CC queue demo.
  pushMember({
    profile: {
      member_type: "civilian",
      approval_status: "pending",
      status: "1",
      idPrefix: "u_civ_pending",
      rabBase: 9001,
    },
    rank: "Civill",
    wing: "Admin",
  });

  return users;
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
export const SEED_VERSION = 30;

export function createSeedState(): AppState {
  const today = todayISO();
  const users = buildDemoUsers();
  const fullHistoryDates = seedDemoDates(3);
  const currentMonthDates = monthDatesThroughToday();
  const memberPlans = buildMemberPlans(users);
  const defaultByUser = new Map(
    memberPlans.map((plan) => [plan.user_id, plan.base] as const),
  );
  for (const u of users) {
    u.default_tag = defaultByUser.get(u.id) ?? "MS";
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
        tag: tagForPlan(plan, day, lastDay),
        updated_by: "daily",
        updated_at: nowISO(),
      });
    }
  }

  const senders: SenderAccount[] = [
    {
      id: "s_fr",
      label: "FR Pool",
      bank_name: MEMBER_BANKS[0]!,
      account_name: "RAB FR Allowance",
      account_number: "9001001001",
      routing: "000000001",
      branch: "Head Office",
      branch_location: "Dhaka",
      mapped_tags: ["FR"],
      active: true,
    },
    {
      id: "s_ms",
      label: "Mess Fund",
      bank_name: MEMBER_BANKS[1]!,
      account_name: "RAB Mess Fund",
      account_number: "9001001002",
      routing: "000000002",
      branch: "HQ Branch",
      branch_location: "Dhaka",
      mapped_tags: ["MS"],
      active: true,
    },
    {
      id: "s_ops",
      label: "Ops Contingency",
      bank_name: MEMBER_BANKS[2]!,
      account_name: "RAB Ops Pool",
      account_number: "9001001003",
      routing: "000000003",
      branch: "Central",
      branch_location: "Dhaka",
      mapped_tags: ["CD", "TRG"],
      active: true,
    },
    {
      id: "s_med",
      label: "Medical Pool",
      bank_name: MEMBER_BANKS[0]!,
      account_name: "RAB Medical Fund",
      account_number: "9001001004",
      routing: "000000004",
      branch: "HQ Branch",
      branch_location: "Dhaka",
      mapped_tags: ["MED", "WIT"],
      active: true,
    },
    {
      id: "s_leave",
      label: "Leave / Admin",
      bank_name: MEMBER_BANKS[1]!,
      account_name: "RAB Admin Pool",
      account_number: "9001001005",
      routing: "000000005",
      branch: "Banani",
      branch_location: "Dhaka",
      mapped_tags: ["CL", "PL", "WR"],
      active: true,
    },
  ];

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
    ranks: [...RANKS],
    wings: [...WINGS, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS],
    wing_parent: { ...DEFAULT_WING_PARENT },
    wing_labels: {},
    forces: [...FORCES],
    force_ranks: defaultForceRanks(),
    force_rank_extras: Object.fromEntries(FORCES.map((f) => [f, [] as string[]])),
    force_rank_removed: Object.fromEntries(FORCES.map((f) => [f, [] as string[]])),
    force_rank_labels: Object.fromEntries(
      FORCES.map((f) => [f, {} as Record<string, string>]),
    ),
    rank_labels: {},
    rank_forces: {
      DAD: ["Army", "Police"],
      ...Object.fromEntries(
        RANKS.filter((r) => r !== "DAD").map((r) => [r, [] as string[]]),
      ),
    },
    rank_equivalents: {
      DAD: {
        Army: ["OR", "L/Cpl"],
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
    approved_dates: [],
    suppressed_carries: [],
    boro_khana_dates: [],
    state_reports: [],
    meal_plans,
    meal_assigns: seedMealAssigns(users, meal_plans),
    meal_shifts,
    guest_meals: seedGuestMeals(users),
    pritibhoj_events: demoPritibhojEvents(),
    tag_requests: demoTagRequests(users),
    version: SEED_VERSION,
  };
}
