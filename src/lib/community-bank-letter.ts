import { RATION_REPORT_META } from "@/lib/constants";
import { formatDateDisplay, formatMonthLong, todayISO } from "@/lib/date";
import { isCommunityBank, isFrFuelSender } from "@/lib/official-senders";
import type { RationStaffLine, RationTransferLine } from "@/lib/reports";
import { TRUST_BANK_FIXED, trustBankMoney } from "@/lib/trust-bank-letter";

export const COMMUNITY_BANK_COLUMNS = [
  "Ser",
  "Date",
  "Ref. No",
  "Sender A/C No",
  "Receiver A/C Routing Number",
  "Sender Branch Routing Number",
  "Type",
  "Customer Account Name",
  "Customer Account Number",
  "Amount",
  "Institute",
  "Entry Description",
  "Payment Info",
  "Currency",
] as const;

export function communityBankSubject(month: string) {
  return RATION_REPORT_META.subjectCommunityBeftn.replace(
    "{monthLabel}",
    formatMonthLong(month),
  );
}

export function communityBankBody(month: string) {
  return `We would request you to disburse the Fresh Money bill for the month of ${formatMonthLong(month)}.`;
}

export function communityBankCells(row: RationTransferLine): string[] {
  const memberAcct = row.user.account_number?.trim() || "";
  const memberRouting = row.user.routing?.trim() || "";
  return [
    String(row.ser),
    formatDateDisplay(todayISO()),
    TRUST_BANK_FIXED.refNo,
    row.senderAccountNo,
    memberRouting,
    row.senderRouting,
    TRUST_BANK_FIXED.type,
    row.user.name || "",
    memberAcct,
    trustBankMoney(row.amount),
    TRUST_BANK_FIXED.institute,
    TRUST_BANK_FIXED.entryDescription,
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
  return RATION_REPORT_META.subjectTagBill
    .replace("{monthLabel}", formatMonthLong(month))
    .replace("{bank}", "Community Bank");
}

export function communityFuelBody(month: string) {
  return `We would request you to disburse of payment Fresh Money bills for the following employees for the month of ${formatMonthLong(month)}.`;
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
