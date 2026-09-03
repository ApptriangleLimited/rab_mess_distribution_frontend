/**
 * Unique visual identity per daily tag (tiles, register cells, pickers).
 * Built-ins are fixed; unknown / custom codes get a stable hashed palette slot.
 */

const TAG_CELL: Record<string, string> = {
  /** Fresh Money — lime (not indigo PL, not primary MS) */
  FR: "bg-lime-100 text-lime-950 dark:bg-lime-900/55 dark:text-lime-100",
  /** Mess — brand primary */
  MS: "bg-primary/20 text-primary dark:bg-primary/35 dark:text-emerald-50",
  /** Casual Leave — amber (warm) */
  CL: "bg-amber-100 text-amber-950 dark:bg-amber-900/55 dark:text-amber-100",
  /** Privilege Leave — indigo */
  PL: "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/55 dark:text-indigo-100",
  /** Weekend Rest — stone */
  WR: "bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100",
  /** Cash Diet — violet */
  CD: "bg-violet-100 text-violet-950 dark:bg-violet-900/55 dark:text-violet-100",
  /** Without Information — fuchsia (far from CL amber + MED rose) */
  WIT: "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-900/55 dark:text-fuchsia-100",
  /** Medical — rose */
  MED: "bg-rose-100 text-rose-950 dark:bg-rose-900/55 dark:text-rose-100",
  /** Training — cyan */
  TRG: "bg-cyan-100 text-cyan-950 dark:bg-cyan-900/55 dark:text-cyan-100",
  /** Fuel rate-only — yellow */
  FUEL: "bg-yellow-100 text-yellow-950 dark:bg-yellow-900/55 dark:text-yellow-100",
  MOL: "bg-teal-100 text-teal-950 dark:bg-teal-900/55 dark:text-teal-100",
  CMH: "bg-blue-100 text-blue-950 dark:bg-blue-900/55 dark:text-blue-100",
  RBH: "bg-sky-100 text-sky-950 dark:bg-sky-900/55 dark:text-sky-100",
  BGH: "bg-orange-100 text-orange-950 dark:bg-orange-900/55 dark:text-orange-100",
  AWL: "bg-pink-100 text-pink-950 dark:bg-pink-900/55 dark:text-pink-100",
  OSL: "bg-purple-100 text-purple-950 dark:bg-purple-900/55 dark:text-purple-100",
  /** Recreation Leave — emerald */
  RL: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/55 dark:text-emerald-100",
  /** Joining Leave — red */
  JL: "bg-red-100 text-red-950 dark:bg-red-900/55 dark:text-red-100",
  /** Promotion Exam — slate */
  PE: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  /** Link — green */
  LNK: "bg-green-100 text-green-950 dark:bg-green-900/55 dark:text-green-100",
  /** Locked standing tag — yellow */
  MFR: "bg-yellow-200 text-yellow-950 dark:bg-yellow-800/60 dark:text-yellow-50",
};

/** Extra slots for custom tags — no overlap with built-in hues above. */
const CUSTOM_TAG_PALETTE = [
  "bg-teal-100 text-teal-950 dark:bg-teal-900/55 dark:text-teal-100",
  "bg-blue-100 text-blue-950 dark:bg-blue-900/55 dark:text-blue-100",
  "bg-sky-100 text-sky-950 dark:bg-sky-900/55 dark:text-sky-100",
  "bg-orange-100 text-orange-950 dark:bg-orange-900/55 dark:text-orange-100",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/55 dark:text-emerald-100",
  "bg-pink-100 text-pink-950 dark:bg-pink-900/55 dark:text-pink-100",
  "bg-red-100 text-red-950 dark:bg-red-900/55 dark:text-red-100",
  "bg-purple-100 text-purple-950 dark:bg-purple-900/55 dark:text-purple-100",
] as const;

function hashTag(tag: string): number {
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function tagCellClass(tag: string): string {
  const key = tag.trim().toUpperCase();
  if (!key) {
    return "bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";
  }
  const known = TAG_CELL[key];
  if (known) return known;
  return CUSTOM_TAG_PALETTE[hashTag(key) % CUSTOM_TAG_PALETTE.length];
}

export { TAG_CELL };
