import { DAILY_TAGS, RATE_ONLY_TAGS, RANKS, WINGS } from "@/lib/constants";
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
import type {
  AllowanceRate,
  AppState,
  DailyAssignment,
  DailyTag,
  MealAssign,
  MealPlan,
  MealShift,
  MealShiftId,
  GuestMeal,
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
    | "joining_date"
    | "out_date"
    | "member_type"
    | "personal_id"
    | "emergency_contacts"
  > & {
    documents?: User["documents"];
    joining_date?: string;
    out_date?: string;
    member_type?: User["member_type"];
    personal_id?: string;
    emergency_contacts?: User["emergency_contacts"];
  },
): User {
  const ts = nowISO();
  return {
    documents: [],
    joining_date: todayISO(),
    out_date: "",
    member_type: "permanent",
    personal_id: "",
    emergency_contacts: [],
    created_at: ts,
    updated_at: ts,
    ...partial,
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

const BANKS = [
  { bank: "Sonali Bank", branch: "Mirpur" },
  { bank: "Agrani Bank", branch: "Uttara" },
  { bank: "Janata Bank", branch: "Motijheel" },
  { bank: "Pubali Bank", branch: "Banani" },
  { bank: "BRAC Bank", branch: "Gulshan" },
  { bank: "City Bank", branch: "Dhanmondi" },
  { bank: "Dutch Bangla", branch: "Mohakhali" },
  { bank: "Islami Bank", branch: "Farmgate" },
];

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

function buildDemoUsers(total = 12): User[] {
  const users: User[] = [];

  for (let i = 0; i < total; i++) {
    const n = i + 1;
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const name = `${first} ${last}`;
    const rank = RANKS[i % RANKS.length]!;
    const wing = WINGS[i % WINGS.length]!;
    const bank = BANKS[i % BANKS.length]!;

    // Mix approval / status for UI demos (scaled for small seeds).
    let approval_status: User["approval_status"] = "approved";
    let status: User["status"] = "1";
    let out_date = "";
    let idPrefix = "u";
    let rabBase = 2000 + n;

    if (total <= 12) {
      if (n === 1) {
        approval_status = "pending";
        idPrefix = "u_pending";
        rabBase = 1000 + n;
      } else if (n === 2) {
        approval_status = "ended";
        status = "0";
        out_date = shiftMonthKey(monthKey(), -1) + "-15";
        idPrefix = "u_ended";
      } else if (n === 3) {
        status = "0";
        idPrefix = "u_off";
      }
    } else if (n <= 4) {
      approval_status = "pending";
      idPrefix = "u_pending";
      rabBase = 1000 + n;
    } else if (n === 5 || n === 6) {
      approval_status = "ended";
      status = "0";
      out_date = shiftMonthKey(monthKey(), -1) + "-15";
      idPrefix = "u_ended";
    } else if (n === 7 || n === 8) {
      status = "0";
      idPrefix = "u_off";
    }

    const rab_id = `RAB-${rabBase}`;
    users.push(
      user({
        id: `${idPrefix}_${n}`,
        name,
        rab_id,
        rfid: `RFID-${rabBase}`,
        rank,
        wing,
        dropdown_no: `D-${String(n).padStart(2, "0")}`,
        phone: `01711${String(n).padStart(6, "0")}`,
        status,
        approval_status,
        bank_name: bank.bank,
        account_name: name,
        account_number: `${approval_status === "pending" ? "11" : "22"}02${String(rabBase).padStart(6, "0")}`,
        routing: `20027${String(n).padStart(4, "0")}`,
        branch: bank.branch,
        out_date,
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
export const SEED_VERSION = 16;

export function createSeedState(): AppState {
  const today = todayISO();
  const users = buildDemoUsers(50);
  const dates = seedDemoDates(3);
  const memberPlans = buildMemberPlans(users);

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
  for (const date of dates) {
    const day = Number(date.slice(8, 10));
    const month = date.slice(0, 7);
    const lastDay =
      month === monthKey()
        ? Number(today.slice(8, 10))
        : daysInMonth(month);

    for (const plan of memberPlans) {
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
      bank_name: "Bangladesh Bank",
      account_name: "RAB FR Allowance",
      account_number: "9001001001",
      routing: "000000001",
      branch: "Head Office",
      mapped_tags: ["FR"],
    },
    {
      id: "s_ms",
      label: "Mess Fund",
      bank_name: "Sonali Bank",
      account_name: "RAB Mess Fund",
      account_number: "9001001002",
      routing: "000000002",
      branch: "HQ Branch",
      mapped_tags: ["MS"],
    },
    {
      id: "s_ops",
      label: "Ops Contingency",
      bank_name: "Agrani Bank",
      account_name: "RAB Ops Pool",
      account_number: "9001001003",
      routing: "000000003",
      branch: "Central",
      mapped_tags: ["CD", "TRG"],
    },
    {
      id: "s_med",
      label: "Medical Pool",
      bank_name: "Janata Bank",
      account_name: "RAB Medical Fund",
      account_number: "9001001004",
      routing: "000000004",
      branch: "HQ Branch",
      mapped_tags: ["MED", "WIT"],
    },
    {
      id: "s_leave",
      label: "Leave / Admin",
      bank_name: "Pubali Bank",
      account_name: "RAB Admin Pool",
      account_number: "9001001005",
      routing: "000000005",
      branch: "Banani",
      mapped_tags: ["CL", "PL", "WR"],
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
    approved_dates: [],
    suppressed_carries: [],
    boro_khana_dates: [],
    state_reports: [],
    meal_plans,
    meal_assigns: seedMealAssigns(users, meal_plans),
    meal_shifts,
    guest_meals: seedGuestMeals(users),
    version: SEED_VERSION,
  };
}
