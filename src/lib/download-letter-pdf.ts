import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatDateOrdinal,
  formatMonthBill,
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
  isTrustBankSheet,
  isTrustFuelStaffSheet,
  trustBankBody,
  trustBankCells,
  trustBankMoney,
  trustBankSubject,
} from "@/lib/trust-bank-letter";

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

function writeTrustBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(RATION_REPORT_META.refPrefixPayAllce, 10, y);
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
    foot: [
      [
        ...Array(9).fill(""),
        "G/Total:",
        trustBankMoney(sheet.total),
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

function writeCommunityBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(RATION_REPORT_META.refPrefixPayAllce, 10, y);
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
    foot: [
      [
        ...Array(8).fill(""),
        "G/Total:",
        trustBankMoney(sheet.total),
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

function writeSonaliBankLetter(doc: jsPDF, sheet: RationTransferSheet) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = writeHeader(doc, 12);
  const city =
    sheet.sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka";

  doc.setFontSize(9);
  doc.text(RATION_REPORT_META.refPrefixPayAllce, 10, y);
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
    foot: [
      [
        ...Array(8).fill(""),
        "G/Total:",
        trustBankMoney(sheet.total),
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

  const monthBill = formatMonthBill(sheet.month);
  const dtLabel = formatMonthLong(sheet.reportDate.slice(0, 7));
  const memberBank = sheet.lines[0]?.user.bank_name || "—";
  const monthLabel = formatMonthLong(sheet.month);
  const subject = RATION_REPORT_META.subjectTagBill
    .replace("{monthLabel}", monthLabel)
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

function savePdfsStaggered(jobs: { write: (doc: jsPDF) => void; filename: string; landscape?: boolean }[]) {
  jobs.forEach((job, i) => {
    const run = () => {
      const doc = new jsPDF({
        orientation: job.landscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      job.write(doc);
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
  doc.text(`${RATION_REPORT_META.refPrefix}/${sheet.month}`, 14, y);
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
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold",
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
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
  doc.text(`${RATION_REPORT_META.refPrefix}/${sheet.month}`, 14, y);
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
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold",
    },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
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
    (sheet.memberBank
      ? RATION_REPORT_META.subjectTagBill
          .replace("{monthLabel}", monthLabel)
          .replace("{bank}", sheet.memberBank)
      : RATION_REPORT_META.subjectFreshMoney.replace(
          "{month}",
          monthLabel,
        ));

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
      row.user.personal_id || row.user.rab_id,
      row.user.rank || "",
      row.user.name,
      row.user.account_number || "—",
      row.user.routing || "—",
      row.user.bank_name || "—",
      amt(row.amount),
      row.remarks || (row.missingBank ? "Missing bank details" : ""),
    ]),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold",
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });
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
