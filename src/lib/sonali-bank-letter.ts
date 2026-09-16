import { RATION_REPORT_META } from "@/lib/constants";
import { formatDateDisplay, formatMonthLong } from "@/lib/date";
import { isFrFuelSender, isSonaliBank } from "@/lib/official-senders";
import type { RationStaffLine, RationTransferLine } from "@/lib/reports";
import { trustBankMoney } from "@/lib/trust-bank-letter";

export const SONALI_BANK_COLUMNS = [
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

export function sonaliBankSubject(month: string) {
  return RATION_REPORT_META.subjectSonaliTransfer.replace(
    "{monthLabel}",
    formatMonthLong(month),
  );
}

export function sonaliBankBody(month: string) {
  return `We would request you to disburse the Fresh Money bill for the following employees for the month of ${formatMonthLong(month)}.`;
}

export function sonaliBankCells(row: RationTransferLine): string[] {
  return [
    String(row.ser),
    formatDateDisplay(row.date),
    row.refNo,
    row.senderAccountNo,
    row.receiverRouting,
    row.senderRouting,
    row.type,
    row.customerAccountName,
    row.customerAccountNo,
    trustBankMoney(row.amount),
    row.institute,
    row.entryDescription,
    row.paymentInfo,
    row.currency,
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
  return RATION_REPORT_META.subjectTagBill
    .replace("{monthLabel}", formatMonthLong(month))
    .replace("{bank}", "Sonali Bank");
}

export function sonaliFuelBody(month: string) {
  return `We would request you to disburse of payment Fresh Money bills for the following employees for the month of ${formatMonthLong(month)}.`;
}

export function sonaliFuelCells(row: RationStaffLine): string[] {
  return [
    String(row.ser),
    row.user.personal_id || row.user.rab_id || "—",
    row.user.rank || "",
    row.user.name,
    row.user.account_number || "—",
    row.user.routing || "—",
    row.user.bank_name || "—",
    trustBankMoney(row.amount),
    row.remarks || (row.missingBank ? "Missing bank details" : ""),
  ];
}
