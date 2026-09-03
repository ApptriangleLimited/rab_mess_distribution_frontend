import { tagCellClass } from "@/lib/tag-colors";
import type { DailyTag, TrgTone } from "@/lib/types";

function normForce(force: string) {
  return force.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

/** Army / Navy / Air Force — TRG days are black. */
export function isBlackTrgForce(force: string): boolean {
  const key = normForce(force);
  return key === "army" || key === "navy" || key === "air force";
}

export function isPoliceForce(force: string): boolean {
  return normForce(force) === "police";
}

/** Police TRG needs the Sarda checkbox before we know black vs red. */
export function needsTrgSardaPrompt(force: string): boolean {
  return isPoliceForce(force);
}

export function isTrgTag(tag?: DailyTag | "" | null): tag is "TRG" {
  return tag === "TRG";
}

/**
 * Force check at write time.
 * Police + Sarda checked → black; Police unchecked / other forces → red.
 */
export function resolveTrgTone(force: string, sardaChecked = false): TrgTone {
  if (isBlackTrgForce(force)) return "black";
  if (isPoliceForce(force) && sardaChecked) return "black";
  return "red";
}

/** Black TRG uses white text so the label stays readable. */
export function trgCellClass(tone: TrgTone): string {
  if (tone === "black") {
    return "bg-neutral-950 text-white dark:bg-black dark:text-white";
  }
  return "bg-red-600 text-white dark:bg-red-700 dark:text-white";
}

export function tagDisplayClass(
  tag: string,
  tone?: TrgTone | null,
): string {
  if (tag.trim().toUpperCase() === "TRG" && tone) {
    return trgCellClass(tone);
  }
  return tagCellClass(tag);
}
