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
  asi: "এএসআই",
  aasi: "এএএসআই",
  ance: "এএনসিই",
  "nc(e)": "এনসি(ই)",
  nce: "এনসি(ই)",
  attached: "সংযুক্ত",
  soldier: "সৈনিক",
};

/** English wing / branch short (or full catalog name) → Bangla print. */
const WING_LABEL_BN: Record<string, string> = {
  "ops wg": "অপস উইং",
  "int wg": "ইন্ট উইং",
  "l & m wg": "এল এন্ড এম উইং",
  "air wg": "এয়ার উইং",
  "comm & mis wg": "যোগাযোগ উইং",
  "inv wg": "তদন্ত উইং",
  "trg wg": "ট্রেনিং উইং",
  rfts: "আরএফটিএস",
  "training school": "ট্রেনিং স্কুল",
  "r & d cell": "আর এন্ড ডি সেল",
  admin: "এ্যাডমিন",
  "admin (new)": "এ্যাডমিন (নতুন)",
  "admin (old)": "এ্যাডমিন (পুরাতন)",
  "dg office": "ডিজি দপ্তর",
  "adg (ops) office": "এডিজি (অপাঃ) দপ্তর",
  "adg (admin) office": "এডিজি (এ্যাডমিন) দপ্তর",
  "fin br": "অর্থ শাখা",
  "per br": "পার্সোনেল শাখা",
  "gen br": "জেনারেল শাখা",
  "sup br": "সরবরাহ শাখা",
  "hq br": "সদর দপ্তর শাখা",
  "med br": "চিকিৎসা শাখা",
  "rec br": "রেকর্ড শাখা",
  "proc br": "প্রকিউরমেন্ট",
  "budget br": "বাজেট শাখা",
  "dev br": "উন্নয়ন শাখা",
  "wksp br": "ওয়ার্কশপ",
  "mt br": "এমটি শাখা",
  "rat br": "রেশন শাখা",
  "proj br": "প্রকল্প শাখা",
  "security branch - iec cell": "নিরাপত্তা শাখা — আইইসি সেল",
  "headquarters branch": "সদর দপ্তর শাখা",
  "headquarters office": "সদর দপ্তর অফিস",
  "security branch": "নিরাপত্তা শাখা",
  "record branch": "রেকর্ড শাখা",
  "forces mess": "ফোর্সেস মেস",
  "field mess": "ফিল্ড মেস",
  "mt branch": "এমটি",
  "new / temporary attached": "নতুন / অস্থায়ী সংযুক্ত",
  সদর: "সদর",
  sadar: "সদর",
  hq: "সদর",
  সর্বমোট: "সর্বমোট",
  "grand total": "সর্বমোট",
};

function normalizeKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Bangla header for Settings authorized English label. Fallback = English. */
export function authorizedLabelBn(englishLabel: string): string {
  const key = normalizeKey(englishLabel);
  return AUTHORIZED_LABEL_BN[key] ?? englishLabel;
}

/** Bangla wing name for print. Fallback = English short. Match still English. */
export function wingLabelBn(englishWing: string): string {
  const key = normalizeKey(englishWing);
  return WING_LABEL_BN[key] ?? englishWing;
}

/** Settings list: `English (Bangla)` when Bangla known. */
export function wingSettingsLabel(englishWing: string): string {
  const bn = wingLabelBn(englishWing);
  if (bn.toLowerCase() === englishWing.trim().toLowerCase()) return englishWing;
  return `${englishWing} (${bn})`;
}
