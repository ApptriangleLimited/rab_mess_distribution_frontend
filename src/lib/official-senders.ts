import { FUEL_RATE_TAG, MEMBER_BANKS } from "@/lib/constants";
import type { DailyTag, SenderAccount } from "@/lib/types";

/** Tags whose allowance goes to Fresh Money (Trust / Community / Sonali). */
export const FRESH_MONEY_TAGS: DailyTag[] = [
  "FR",
  "CL",
  "CD",
  "TRG",
  "MED",
  "RL",
];

/** Generate-report tag list: Fresh Money tags + FR Fuel. */
export const REPORT_PAYOUT_TAGS: DailyTag[] = [
  ...FRESH_MONEY_TAGS,
  FUEL_RATE_TAG,
];

const LEGACY_SENDER_LABELS = new Set([
  "fr pool",
  "mess fund",
  "ops contingency",
  "medical pool",
  "leave / admin",
]);

function prettyBank(bank: string) {
  if (/trust/i.test(bank)) return "Trust Bank";
  if (/community/i.test(bank)) return "Community Bank";
  if (/sonali/i.test(bank)) return "Sonali Bank";
  return bank;
}

function bankSlug(bank: string) {
  return bank.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Official generate-report bank accounts — Fresh Money + FR Fuel per member bank. */
export function officialSenderAccounts(): SenderAccount[] {
  const fresh: SenderAccount[] = MEMBER_BANKS.map((bank, i) => ({
    id: `s_fresh_${bankSlug(bank)}`,
    label: `Fresh Money - ${prettyBank(bank)}`,
    bank_name: bank,
    account_name: "Fresh Money",
    account_number: `9002001${String(i + 1).padStart(3, "0")}`,
    routing: `10000000${i + 1}`,
    branch: "Head Office",
    branch_location: "Dhaka",
    mapped_tags: [...FRESH_MONEY_TAGS],
    active: true,
  }));
  const fuel: SenderAccount[] = MEMBER_BANKS.map((bank, i) => ({
    id: `s_fuel_${bankSlug(bank)}`,
    label: `FR Fuel - ${prettyBank(bank)}`,
    bank_name: bank,
    account_name: "FR Fuel",
    account_number: `9002002${String(i + 1).padStart(3, "0")}`,
    routing: `20000000${i + 1}`,
    branch: "Head Office",
    branch_location: "Dhaka",
    mapped_tags: [FUEL_RATE_TAG as DailyTag],
    active: true,
  }));
  return [...fresh, ...fuel];
}

export function isLegacyDemoSenders(senders: SenderAccount[]) {
  if (!senders.length) return true;
  const labels = senders.map((s) => s.label.trim().toLowerCase());
  const hasLegacy = labels.some((l) => LEGACY_SENDER_LABELS.has(l));
  const hasOfficial = labels.some(
    (l) => l.startsWith("fresh money") || l.startsWith("fr fuel"),
  );
  return hasLegacy && !hasOfficial;
}

export function isFrFuelTag(tag: string) {
  return tag.toLowerCase() === FUEL_RATE_TAG.toLowerCase();
}

export function isFreshMoneyTag(tag: string) {
  return FRESH_MONEY_TAGS.some((t) => t.toLowerCase() === tag.toLowerCase());
}

export function isFrFuelSender(
  sender: Pick<SenderAccount, "mapped_tags" | "label">,
) {
  return (
    sender.mapped_tags.some((t) => isFrFuelTag(t)) ||
    sender.label.trim().toLowerCase().startsWith("fr fuel")
  );
}

export function sameBankName(a: string, b: string) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return Boolean(norm(a)) && norm(a) === norm(b);
}
