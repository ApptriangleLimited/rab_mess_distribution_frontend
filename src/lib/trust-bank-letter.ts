import { RATION_REPORT_META } from "@/lib/constants";
import { formatDateDisplay, formatMonthLong } from "@/lib/date";
import { isFrFuelSender, isTrustBank } from "@/lib/official-senders";
import type { RationTransferLine } from "@/lib/reports";

export const TRUST_BANK_COLUMNS = [
  "Ser",
  "Date",
  "Ref. No",
  "Sender A/C No",
  "Receiver A/C No",
  "Routing Number",
  "Sender Routing Number",
  "Type",
  "Customer Account Name",
  "Customer Account Number",
  "Amount",
  "Institute",
  "Entry Description",
  "Payment Information",
  "Currency",
] as const;

export function trustBankSubject(month: string) {
  return RATION_REPORT_META.subjectTrustBeftn.replace(
    "{monthLabel}",
    formatMonthLong(month),
  );
}

export function trustBankBody(month: string) {
  return `We would request you to disburse the Fresh Money bill for the month of ${formatMonthLong(month)}.`;
}

export function trustBankMoney(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function trustBankCells(row: RationTransferLine): string[] {
  return [
    String(row.ser),
    formatDateDisplay(row.date),
    row.refNo,
    row.senderAccountNo,
    row.customerAccountNo,
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

export function isTrustBankSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return isTrustBank(
    sheet.memberBank ||
      sheet.lines[0]?.user.bank_name ||
      sheet.sender?.bank_name,
  );
}

/** FR Fuel + Trust Bank uses the staff letter, not the BEFTN table. */
export function isTrustFuelStaffSheet(sheet: {
  memberBank?: string;
  sender?: { bank_name?: string; mapped_tags?: string[]; label?: string };
  lines: { user: { bank_name: string } }[];
}) {
  return (
    isTrustBankSheet(sheet) &&
    Boolean(sheet.sender && isFrFuelSender(sheet.sender))
  );
}

