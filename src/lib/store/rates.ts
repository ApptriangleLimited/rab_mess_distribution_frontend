import { getState, setState } from "@/lib/store";
import type { AllowanceRate, DailyTag } from "@/lib/types";

export function listRates() {
  return getState().rates;
}

export function upsertRate(tag: DailyTag, amount_per_day: number): AllowanceRate {
  const rate: AllowanceRate = { tag, amount_per_day: Math.max(0, amount_per_day) };
  setState((prev) => {
    const exists = prev.rates.some((r) => r.tag === tag);
    return {
      ...prev,
      rates: exists
        ? prev.rates.map((r) => (r.tag === tag ? rate : r))
        : [...prev.rates, rate],
    };
  });
  return rate;
}

export function setRates(rates: AllowanceRate[]) {
  setState((prev) => ({ ...prev, rates }));
}
