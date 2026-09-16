import type { DailyTag } from "@/lib/types";

export const CONSUME_FILTERS = ["fr-mfr", "cd", "leave-med"] as const;

export type ConsumeFilter = (typeof CONSUME_FILTERS)[number];

export const CONSUME_FILTER_TAGS: Record<ConsumeFilter, readonly DailyTag[]> = {
  "fr-mfr": ["FR", "MFR"],
  cd: ["CD"],
  "leave-med": ["CL", "PL", "TRG", "WIT", "MED", "BGH"],
};

export const LEAVE_MED_BILL_TAGS = CONSUME_FILTER_TAGS["leave-med"];

const LEAVE_MED_SET = new Set<string>(LEAVE_MED_BILL_TAGS);

export function parseConsumeFilter(raw: string | null): ConsumeFilter {
  if (raw && (CONSUME_FILTERS as readonly string[]).includes(raw)) {
    return raw as ConsumeFilter;
  }
  const tag = (raw ?? "").toUpperCase();
  if (tag === "FR" || tag === "MFR") return "fr-mfr";
  if (tag === "CD") return "cd";
  if (LEAVE_MED_SET.has(tag)) return "leave-med";
  return "fr-mfr";
}

export function consumeFilterLabel(filter: ConsumeFilter) {
  return CONSUME_FILTER_TAGS[filter].join("+");
}
