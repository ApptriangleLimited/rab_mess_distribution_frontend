import { ADMIN_SUB_WINGS, WINGS } from "@/lib/constants";
import type { LedgerRow } from "@/lib/reports";

/**
 * Daily cockpit register print order.
 * Replace this list when the official wing serial is provided.
 */
export const DAILY_REGISTER_WING_SERIAL: string[] = [...WINGS];

const ADMIN_GROUP = new Set<string>(["Admin", ...ADMIN_SUB_WINGS]);

export type RegisterWingBlock = {
  key: string;
  label: string;
  rows: LedgerRow[];
};

/** Collapse Admin + admin sub-wings onto one Admin page until serial says otherwise. */
export function registerWingGroup(wing: string): string {
  const key = wing.trim() || "—";
  if (ADMIN_GROUP.has(key)) return "Admin";
  return key;
}

/** Short name under Daily SI, e.g. Admin Wing / Int Wing. */
export function registerWingSignLabel(group: string): string {
  if (group === "Admin") return "Admin Wing";
  if (group.endsWith(" Wg")) return `${group.slice(0, -3)} Wing`;
  if (group === "—") return "Other";
  return group;
}

export function groupRegisterRowsByWing(
  rows: LedgerRow[],
  serial: string[] = DAILY_REGISTER_WING_SERIAL,
): RegisterWingBlock[] {
  const buckets = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const key = registerWingGroup(row.user.wing);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const rank = new Map(serial.map((wing, i) => [wing, i]));
  const keys = [...buckets.keys()].sort((a, b) => {
    const ai = rank.has(a) ? rank.get(a)! : 1000;
    const bi = rank.has(b) ? rank.get(b)! : 1000;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  return keys.map((key) => ({
    key,
    label: registerWingSignLabel(key),
    rows: buckets.get(key) ?? [],
  }));
}
