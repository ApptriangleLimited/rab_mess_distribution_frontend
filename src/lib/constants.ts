import type { DailyTag, Role } from "@/lib/types";
import type { MessageKey } from "@/i18n";

export const ROLE_HOMES: Record<Role, string> = {
  cc: "/cc/users",
  daily: "/daily/tags",
  mess: "/mess/today",
  consume: "/consume/monthly/ledger",
  ration: "/ration/monthly",
};

/** @deprecated Prefer t(`roles.${role}`) — kept for non-UI code paths. */
export const ROLE_KEYS = ["cc", "daily", "mess", "consume", "ration"] as const satisfies readonly Role[];

export const DAILY_TAGS: {
  code: DailyTag;
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
];

export const RANKS = [
  "Constable",
  "Naik",
  "Havildar",
  "ASI",
  "SI",
  "Inspector",
  "ASP",
  "Addl SP",
];

export const WINGS = ["Alpha", "Bravo", "Charlie", "Delta", "HQ", "Support"];

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

/** Extra fuel ৳/day for FR bill print (0 hides fuel columns until set). */
export const FR_FUEL_RATE_PER_DAY = 50;

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

export const SESSION_COOKIE = "mess_session";
export const SESSION_STORAGE_KEY = "mess_session_v1";
export const STORE_KEY = "mess_proto_v1";
