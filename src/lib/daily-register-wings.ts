import { WINGS, wingOfficialSerial } from "@/lib/constants";
import type { LedgerRow } from "@/lib/reports";
import { getState } from "@/lib/store";
import { formatMemberWing, listWingChildrenFrom } from "@/lib/store/org-options";
import { compareUsersByRankSerial } from "@/lib/store/users";

/**
 * Fallback print order when Settings has no stored serials yet.
 */
export const DAILY_REGISTER_WING_SERIAL: string[] = [...WINGS];

export type RegisterWingBlock = {
  key: string;
  label: string;
  rows: LedgerRow[];
};

/** Collapse sub-wings / branches onto their main wing for print. */
export function registerWingGroup(wing: string): string {
  return formatMemberWing(wing) || wing.trim() || "—";
}

/** Short name under Daily SI, e.g. Admin Wing / Int Wing. */
export function registerWingSignLabel(group: string): string {
  if (group === "Admin") return "Admin Wing";
  if (group.endsWith(" Wg")) return `${group.slice(0, -3)} Wing`;
  if (group === "—") return "Other";
  return group;
}

/** Root wings sorted by Settings serial — used for print and PDF. */
export function wingPrintOrderFrom(
  wings: string[],
  wingParent: Record<string, string>,
  serials: Record<string, number>,
): string[] {
  return [...listWingChildrenFrom(wings, wingParent, null)].sort((a, b) => {
    const as = wingOfficialSerial(a, serials) ?? 10_000;
    const bs = wingOfficialSerial(b, serials) ?? 10_000;
    if (as !== bs) return as - bs;
    return a.localeCompare(b);
  });
}

export function wingPrintOrder(): string[] {
  const { wings, wing_parent, wing_serials } = getState();
  const ordered = wingPrintOrderFrom(
    wings,
    wing_parent,
    wing_serials ?? {},
  );
  return ordered.length ? ordered : [...DAILY_REGISTER_WING_SERIAL];
}

export function groupRegisterRowsByWing(
  rows: LedgerRow[],
  serial: string[] = wingPrintOrder(),
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
    rows: [...(buckets.get(key) ?? [])].sort((a, b) =>
      compareUsersByRankSerial(a.user, b.user),
    ),
  }));
}
