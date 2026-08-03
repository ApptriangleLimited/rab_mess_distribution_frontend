import { DAILY_TAGS } from "@/lib/constants";
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
  partial: Omit<User, "created_at" | "updated_at" | "documents"> & {
    documents?: User["documents"];
  },
): User {
  const ts = nowISO();
  return {
    documents: [],
    created_at: ts,
    updated_at: ts,
    ...partial,
  };
}

export function createSeedState(): AppState {
  const today = todayISO();
  const users: User[] = [
    user({
      id: "u_pending_1",
      name: "Karim Hossain",
      rab_id: "RAB-1001",
      rfid: "RFID-1001",
      rank: "Constable",
      wing: "Alpha",
      dropdown_no: "D-01",
      phone: "01711000001",
      status: "1",
      approval_status: "pending",
      bank_name: "Sonali Bank",
      account_name: "Karim Hossain",
      account_number: "1102001001",
      routing: "200270001",
      branch: "Mirpur",
    }),
    user({
      id: "u_pending_2",
      name: "Nusrat Jahan",
      rab_id: "RAB-1002",
      rfid: "RFID-1002",
      rank: "ASI",
      wing: "Bravo",
      dropdown_no: "D-02",
      phone: "01711000002",
      status: "1",
      approval_status: "pending",
      bank_name: "Agrani Bank",
      account_name: "Nusrat Jahan",
      account_number: "1102001002",
      routing: "200270002",
      branch: "Uttara",
    }),
    user({
      id: "u_ms_1",
      name: "Rafiq Ahmed",
      rab_id: "RAB-2001",
      rfid: "RFID-2001",
      rank: "Naik",
      wing: "Alpha",
      dropdown_no: "D-11",
      phone: "01711000011",
      status: "1",
      approval_status: "approved",
      bank_name: "Janata Bank",
      account_name: "Rafiq Ahmed",
      account_number: "2202002001",
      routing: "200270011",
      branch: "Motijheel",
    }),
    user({
      id: "u_ms_2",
      name: "Sabbir Khan",
      rab_id: "RAB-2002",
      rfid: "RFID-2002",
      rank: "Havildar",
      wing: "Charlie",
      dropdown_no: "D-12",
      phone: "01711000012",
      status: "1",
      approval_status: "approved",
      bank_name: "Pubali Bank",
      account_name: "Sabbir Khan",
      account_number: "2202002002",
      routing: "200270012",
      branch: "Banani",
    }),
    user({
      id: "u_fr_1",
      name: "Imran Ali",
      rab_id: "RAB-2003",
      rfid: "RFID-2003",
      rank: "SI",
      wing: "Delta",
      dropdown_no: "D-13",
      phone: "01711000013",
      status: "1",
      approval_status: "approved",
      bank_name: "BRAC Bank",
      account_name: "Imran Ali",
      account_number: "2202002003",
      routing: "200270013",
      branch: "Gulshan",
    }),
    user({
      id: "u_cl_1",
      name: "Farhana Akter",
      rab_id: "RAB-2004",
      rfid: "RFID-2004",
      rank: "Inspector",
      wing: "HQ",
      dropdown_no: "D-14",
      phone: "01711000014",
      status: "1",
      approval_status: "approved",
      bank_name: "City Bank",
      account_name: "Farhana Akter",
      account_number: "2202002004",
      routing: "200270014",
      branch: "Dhanmondi",
    }),
    user({
      id: "u_off_1",
      name: "Jamal Uddin",
      rab_id: "RAB-2005",
      rfid: "RFID-2005",
      rank: "Constable",
      wing: "Support",
      dropdown_no: "D-15",
      phone: "01711000015",
      status: "0",
      approval_status: "approved",
      bank_name: "Dutch Bangla",
      account_name: "Jamal Uddin",
      account_number: "2202002005",
      routing: "200270015",
      branch: "Mohakhali",
    }),
    user({
      id: "u_ms_3",
      name: "Tania Rahman",
      rab_id: "RAB-2006",
      rfid: "RFID-2006",
      rank: "ASI",
      wing: "Bravo",
      dropdown_no: "D-16",
      phone: "01711000016",
      status: "1",
      approval_status: "approved",
      bank_name: "Islami Bank",
      account_name: "Tania Rahman",
      account_number: "2202002006",
      routing: "200270016",
      branch: "Farmgate",
    }),
    user({
      id: "u_ms_4",
      name: "Hasan Mahmud",
      rab_id: "RAB-2007",
      rfid: "RFID-2007",
      rank: "Constable",
      wing: "Alpha",
      dropdown_no: "D-17",
      phone: "01711000017",
      status: "1",
      approval_status: "approved",
      bank_name: "Sonali Bank",
      account_name: "Hasan Mahmud",
      account_number: "2202002007",
      routing: "200270017",
      branch: "Mirpur",
    }),
    user({
      id: "u_ms_5",
      name: "Shila Begum",
      rab_id: "RAB-2008",
      rfid: "RFID-2008",
      rank: "Naik",
      wing: "Charlie",
      dropdown_no: "D-18",
      phone: "01711000018",
      status: "1",
      approval_status: "approved",
      bank_name: "Agrani Bank",
      account_name: "Shila Begum",
      account_number: "2202002008",
      routing: "200270018",
      branch: "Uttara",
    }),
    user({
      id: "u_fr_2",
      name: "Mehedi Hasan",
      rab_id: "RAB-2009",
      rfid: "RFID-2009",
      rank: "Havildar",
      wing: "Delta",
      dropdown_no: "D-19",
      phone: "01711000019",
      status: "1",
      approval_status: "approved",
      bank_name: "Janata Bank",
      account_name: "Mehedi Hasan",
      account_number: "2202002009",
      routing: "200270019",
      branch: "Motijheel",
    }),
    user({
      id: "u_med_1",
      name: "Rina Akter",
      rab_id: "RAB-2010",
      rfid: "RFID-2010",
      rank: "ASI",
      wing: "HQ",
      dropdown_no: "D-20",
      phone: "01711000020",
      status: "1",
      approval_status: "approved",
      bank_name: "Pubali Bank",
      account_name: "Rina Akter",
      account_number: "2202002010",
      routing: "200270020",
      branch: "Banani",
    }),
    user({
      id: "u_trg_1",
      name: "Omar Faruk",
      rab_id: "RAB-2011",
      rfid: "RFID-2011",
      rank: "SI",
      wing: "Support",
      dropdown_no: "D-21",
      phone: "01711000021",
      status: "1",
      approval_status: "approved",
      bank_name: "BRAC Bank",
      account_name: "Omar Faruk",
      account_number: "2202002011",
      routing: "200270021",
      branch: "Gulshan",
    }),
    user({
      id: "u_wr_1",
      name: "Lamia Chowdhury",
      rab_id: "RAB-2012",
      rfid: "RFID-2012",
      rank: "Constable",
      wing: "Bravo",
      dropdown_no: "D-22",
      phone: "01711000022",
      status: "1",
      approval_status: "approved",
      bank_name: "City Bank",
      account_name: "Lamia Chowdhury",
      account_number: "2202002012",
      routing: "200270022",
      branch: "Dhanmondi",
    }),
    user({
      id: "u_cd_1",
      name: "Sajjad Hossain",
      rab_id: "RAB-2013",
      rfid: "RFID-2013",
      rank: "Inspector",
      wing: "Alpha",
      dropdown_no: "D-23",
      phone: "01711000023",
      status: "1",
      approval_status: "approved",
      bank_name: "Dutch Bangla",
      account_name: "Sajjad Hossain",
      account_number: "2202002013",
      routing: "200270023",
      branch: "Mohakhali",
    }),
    user({
      id: "u_pending_3",
      name: "Ayesha Sultana",
      rab_id: "RAB-1003",
      rfid: "RFID-1003",
      rank: "Constable",
      wing: "Charlie",
      dropdown_no: "D-03",
      phone: "01711000003",
      status: "1",
      approval_status: "pending",
      bank_name: "Islami Bank",
      account_name: "Ayesha Sultana",
      account_number: "1102001003",
      routing: "200270003",
      branch: "Farmgate",
    }),
    user({
      id: "u_ended_1",
      name: "Babul Mia",
      rab_id: "RAB-2014",
      rfid: "RFID-2014",
      rank: "Naik",
      wing: "Delta",
      dropdown_no: "D-24",
      phone: "01711000024",
      status: "0",
      approval_status: "ended",
      bank_name: "Sonali Bank",
      account_name: "Babul Mia",
      account_number: "2202002014",
      routing: "200270024",
      branch: "Mirpur",
    }),
  ];

  const dates = seedDemoDates(3);

  /** Base tag + mid-month overlays so ledger shows mixed tags per member. */
  type MemberPlan = {
    user_id: string;
    base: DailyTag;
    spans?: { tag: DailyTag; from: number; to: number }[];
  };

  const memberPlans: MemberPlan[] = [
    {
      user_id: "u_ms_1",
      base: "MS",
      spans: [{ tag: "CL", from: 10, to: 13 }],
    },
    {
      user_id: "u_ms_2",
      base: "MS",
      spans: [{ tag: "TRG", from: 15, to: 18 }],
    },
    {
      user_id: "u_ms_3",
      base: "MS",
      spans: [{ tag: "WIT", from: 5, to: 6 }],
    },
    {
      user_id: "u_ms_4",
      base: "MS",
      spans: [{ tag: "MED", from: 22, to: 24 }],
    },
    {
      user_id: "u_ms_5",
      base: "MS",
      spans: [{ tag: "PL", from: 1, to: 3 }],
    },
    {
      user_id: "u_fr_1",
      base: "FR",
      spans: [{ tag: "CL", from: -4, to: -1 }],
    },
    {
      user_id: "u_fr_2",
      base: "FR",
      spans: [{ tag: "TRG", from: 8, to: 12 }],
    },
    {
      user_id: "u_cl_1",
      base: "FR",
      spans: [{ tag: "CL", from: -5, to: -1 }],
    },
    {
      user_id: "u_med_1",
      base: "FR",
      spans: [{ tag: "MED", from: 1, to: 7 }],
    },
    {
      user_id: "u_trg_1",
      base: "TRG",
      spans: [{ tag: "CD", from: 20, to: 25 }],
    },
    {
      user_id: "u_wr_1",
      base: "WR",
      spans: [{ tag: "MS", from: 14, to: 16 }],
    },
    {
      user_id: "u_cd_1",
      base: "CD",
      spans: [
        { tag: "TRG", from: 3, to: 7 },
        { tag: "CL", from: 28, to: 31 },
      ],
    },
  ];

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
  ];

  const rates: AllowanceRate[] = DAILY_TAGS.map((tag) => ({
    tag: tag.code,
    amount_per_day: tag.allowance ? (tag.code === "MS" ? 180 : 220) : 0,
  }));

  return {
    users,
    assignments,
    senders,
    rates,
    approved_dates: [],
    suppressed_carries: [],
    version: 4,
  };
}
