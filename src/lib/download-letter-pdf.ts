import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatDateOrdinal,
  formatMonthLong,
} from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import {
  staffSheetToTransferSheet,
  type RationStaffSheet,
  type RationTransferSheet,
} from "@/lib/reports";
import {
  COMMUNITY_BANK_COLUMNS,
  communityBankBody,
  communityBankCells,
  communityBankSubject,
  COMMUNITY_FUEL_COLUMNS,
  communityFuelBody,
  communityFuelCells,
  communityFuelSubject,
  isCommunityBankSheet,
  isCommunityFuelStaffSheet,
} from "@/lib/community-bank-letter";
import {
  SONALI_BANK_COLUMNS,
  SONALI_FUEL_COLUMNS,
  isSonaliBankSheet,
  isSonaliFuelStaffSheet,
  sonaliBankBody,
  sonaliFuelBody,
  sonaliFuelCells,
  sonaliFuelSubject,
  sonaliBankCells,
  sonaliBankSubject,
} from "@/lib/sonali-bank-letter";
import {
  TRUST_BANK_COLUMNS,
  beftnBodyAlign,
  beftnHeadAlign,
  isTrustBankSheet,
  isTrustFuelStaffSheet,
  trustBankBody,
  trustBankCells,
  freshMoneyBeftnBody,
  freshMoneyBeftnSubject,
  trustBankMoney,
  trustBankSubject,
} from "@/lib/trust-bank-letter";

function transferColumnStyles(headers: readonly string[]) {
  return Object.fromEntries(
    headers.map((col, i) => [
      i,
      {
        halign: beftnBodyAlign(col),
        valign: "middle" as const,
        ...(/^ser$/i.test(col) ? { cellWidth: 9 } : {}),
        ...(/^srb id$/i.test(col) ? { cellWidth: 16 } : {}),
        ...(/^personal no$/i.test(col) ? { cellWidth: 16 } : {}),
        ...(/^ref\.?\s*no$/i.test(col)
          ? { cellWidth: 34, overflow: "visible" as const }
          : {}),
      },
    ]),
  );
}

function beftnTotalFoot(headers: readonly string[], total: number) {
  const idx = headers.findIndex((col) => /^amount$/i.test(col));
  const amountAt = idx >= 0 ? idx : headers.length - 1;
  const row = Array.from({ length: headers.length }, () => "");
  if (amountAt > 0) row[amountAt - 1] = "G/Total:";
  row[amountAt] = trustBankMoney(total);
  return [row];
}

function beftnParseAlign(headers: readonly string[]) {
  return (data: { section: string; column: { index: number }; cell: { styles: { halign?: string } } }) => {
    const col = headers[data.column.index] ?? "";
    data.cell.styles.halign =
      data.section === "head" ? beftnHeadAlign(col) : beftnBodyAlign(col);
  };
}

const INK: [number, number, number] = [0, 0, 0];
const PAPER: [number, number, number] = [255, 255, 255];

function reportTableChrome() {
  return {
    textColor: INK,
    lineColor: INK,
    lineWidth: 0.35,
  };
}

function reportHeadChrome() {
  return {
    fillColor: PAPER,
    textColor: INK,
    fontStyle: "bold" as const,
    lineColor: INK,
    lineWidth: 0.45,
  };
}

