import { formatDateDisplay, formatMonthBill, todayISO } from "@/lib/date";
import { isFrFuelSender, isTrustBank } from "@/lib/official-senders";
import type { RationTransferLine } from "@/lib/reports";

/** Trust Bank BEFTN generate-report — fixed cells. */
export const TRUST_BANK_FIXED = {
  refNo: "150120250000500001",
  type: "C",
  institute: "SRB HRQ",
  entryDescription: "Fresh money bill",
  paymentInfo: "Fresh money",
  currency: "BDT",
} as const;

export const TRUST_BANK_COLUMNS = [
  "Ser",
  "Date",
  "Ref. No",
  "Sender A/C No",
  "Sender Branch Routing Number",
  "Type",
  "Receiver Account Name",
  "Receiver bank A/C no",
  "Receiver A/C Routing Number",
  "Amount",
  "Institute",
  "Payment Info",
  "Currency",
] as const;

export function trustBankSubject(month: string) {
  return `We would request you to disburse the Fresh Money bill for the following employees for the month of ${formatMonthBill(month)}.`;
}

export function trustBankBody(month: string) {
  return `We would request you to disburse the Fresh Money bill for the following employees for the month of ${formatMonthBill(month)}.`;
}

export function trustBankMoney(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function trustBankCells(row: RationTransferLine): string[] {
  const memberAcct = row.user.account_number?.trim() || "";
  const memberRouting = row.user.routing?.trim() || "";
  return [
    String(row.ser),
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

