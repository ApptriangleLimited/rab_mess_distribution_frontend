import { DAILY_TAGS, RATE_ONLY_TAGS, RANKS, WINGS } from "@/lib/constants";
import {
  dateInMonth,
  daysInMonth,
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

/** Bump → auto wipe localStorage + reseed on next load. */
export const SEED_VERSION = 10;

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

  return {
    users,
    assignments,
    senders,
    rates,
    approved_dates: [],
    suppressed_carries: [],
    boro_khana_dates: [],
    state_reports: [],
    version: SEED_VERSION,
  };
}
