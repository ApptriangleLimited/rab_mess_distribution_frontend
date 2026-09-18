import { rankLabelBn, WING_LABELS_BN } from "@/lib/constants";
import { getState } from "@/lib/store";

/**
 * Print labels: Bangla shown; English stays source for match / Settings.
 */

const AUTHORIZED_LABEL_BN: Record<string, string> = {
  officer: "অফিসার",
  naik: "নায়েক",
  nayek: "নায়েক",
  constable: "কনস্টেবল",
  co: "কো",
  cook: "পাচক",
  civil: "সিভিল",
  civill: "সিভিল",
  civilian: "সিভিল",
  dad: "ডিএডি",
  rt: "আরটি",
  si: "এসআই",
  asi: "এএসআই",
  aasi: "এএসআই",
  ance: "এনসি(ই)",
  "nc(e)": "এনসি(ই)",
  nce: "এনসি(ই)",
  attached: "সংযুক্ত",
  soldier: "সৈনিক",
};

/** English wing / branch short (or full catalog name) → Bangla print. */
const WING_LABEL_BN: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(WING_LABELS_BN).map(([short, bn]) => [
      short.toLowerCase(),
      bn,
    ]),
  ),
  rfts: "আরএফটিএস",
  "admin (new)": "এ্যাডমিন (নতুন)",
  "admin (old)": "এ্যাডমিন (পুরাতন)",
  "director (admin) office": "পরিচালক দপ্তর",
  "budget br": "বাজেট শাখা",
  "rat br": "রেশন শাখা",
  "security branch - iec cell": "নিরাপত্তা শাখা — আইইসি সেল",
  "headquarters branch": "সদর দপ্তর শাখা",
  "headquarters office": "সদর দপ্তর অফিস",
  "security branch": "নিরাপত্তা শাখা",
  "record branch": "রেকর্ড শাখা",
  "field mess": "ফিল্ড মেস",
  "mt branch": "এমটি শাখা",
  "new / temporary attached": "নতুন অস্থায়ী সংযুক্ত",
  সদর: "সদর",
  sadar: "সদর",
  hq: "সদর",
  সর্বমোট: "সর্বমোট",
  "grand total": "সর্বমোট",
};

function normalizeKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Old AASI Bangla → current ASI Bangla. */
export function manpowerRankLabelBn(label: string): string {
  const bn = label.trim();
  if (bn === "এএএসআই" || normalizeKey(bn) === "aasi") return "এএসআই";
  return bn;
}

/** Bangla header for Settings authorized English label. Fallback = English. */
export function authorizedLabelBn(
  englishLabel: string,
  overrides?: Record<string, string>,
): string {
  const key = normalizeKey(englishLabel);
  if (key === "officer") return "অফিসার";
  const fromSettings = form1RankLabelBn(englishLabel, overrides);
  if (fromSettings && fromSettings !== englishLabel) return fromSettings;
  return AUTHORIZED_LABEL_BN[key] ?? englishLabel;
}

/** Form 1 paper rank headers — hide সংযুক্ত (not on the official sheet). */
export function isForm1RankColumn(englishLabel: string): boolean {
  const key = normalizeKey(englishLabel);
  return key !== "attached" && key !== "attach";
}

/** Form 1 rank header — Settings SRB Bangla, same order as authorized ranks. */
export function form1RankLabelBn(
  englishLabel: string,
  overrides?: Record<string, string>,
): string {
  const key = normalizeKey(englishLabel);
  if (key === "officer") return "অফিসার";
  if (key === "aasi" || key === "এএএসআই") return "এএসআই";
  if (key === "co" || key === "con") {
    return manpowerRankLabelBn(
      rankLabelBn("Constable", overrides ?? getState().rank_labels_bn),
    );
  }
  return manpowerRankLabelBn(
    rankLabelBn(englishLabel, overrides ?? getState().rank_labels_bn),
  );
}

/** Bangla wing name for print. Fallback = English short. Match still English. */
export function wingLabelBn(
  englishWing: string,
  overrides?: Record<string, string>,
): string {
  const over = overrides?.[englishWing]?.trim();
  if (over) return over;
  const key = normalizeKey(englishWing);
  const match = Object.entries(overrides ?? {}).find(
    ([name]) => name.toLowerCase() === key,
  );
  if (match?.[1]?.trim()) return match[1].trim();
  return WING_LABEL_BN[key] ?? englishWing;
}

/** Settings list: `English (Bangla)` when Bangla known. */
export function wingSettingsLabel(englishWing: string): string {
  const bn = wingLabelBn(englishWing);
  if (bn.toLowerCase() === englishWing.trim().toLowerCase()) return englishWing;
  return `${englishWing} (${bn})`;
}