function reportFootChrome() {
  return {
    fillColor: PAPER,
    textColor: INK,
    fontStyle: "bold" as const,
    lineColor: INK,
    lineWidth: 0.35,
  };
}

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function writeHeader(doc: jsPDF, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(RATION_REPORT_META.govLine, pageW / 2, y, { align: "center" });
  y += 5;
  doc.text(RATION_REPORT_META.policeLine, pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(RATION_REPORT_META.orgName, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(RATION_REPORT_META.station, pageW / 2, y, { align: "center" });
  return y + 8;
}

function writeTrustBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(`Dt. ${formatDateOrdinal(sheet.reportDate)}`, pageW - 10, y, {
    align: "right",
  });
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
  doc.text(city, 10, y);
  y += 6;

  const subject = trustBankSubject(sheet.month);
  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 10, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(10, y + 1, 10 + Math.min(subW, pageW - 20), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 10, y);
  y += 5;
  doc.text(trustBankBody(sheet.month), 10, y, { maxWidth: pageW - 20 });
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [TRUST_BANK_COLUMNS as unknown as string[]],
    body: sheet.lines.map((row) => trustBankCells(row)),
    foot: beftnTotalFoot(TRUST_BANK_COLUMNS, sheet.total),
    styles: {
      fontSize: 8,
      cellPadding: 1.1,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
      ...reportTableChrome(),
    },
    headStyles: {
      ...reportHeadChrome(),
      overflow: "linebreak",
      halign: "center",
    },
    footStyles: reportFootChrome(),
    columnStyles: transferColumnStyles(TRUST_BANK_COLUMNS),
    didParseCell: beftnParseAlign(TRUST_BANK_COLUMNS),
    showHead: "everyPage",
    theme: "grid",
    margin: { left: 8, right: 8, bottom: 10 },
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

function writeCommunityBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(`Dt. ${formatDateOrdinal(sheet.reportDate)}`, pageW - 10, y, {
    align: "right",
  });
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
  doc.text(city, 10, y);
  y += 6;

  const subject = communityBankSubject(sheet.month);
  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 10, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(10, y + 1, 10 + Math.min(subW, pageW - 20), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 10, y);
  y += 5;
  doc.text(communityBankBody(sheet.month), 10, y, { maxWidth: pageW - 20 });
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [COMMUNITY_BANK_COLUMNS as unknown as string[]],
    body: sheet.lines.map((row) => communityBankCells(row)),
    foot: beftnTotalFoot(COMMUNITY_BANK_COLUMNS, sheet.total),
    styles: {
      fontSize: 8,
      cellPadding: 1.1,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
      ...reportTableChrome(),
    },
    headStyles: {
      ...reportHeadChrome(),
      overflow: "linebreak",
      halign: "center",
    },
    footStyles: reportFootChrome(),
    columnStyles: transferColumnStyles(COMMUNITY_BANK_COLUMNS),
    didParseCell: beftnParseAlign(COMMUNITY_BANK_COLUMNS),
    showHead: "everyPage",
    theme: "grid",
    margin: { left: 8, right: 8, bottom: 10 },
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

function writeSonaliBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(`Dt. ${formatDateOrdinal(sheet.reportDate)}`, pageW - 10, y, {
    align: "right",
  });
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
  doc.text(city, 10, y);
  y += 6;

  const subject = sonaliBankSubject(sheet.month);
  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 10, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(10, y + 1, 10 + Math.min(subW, pageW - 20), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 10, y);
  y += 5;
  doc.text(sonaliBankBody(sheet.month), 10, y, { maxWidth: pageW - 20 });
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [SONALI_BANK_COLUMNS as unknown as string[]],
    body: sheet.lines.map((row) => sonaliBankCells(row)),
    foot: beftnTotalFoot(SONALI_BANK_COLUMNS, sheet.total),
    styles: {
      fontSize: 8,
      cellPadding: 1.1,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
      ...reportTableChrome(),
    },
    headStyles: {
      ...reportHeadChrome(),
      overflow: "linebreak",
      halign: "center",
    },
    footStyles: reportFootChrome(),
    columnStyles: transferColumnStyles(SONALI_BANK_COLUMNS),
    didParseCell: beftnParseAlign(SONALI_BANK_COLUMNS),
    showHead: "everyPage",
    theme: "grid",
    margin: { left: 8, right: 8, bottom: 10 },
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

function writeTransferByBank(doc: jsPDF, sheet: RationTransferSheet) {
  if (isTrustBankSheet(sheet)) {
    writeTrustBankLetter(doc, sheet);
    return;
  }
  if (isCommunityBankSheet(sheet)) {
    writeCommunityBankLetter(doc, sheet);
    return;
  }
  if (isSonaliBankSheet(sheet)) {
    writeSonaliBankLetter(doc, sheet);
    return;
  }
  writeFrTransferLetter(doc, sheet);
}

function writeFrTransferLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);

  const dtLabel = formatMonthLong(sheet.reportDate.slice(0, 7));
  const memberBank = sheet.lines[0]?.user.bank_name || "—";
  const subject = freshMoneyBeftnSubject(sheet.month, memberBank);

  doc.setFontSize(9);
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
  doc.text(freshMoneyBeftnBody(sheet.month), 10, y, { maxWidth: pageW - 20 });
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
      row.user.account_number?.trim() || row.customerAccountNo || "—",
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
    styles: {
      fontSize: 6.5,
      cellPadding: 1.1,
      overflow: "linebreak",
      halign: "left",
      valign: "middle",
      ...reportTableChrome(),
    },
    headStyles: {
      ...reportHeadChrome(),
      overflow: "linebreak",
      halign: "left",
    },
    footStyles: reportFootChrome(),
    columnStyles: {
      9: { halign: "right" },
    },
    showHead: "firstPage",
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

function bankSlug(name: string) {
  const slug = name
    .trim()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function filenameForBank(filename: string, bank: string) {
  const slug = bankSlug(bank);
  if (filename.toLowerCase().endsWith(".pdf")) {
    return `${filename.slice(0, -4)}-${slug}.pdf`;
  }
  return `${filename}-${slug}.pdf`;
}

function sheetBankName(
  sheet: { memberBank?: string; lines: { user: { bank_name: string } }[] },
) {
  return sheet.memberBank || sheet.lines[0]?.user.bank_name || "unknown";
}

function stampPageNumbers(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`page no : ${i}`, pageW - 8, pageH - 4, { align: "right" });
  }
}

