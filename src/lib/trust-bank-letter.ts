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
  "SRB ID",
  "Personal No",
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

const BEFTN_ROWS_PER_PAGE = 25;

export function chunkBeftnPages<T>(lines: readonly T[]): T[][] {
  if (lines.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let i = 0; i < lines.length; i += BEFTN_ROWS_PER_PAGE) {
    pages.push([...lines.slice(i, i + BEFTN_ROWS_PER_PAGE)]);
  }
  return pages;
}

export function beftnPageLabel(page: number) {
  return `page no : ${page}`;
}

export function beftnHeadAlign(_col: string): "center" {
  return "center";
}

export function beftnBodyAlign(col: string): "left" | "center" | "right" {
  if (/receiver account name/i.test(col)) return "left";
  if (/^amount$/i.test(col)) return "right";
  return "center";
}

export function beftnAlignClass(col: string, kind: "head" | "body") {
  const align = kind === "head" ? beftnHeadAlign(col) : beftnBodyAlign(col);
  if (align === "right") return "text-right tabular-nums";
  if (align === "center") return "text-center";
  return "text-left";
}

export function beftnWidthClass(col: string) {
  if (/^ser$/i.test(col)) return "beftn-ser";
  if (/^ref\.?\s*no$/i.test(col)) return "beftn-ref";
  if (/^type$/i.test(col)) return "beftn-type";
  if (/receiver account name/i.test(col)) return "beftn-acct";
  return "";
}

export function freshMoneyBeftnSubject(month: string, bank: string) {
  return `Disbursement of Fresh Money Bill ${formatMonthBill(month)} BEFTN to ${bank}.`;
}

export function freshMoneyBeftnBody(month: string) {
  return `We would request you to disburse the Fresh Money bill for the month of ${formatMonthBill(month)}.`;
}

export function trustBankSubject(month: string) {
  return freshMoneyBeftnSubject(month, "Trust Bank");
}

export function trustBankBody(month: string) {
  return freshMoneyBeftnBody(month);
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

