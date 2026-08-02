import type { DailyTag, Role } from "@/lib/types";
import type { MessageKey } from "@/i18n";

export const ROLE_HOMES: Record<Role, string> = {
  cc: "/cc/users",
  daily: "/daily/approvals",
  mess: "/mess/today",
  consume: "/consume/monthly",
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

export const SESSION_COOKIE = "mess_session";
export const SESSION_STORAGE_KEY = "mess_session_v1";
export const STORE_KEY = "mess_proto_v1";
