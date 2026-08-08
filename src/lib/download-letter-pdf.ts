import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatMonthBill,
  formatMonthLong,
} from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import type { RationStaffSheet, RationTransferSheet } from "@/lib/reports";

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function writeHeader(doc: jsPDF, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.text(RATION_REPORT_META.govLine, pageW / 2, y, { align: "center" });
  y += 4;
  doc.text(RATION_REPORT_META.policeLine, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(RATION_REPORT_META.orgName, pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(RATION_REPORT_META.station, pageW / 2, y, { align: "center" });
  return y + 6;
}

function writeFrTransferLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);

  const monthBill = formatMonthBill(sheet.month);
  const dtLabel = formatMonthLong(sheet.reportDate.slice(0, 7));
  const memberBank = sheet.lines[0]?.user.bank_name || "—";
  const subject = RATION_REPORT_META.subjectFreshMoneyTransfer
    .replace("{monthLabel}", monthBill)
    .replace("{bank}", memberBank);

  doc.setFontSize(9);
  doc.text(`${RATION_REPORT_META.refPrefixPayAllce}/`, 10, y);
  doc.text(`DT: ${dtLabel}`, pageW - 10, y, { align: "right" });
  y += 6;

  doc.text("To,", 10, y);
  y += 4;
  doc.text("Manager", 10, y);
  y += 4;
  doc.text(sheet.sender.bank_name || sheet.sender.label, 10, y);
  y += 4;
  if (sheet.sender.branch) {
    doc.text(sheet.sender.branch, 10, y);
    y += 4;
  }
  doc.text("Dhaka", 10, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 10, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(10, y + 1, 10 + subW, y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 10, y);
  y += 5;
  doc.text(
    `We would request you to disburse the Fresh Money bill for the following employees for the month of ${monthBill}.`,
    10,
    y,
    { maxWidth: pageW - 20 },
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Ser",
        "Date",
        "Ref No",
        "Sender A/C",
        "Receiver routing",
        "Sender routing",
        "Type",
        "Customer name",
        "Customer A/C",
        "Amount",
        "Institute",
        "Entry Desc",
        "Payment Info",
        "Currency",
      ],
    ],
    body: sheet.lines.map((row) => [
      String(row.ser),
      formatDateLong(row.date),
      row.refNo,
      row.senderAccountNo,
      row.receiverRouting,
      row.senderRouting,
      row.type,
      row.customerAccountName,
      row.customerAccountNo,
      amt(row.amount),
      row.institute,
      row.entryDescription,
      row.paymentInfo,
      row.currency,
    ]),
    foot: [
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "G/Total:",
        amt(sheet.total),
        "",
        "",
        "",
        "",
      ],
    ],
    styles: { fontSize: 6, cellPadding: 1 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 8, right: 8 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  doc.setFontSize(9);
  doc.text(`Amount in word: ${amountToWordsEn(sheet.total)}`, 10, y);
  y += 5;
  doc.text(
    `Please, the above amount will be debited today from our current account No. ${sheet.sender.account_number || "—"} maintained in your branch.`,
    10,
    y,
    { maxWidth: pageW - 20 },
  );
  y += 10;
  doc.text("Thanking You", 10, y);
  y += 8;
  doc.text("Sincerely Yours,", 10, y);
}

export function downloadFrTransferPdf(
  sheet: RationTransferSheet | RationTransferSheet[],
  filename: string,
) {
  const sheets = Array.isArray(sheet) ? sheet : [sheet];
  if (sheets.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  sheets.forEach((s, i) => {
    if (i > 0) doc.addPage();
    writeFrTransferLetter(doc, s);
  });
  doc.save(filename);
}

export function downloadStaffPayoutPdf(
  sheet: RationStaffSheet,
  subject: string,
  filename: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 14);

  const monthLabel = formatMonthLong(sheet.month);
  doc.setFontSize(9);
  doc.text(`${RATION_REPORT_META.refPrefix}/${sheet.month}`, 14, y);
  doc.text(`DT: ${monthLabel}`, pageW - 14, y, { align: "right" });
  y += 6;

  doc.text("To: Manager", 14, y);
  y += 4;
  doc.text(sheet.sender.bank_name || sheet.sender.label, 14, y);
  y += 4;
  if (sheet.sender.branch) {
    doc.text(sheet.sender.branch, 14, y);
    y += 4;
  }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT : ${subject}`, 14, y);
  const subW = doc.getTextWidth(`SUBJECT : ${subject}`);
  doc.line(14, y + 1, 14 + Math.min(subW, pageW - 28), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 14, y);
  y += 5;
  doc.text(
    `We would request you to disburse of payment Fresh Money bills for the following employees for the month of ${monthLabel}.`,
    14,
    y,
    { maxWidth: pageW - 28 },
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Ser",
        "Pers No",
        "Rank",
        "Name",
        "Acct No",
        "Routing",
        "Bank",
        "Amount",
        "Remarks",
      ],
    ],
    body: sheet.lines.map((row) => [
      String(row.ser),
      row.user.rab_id,
      row.user.rank || "",
      row.user.name,
      row.user.account_number || "—",
      row.user.routing || "—",
      row.user.bank_name || "—",
      amt(row.amount),
      row.remarks || (row.missingBank ? "Missing bank details" : ""),
    ]),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  doc.save(filename);
}
