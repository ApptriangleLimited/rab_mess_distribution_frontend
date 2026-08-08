import { getState, setState } from "@/lib/store";
import {
  DAILY_TAGS,
  FR_FUEL_RATE_PER_DAY,
  FUEL_RATE_TAG,
  isRateOnlyTag,
  RATE_ONLY_TAGS,
} from "@/lib/constants";
import type { AllowanceRate, DailyTag } from "@/lib/types";

export function listRates() {
  return getState().rates;
}

/** Built-in duty tags first, then custom rate tags (excludes rate-only). */
export function listAllTags(): DailyTag[] {
  const rates = listRates();
  const seen = new Set<string>();
  const out: DailyTag[] = [];

  for (const builtIn of DAILY_TAGS) {
    const fromRate = rates.find(
      (r) => r.tag.toLowerCase() === builtIn.code.toLowerCase(),
    );
    const code = (fromRate?.tag ?? builtIn.code) as DailyTag;
    seen.add(code.toLowerCase());
    out.push(code);
  }

  for (const rate of rates) {
    const key = rate.tag.toLowerCase();
    if (seen.has(key) || isRateOnlyTag(rate.tag)) continue;
    seen.add(key);
    out.push(rate.tag);
  }

  return out;
}

export function isKnownTag(value: string): value is DailyTag {
  const key = value.toLowerCase();
  return listAllTags().some((t) => t.toLowerCase() === key);
}

/** Payout tag: rate > 0, else built-in allowance flag. */
export function isAllowanceTag(tag: string): boolean {
  if (isRateOnlyTag(tag)) return false;
  const rate = listRates().find(
    (r) => r.tag.toLowerCase() === tag.toLowerCase(),
  );
  if (rate) return rate.amount_per_day > 0;
  return DAILY_TAGS.some((t) => t.code === tag && t.allowance);
}

/** FR bill fuel ৳/day from Settings FUEL rate. */
export function getFuelRatePerDay(): number {
  const rate = listRates().find(
    (r) => r.tag.toLowerCase() === FUEL_RATE_TAG.toLowerCase(),
  );
  if (rate) return Math.max(0, rate.amount_per_day);
  return FR_FUEL_RATE_PER_DAY;
}

export function upsertRate(tag: DailyTag, amount_per_day: number): AllowanceRate {
  const code = String(tag).trim() as DailyTag;
  const rate: AllowanceRate = {
    tag: code,
    amount_per_day: Math.max(0, amount_per_day),
  };
  setState((prev) => {
    const key = code.toLowerCase();
    const exists = prev.rates.some((r) => r.tag.toLowerCase() === key);
    return {
      ...prev,
      rates: exists
        ? prev.rates.map((r) => (r.tag.toLowerCase() === key ? rate : r))
        : [...prev.rates, rate],
    };
  });
  return rate;
}

export function removeRate(tag: DailyTag) {
  const key = String(tag).trim().toLowerCase();
  if (isRateOnlyTag(key)) return;
  setState((prev) => ({
    ...prev,
    rates: prev.rates.filter((r) => r.tag.toLowerCase() !== key),
    senders: prev.senders.map((s) => ({
      ...s,
      mapped_tags: s.mapped_tags.filter((t) => t.toLowerCase() !== key),
    })),
  }));
}

export function setRates(rates: AllowanceRate[]) {
  const next = [...rates];
  for (const only of RATE_ONLY_TAGS) {
    const exists = next.some(
      (r) => r.tag.toLowerCase() === only.code.toLowerCase(),
    );
    if (!exists) {
      next.push({ tag: only.code, amount_per_day: only.defaultAmount });
    }
  }
  setState((prev) => ({ ...prev, rates: next }));
}
