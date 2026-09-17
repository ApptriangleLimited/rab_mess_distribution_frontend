import { tagCellClass } from "@/lib/tag-colors";
import type { DailyAssignment, DailyTag, TrgTone } from "@/lib/types";

function normForce(force: string) {
  return force.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

/** Army / Navy / Air Force — TRG is always black (no money). */
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

/** Police TRG opens Sarda + Training. One of the two is required. */
export function needsTrgSardaPrompt(force: string): boolean {
  return isPoliceForce(force);
}

/** Police + Ansar open a Training prompt. BGB does not. */
export function needsTrgTrainingPrompt(force: string): boolean {
  return isPoliceForce(force) || isAnsarForce(force);
}

/** Daily RR / accept must ask before applying TRG. */
export function needsTrgPrompt(force: string): boolean {
  return needsTrgTrainingPrompt(force);
}

/** Police must pick Sarda or Training. Cancel applies no tag. */
export function trgChoiceRequired(
  force: string,
  trainingChecked = false,
  sardaChecked = false,
): boolean {
  return isPoliceForce(force) && !trainingChecked && !sardaChecked;
}

export function isTrgTag(tag?: DailyTag | "" | null): tag is "TRG" {
  return tag === "TRG";
}

/**
 * TRG red = money (ration / consume counts). TRG black = no money.
 * Army / Navy / Air Force → always black.
 * BGB → always red.
 * Police Sarda → black; Police Training → red. Unset stays black.
 * Ansar Training checked → red; otherwise black.
 */
export function resolveTrgTone(
  force: string,
  trainingChecked = false,
  sardaChecked = false,
): TrgTone {
  if (isBlackTrgForce(force)) return "black";
  if (isBgbForce(force)) return "red";
  if (isPoliceForce(force)) {
    if (sardaChecked) return "black";
    if (trainingChecked) return "red";
    return "black";
  }
  if (isAnsarForce(force)) return trainingChecked ? "red" : "black";
  return "red";
}

/** Stored tone, else force default (Army/Navy/Air Force → black). */
export function assignmentTrgTone(
  assignment: Pick<DailyAssignment, "tag" | "trg_tone">,
  force = "",
): TrgTone | undefined {
  if (!isTrgTag(assignment.tag)) return undefined;
  if (assignment.trg_tone === "black" || assignment.trg_tone === "red") {
    return assignment.trg_tone;
  }
  return resolveTrgTone(force);
}

/** Red TRG is payable / ration-eligible. Black TRG is not. */
export function isTrgRationPayable(
  assignment: Pick<DailyAssignment, "tag" | "trg_tone">,
  force = "",
): boolean {
  if (!isTrgTag(assignment.tag)) return true;
  return assignmentTrgTone(assignment, force) !== "black";
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
