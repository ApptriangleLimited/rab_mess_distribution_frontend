import { formatDateDisplay, todayISO } from "@/lib/date";
import { isFrFuelSender, isSonaliBank } from "@/lib/official-senders";
import type { RationStaffLine, RationTransferLine } from "@/lib/reports";
import {
  TRUST_BANK_COLUMNS,
  TRUST_BANK_FIXED,
  freshMoneyBeftnBody,
  freshMoneyBeftnSubject,
  trustBankMoney,
} from "@/lib/trust-bank-letter";

export const SONALI_BANK_COLUMNS = TRUST_BANK_COLUMNS;

export function sonaliBankSubject(month: string) {
  return freshMoneyBeftnSubject(month, "Sonali Bank");
}

export function sonaliBankBody(month: string) {
  return freshMoneyBeftnBody(month);
}

export function sonaliBankCells(row: RationTransferLine): string[] {
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

export function isSonaliBankSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return isSonaliBank(
    sheet.memberBank ||
      sheet.lines[0]?.user.bank_name ||
      sheet.sender?.bank_name,
  );
}

/** FR Fuel + Sonali Bank uses the staff letter, not BEFTN. */
export function isSonaliFuelStaffSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return (
    isSonaliBankSheet(sheet) &&
    Boolean(sheet.sender && isFrFuelSender(sheet.sender))
  );
}

export const SONALI_FUEL_COLUMNS = [
  "Ser",
  "Pers No",
  "Rank",
  "Name",
  "Acct No",
  "Routing No",
  "Bank Name",
  "Amount",
  "Remarks",
] as const;

export function sonaliFuelSubject(month: string) {
  return freshMoneyBeftnSubject(month, "Sonali Bank");
}

export function sonaliFuelBody(month: string) {
  return freshMoneyBeftnBody(month);
}

export function sonaliFuelCells(row: RationStaffLine): string[] {
  return [
    String(row.ser),
    row.user.personal_id || row.user.rab_id || "—",
    row.user.rank || "",
    row.user.name,
    row.user.account_number?.trim() || "—",
    row.user.routing || "—",
    row.user.bank_name || "—",
    trustBankMoney(row.amount),
    "",
  ];
}
