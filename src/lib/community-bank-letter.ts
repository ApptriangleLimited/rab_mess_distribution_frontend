import { formatDateDisplay, todayISO } from "@/lib/date";
import { isCommunityBank, isFrFuelSender } from "@/lib/official-senders";
import type { RationStaffLine, RationTransferLine } from "@/lib/reports";
import {
  TRUST_BANK_COLUMNS,
  TRUST_BANK_FIXED,
  freshMoneyBeftnBody,
  freshMoneyBeftnSubject,
  trustBankMoney,
} from "@/lib/trust-bank-letter";

export const COMMUNITY_BANK_COLUMNS = TRUST_BANK_COLUMNS;

export function communityBankSubject(month: string) {
  return freshMoneyBeftnSubject(month, "Community Bank");
}

export function communityBankBody(month: string) {
  return freshMoneyBeftnBody(month);
}

export function communityBankCells(row: RationTransferLine): string[] {
  const memberAcct = row.user.account_number?.trim() || "";
  const memberRouting = row.user.routing?.trim() || "";
  return [
    String(row.ser),
    row.user.rab_id || "—",
    row.user.personal_id || "—",
    formatDateDisplay(todayISO()),
    TRUST_BANK_FIXED.refNo,
    row.senderAccountNo,
    row.senderRouting,
    TRUST_BANK_FIXED.type,
    row.user.name || "",
    memberAcct,
    memberRouting,
    trustBankMoney(row.amount),
    TRUST_BANK_FIXED.institute,
    TRUST_BANK_FIXED.paymentInfo,
    TRUST_BANK_FIXED.currency,
  ];
}

export function isCommunityBankSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return isCommunityBank(
    sheet.memberBank ||
      sheet.lines[0]?.user.bank_name ||
      sheet.sender?.bank_name,
  );
}

/** FR Fuel + Community Bank uses the 7-col staff letter, not BEFTN. */
export function isCommunityFuelStaffSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return (
    isCommunityBankSheet(sheet) &&
    Boolean(sheet.sender && isFrFuelSender(sheet.sender))
  );
}

export const COMMUNITY_FUEL_COLUMNS = [
  "Ser",
  "Pers No",
  "Rank",
  "Name",
  "Acct No",
  "Amount",
  "Remarks",
] as const;

export function communityFuelSubject(month: string) {
  return freshMoneyBeftnSubject(month, "Community Bank");
}

export function communityFuelBody(month: string) {
  return freshMoneyBeftnBody(month);
}

export function communityFuelCells(row: RationStaffLine): string[] {
  return [
    String(row.ser),
    row.user.personal_id || row.user.rab_id || "—",
    row.user.rank || "",
    row.user.name,
    row.user.account_number?.trim() || "—",
    trustBankMoney(row.amount),
    "",
  ];
}