function savePdfsStaggered(jobs: { write: (doc: jsPDF) => void; filename: string; landscape?: boolean }[]) {
  jobs.forEach((job, i) => {
    const run = () => {
      const doc = new jsPDF({
        orientation: job.landscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      job.write(doc);
      stampPageNumbers(doc);
      doc.save(job.filename);
    };
    if (i === 0) run();
    else setTimeout(run, i * 400);
  });
}

export function downloadFrTransferPdf(
  sheet: RationTransferSheet | RationTransferSheet[],
  filename: string,
) {
  const sheets = Array.isArray(sheet) ? sheet : [sheet];
  if (sheets.length === 0) return;

  savePdfsStaggered(
    sheets.map((s) => ({
      landscape: true,
      filename: filenameForBank(filename, sheetBankName(s)),
      write: (doc) => writeTransferByBank(doc, s),
    })),
  );
}

function writeCommunityFuelLetter(doc: jsPDF, sheet: RationStaffSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 14);
  const monthLabel = formatMonthLong(sheet.month);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(`DT: ${monthLabel}`, pageW - 14, y, { align: "right" });
  y += 6;

  doc.text("To,", 14, y);
  y += 4;
  doc.text("Manager", 14, y);
  y += 4;
  doc.text(sheet.sender.bank_name || sheet.sender.label, 14, y);
  y += 4;
  if (sheet.sender.branch) {
    doc.text(sheet.sender.branch, 14, y);
    y += 4;
  }
  doc.text(city, 14, y);
  y += 6;

  const subject = communityFuelSubject(sheet.month);
  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 14, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(14, y + 1, 14 + Math.min(subW, pageW - 28), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 14, y);
  y += 5;
  doc.text(communityFuelBody(sheet.month), 14, y, { maxWidth: pageW - 28 });
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [COMMUNITY_FUEL_COLUMNS as unknown as string[]],
    body: sheet.lines.map((row) => communityFuelCells(row)),
    styles: { fontSize: 7, cellPadding: 1.2, ...reportTableChrome() },
    headStyles: reportHeadChrome(),
    columnStyles: {
      5: { halign: "right" },
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  doc.setFontSize(9);
  doc.text(`Amount in word: ${amountToWordsEn(sheet.total)}`, 14, y, {
    maxWidth: pageW - 28,
  });
}

function writeSonaliFuelLetter(doc: jsPDF, sheet: RationStaffSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 14);
  const monthLabel = formatMonthLong(sheet.month);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(`DT: ${monthLabel}`, pageW - 14, y, { align: "right" });
  y += 6;

  doc.text("To,", 14, y);
  y += 4;
  doc.text("Manager", 14, y);
  y += 4;
  doc.text(sheet.sender.bank_name || sheet.sender.label, 14, y);
  y += 4;
  if (sheet.sender.branch) {
    doc.text(sheet.sender.branch, 14, y);
    y += 4;
  }
  doc.text(city, 14, y);
  y += 6;

  const subject = sonaliFuelSubject(sheet.month);
  doc.setFont("helvetica", "bold");
  doc.text(`SUBJECT: ${subject}`, 14, y);
  const subW = doc.getTextWidth(`SUBJECT: ${subject}`);
  doc.line(14, y + 1, 14 + Math.min(subW, pageW - 28), y + 1);
  doc.setFont("helvetica", "normal");
  y += 6;

  doc.text("Dear Sir,", 14, y);
  y += 5;
  doc.text(sonaliFuelBody(sheet.month), 14, y, { maxWidth: pageW - 28 });
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [SONALI_FUEL_COLUMNS as unknown as string[]],
    body: sheet.lines.map((row) => sonaliFuelCells(row)),
    foot: [
      ["", "", "", "", "", "", "G/Total:", trustBankMoney(sheet.total), ""],
    ],
    styles: { fontSize: 7, cellPadding: 1.2, ...reportTableChrome() },
    headStyles: reportHeadChrome(),
    footStyles: reportFootChrome(),
    columnStyles: {
      7: { halign: "right" },
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  doc.setFontSize(9);
  doc.text(`Amount in word: ${amountToWordsEn(sheet.total)}`, 14, y);
  y += 5;
  doc.text(
    "Please, the above amount will be sent today from your branch.",
    14,
    y,
    { maxWidth: pageW - 28 },
  );
  y += 10;
  doc.text("Thanking You", 14, y);
  y += 8;
  doc.text("Sincerely Yours,", 14, y);
}

function writeStaffPayoutLetter(
  doc: jsPDF,
  sheet: RationStaffSheet,
  subjectOverride?: string,
) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 14);
  const monthLabel = formatMonthLong(sheet.month);
  const subject =
    subjectOverride ??
    freshMoneyBeftnSubject(
      sheet.month,
      sheet.memberBank || sheet.sender.bank_name || "Trust Bank",
    );

  doc.setFontSize(9);
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
  doc.text(freshMoneyBeftnBody(sheet.month), 14, y, { maxWidth: pageW - 28 });
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
      row.user.personal_id || row.user.rab_id,
      row.user.rank || "",
      row.user.name,
      row.user.account_number?.trim() || "—",
      row.user.routing || "—",
      row.user.bank_name || "—",
      amt(row.amount),
      "",
    ]),
    styles: { fontSize: 7, cellPadding: 1.2, ...reportTableChrome() },
    headStyles: reportHeadChrome(),
    columnStyles: {
      7: { halign: "right" },
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  if (isTrustFuelStaffSheet(sheet)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
    doc.setFontSize(9);
    doc.text(`Amount in word: ${amountToWordsEn(sheet.total)}`, 14, y, {
      maxWidth: pageW - 28,
    });
  }
}

