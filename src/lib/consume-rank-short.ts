/** Short rank labels for Consume sheets so the name column can stay wide. */
const SHORT_RANKS: Record<string, string> = {
  constable: "Const.",
  "assistant sub-inspector": "ASI",
  "sub-inspector": "SI",
  "deputy assistant director": "DAD",
  "lance naik": "L/Nk",
  "lance corporal": "L/Cpl",
  havildar: "Hav.",
  sepoy: "Sep.",
  sainik: "Snk.",
  seaman: "Smn.",
  corporal: "Cpl",
  sergeant: "Sgt",
  "leading seaman": "LS",
  "petty officer": "PO",
  "non-combatant employee": "NCE",
  civilian: "Civ.",
  cook: "Cook",
  naik: "Naik",
};

export function consumeRankShort(rank: string): string {
  const raw = rank.trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return SHORT_RANKS[raw.toLowerCase()] ?? raw;
}
