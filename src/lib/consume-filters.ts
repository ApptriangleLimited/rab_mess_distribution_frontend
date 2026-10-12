import type { DailyTag } from "@/lib/types";

export const CONSUME_FILTERS = ["fr-mfr", "cd", "leave-med"] as const;

/** Ration Consume tab only — fuel bill for FR+MFR days. */
export const FUEL_CONSUME_FILTER = "fuel" as const;

export type ConsumeFilter =
  | (typeof CONSUME_FILTERS)[number]
  | typeof FUEL_CONSUME_FILTER;

export function consumeFiltersForRole(ration: boolean): ConsumeFilter[] {
  return ration ? [...CONSUME_FILTERS, FUEL_CONSUME_FILTER] : [...CONSUME_FILTERS];
}

export const CONSUME_FILTER_TAGS: Record<ConsumeFilter, readonly DailyTag[]> = {
  "fr-mfr": ["FR", "MFR"],
  cd: ["CD"],
  "leave-med": ["CL", "PL", "TRG", "WIT", "MED", "BGH", "LNK"],
  fuel: ["FR", "MFR"],
};

export const LEAVE_MED_BILL_TAGS = CONSUME_FILTER_TAGS["leave-med"];

const LEAVE_MED_SET = new Set<string>(LEAVE_MED_BILL_TAGS);

export function parseConsumeFilter(raw: string | null): ConsumeFilter {
  if (raw === FUEL_CONSUME_FILTER) return FUEL_CONSUME_FILTER;
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

export const CONSUME_MEMBER_TYPE_FILTERS = ["all", "attached", "new"] as const;

export type ConsumeMemberTypeFilter =
  (typeof CONSUME_MEMBER_TYPE_FILTERS)[number];

export function parseConsumeMemberType(
  raw: string | null | undefined,
): ConsumeMemberTypeFilter {
  if (raw === "attached" || raw === "new") return raw;
  return "all";
}

export function memberMatchesTypeFilter(
  memberType: string | undefined,
  filter: ConsumeMemberTypeFilter,
) {
  return filter === "all" || memberType === filter;
}