export function downloadStaffPayoutPdf(
  sheets: RationStaffSheet[],
  filename: string,
  subjectOverride?: string,
) {
  if (!sheets.length) return;

  savePdfsStaggered(
    sheets.map((sheet) => {
      if (isCommunityFuelStaffSheet(sheet)) {
        return {
          filename: filenameForBank(filename, sheetBankName(sheet)),
          write: (doc: jsPDF) => writeCommunityFuelLetter(doc, sheet),
        };
      }
      if (isSonaliFuelStaffSheet(sheet)) {
        return {
          filename: filenameForBank(filename, sheetBankName(sheet)),
          write: (doc: jsPDF) => writeSonaliFuelLetter(doc, sheet),
        };
      }
      if (isTrustFuelStaffSheet(sheet)) {
        return {
          filename: filenameForBank(filename, sheetBankName(sheet)),
          write: (doc: jsPDF) =>
            writeStaffPayoutLetter(doc, sheet, subjectOverride),
        };
      }
      if (
        isTrustBankSheet(sheet) ||
        isCommunityBankSheet(sheet) ||
        isSonaliBankSheet(sheet)
      ) {
        return {
          landscape: true,
          filename: filenameForBank(filename, sheetBankName(sheet)),
          write: (doc: jsPDF) =>
            writeTransferByBank(doc, staffSheetToTransferSheet(sheet)),
        };
      }
      return {
        filename: filenameForBank(filename, sheetBankName(sheet)),
        write: (doc: jsPDF) =>
          writeStaffPayoutLetter(doc, sheet, subjectOverride),
      };
    }),
  );
}
