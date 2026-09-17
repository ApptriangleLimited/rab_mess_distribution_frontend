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
  /** MED — hospital other than CMH/RBH/BGH */
  MED: "bg-rose-100 text-rose-950 dark:bg-rose-900/55 dark:text-rose-100",
  /** ML — Medical Leave (distinct from MED rose) */
  ML: "bg-red-200 text-red-950 dark:bg-red-900/50 dark:text-red-100",
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

/** Print / PDF fills that match cockpit tag tiles. */
const TAG_PRINT_FILL: Record<string, { bg: string; fg: string }> = {
  FR: { bg: "#ecfccb", fg: "#1a2e05" },
  MS: { bg: "#cde4dd", fg: "#067957" },
  CL: { bg: "#fef3c7", fg: "#451a03" },
  PL: { bg: "#e0e7ff", fg: "#1e1b4b" },
  WR: { bg: "#e7e5e4", fg: "#1c1917" },
  CD: { bg: "#ede9fe", fg: "#2e1065" },
  WIT: { bg: "#fae8ff", fg: "#4a044e" },
  MED: { bg: "#ffe4e6", fg: "#4c0519" },
  ML: { bg: "#fecaca", fg: "#450a0a" },
  TRG: { bg: "#cffafe", fg: "#083344" },
  FUEL: { bg: "#fef9c3", fg: "#422006" },
  MOL: { bg: "#ccfbf1", fg: "#042f2e" },
  CMH: { bg: "#dbeafe", fg: "#172554" },
  RBH: { bg: "#e0f2fe", fg: "#0c4a6e" },
  BGH: { bg: "#ffedd5", fg: "#7c2d12" },
  AWL: { bg: "#fce7f3", fg: "#831843" },
  OSL: { bg: "#f3e8ff", fg: "#3b0764" },
  RL: { bg: "#d1fae5", fg: "#064e3b" },
  JL: { bg: "#fee2e2", fg: "#7f1d1d" },
  PE: { bg: "#e2e8f0", fg: "#0f172a" },
  LNK: { bg: "#dcfce7", fg: "#14532d" },
  MFR: { bg: "#fef08a", fg: "#422006" },
};

const CUSTOM_PRINT_FILL = [
  { bg: "#ccfbf1", fg: "#042f2e" },
  { bg: "#dbeafe", fg: "#172554" },
  { bg: "#e0f2fe", fg: "#0c4a6e" },
  { bg: "#ffedd5", fg: "#7c2d12" },
  { bg: "#d1fae5", fg: "#064e3b" },
  { bg: "#fce7f3", fg: "#831843" },
  { bg: "#fee2e2", fg: "#7f1d1d" },
  { bg: "#f3e8ff", fg: "#3b0764" },
] as const;

export function tagPrintFill(
  tag: string,
  tone?: "black" | "red" | null,
): { bg: string; fg: string } {
  const key = tag.trim().toUpperCase();
  if (!key) return { bg: "#ffffff", fg: "#111111" };
  if (key === "TRG" && tone === "black") return { bg: "#0a0a0a", fg: "#ffffff" };
  if (key === "TRG" && tone === "red") return { bg: "#dc2626", fg: "#ffffff" };
  return TAG_PRINT_FILL[key] ?? CUSTOM_PRINT_FILL[hashTag(key) % CUSTOM_PRINT_FILL.length]!;
}

export function tagPrintClass(
  tag: string,
  tone?: "black" | "red" | null,
): string {
  const key = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!key) return "";
  if (key === "TRG" && tone === "black") return "register-tag register-tag-TRG-black";
  if (key === "TRG" && tone === "red") return "register-tag register-tag-TRG-red";
  return `register-tag register-tag-${key}`;
}

export function tagPrintCss(): string {
  const rules = Object.entries(TAG_PRINT_FILL).map(([key, fill]) => {
    return `.month-register-print td.register-tag-${key},.register-sheet td.register-tag-${key},.month-ledger-print td.register-tag-${key}{background:${fill.bg} !important;color:${fill.fg} !important;}`;
  });
  rules.push(
    `.month-register-print td.register-tag-TRG-black,.register-sheet td.register-tag-TRG-black,.month-ledger-print td.register-tag-TRG-black{background:#0a0a0a !important;color:#ffffff !important;}`,
    `.month-register-print td.register-tag-TRG-red,.register-sheet td.register-tag-TRG-red,.month-ledger-print td.register-tag-TRG-red{background:#dc2626 !important;color:#ffffff !important;}`,
  );
  return rules.join("");
}

export { TAG_CELL };
