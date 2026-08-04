import { getState, setState } from "@/lib/store";
import { DAILY_TAGS } from "@/lib/constants";
import type { AllowanceRate, DailyTag } from "@/lib/types";

export function listRates() {
  return getState().rates;
}

/** Built-in order first, then custom rate tags. */
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
    if (seen.has(key)) continue;
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
  const rate = listRates().find(
    (r) => r.tag.toLowerCase() === tag.toLowerCase(),
  );
  if (rate) return rate.amount_per_day > 0;
  return DAILY_TAGS.some((t) => t.code === tag && t.allowance);
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
  setState((prev) => ({ ...prev, rates }));
}
