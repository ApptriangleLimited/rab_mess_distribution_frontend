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

export function isAnsarForce(force: string): boolean {
  return normForce(force) === "ansar";
}

export function isBgbForce(force: string): boolean {
  return normForce(force) === "bgb";
}

/** Police still gets the Sarda checkbox on TRG. */
export function needsTrgSardaPrompt(force: string): boolean {
  return isPoliceForce(force);
}

/** Police / Ansar / BGB pick Training — checked = black TRG, else red. */
export function needsTrgTrainingPrompt(force: string): boolean {
  return isPoliceForce(force) || isAnsarForce(force) || isBgbForce(force);
}

export function isTrgTag(tag?: DailyTag | "" | null): tag is "TRG" {
  return tag === "TRG";
}

/**
 * Force check at write time.
 * Army / Navy / Air Force → black.
 * Police / Ansar / BGB + Training checked → black; otherwise red.
 */
export function resolveTrgTone(force: string, trainingChecked = false): TrgTone {
  if (isBlackTrgForce(force)) return "black";
  if (needsTrgTrainingPrompt(force) && trainingChecked) return "black";
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
