import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  groupRegisterRowsByWing,
  wingPrintOrder,
} from "@/lib/daily-register-wings";
import { formatMonthLong } from "@/lib/date";
import type { LedgerRow } from "@/lib/reports";
import { tagPrintFill } from "@/lib/tag-colors";
import { isTrgTag, resolveTrgTone } from "@/lib/trg-tone";

function hexRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

export type DailyRegisterPdfArgs = {
  month: string;
  /** Calendar day numbers as column headers (1-based). */
  dayNumbers: number[];
  /** `row.days` length must match `dayNumbers`. */
  rows: LedgerRow[];
  filename?: string;
  coverTitle?: string;
  sheetTitle?: string;
  pageOf?: (page: number, total: number) => string;
  signLabel?: string;
  wingSerial?: string[];
};

const HEADER_TOP = 8;
const HEADER_H = 16;
const FOOTER_H = 22;

function drawSheetHeader(
  doc: jsPDF,
  pageW: number,
  sheetTitle: string,
  wingName: string,
) {
  let y = HEADER_TOP;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(wingName, pageW / 2, y, { align: "center" });
  y += 4.5;
  doc.setFontSize(9);
  doc.text("SRB Forces Headquarters", pageW / 2, y, { align: "center" });
  y += 4.5;
  doc.text(sheetTitle, pageW / 2, y, { align: "center" });
}

function drawDailySi(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  signLabel: string,
  wingLabel?: string,
) {
  const lineW = 34;
  const right = pageW - 8;
  const lineY = pageH - 17;
  const x = right - lineW / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(right - lineW, lineY, right, lineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(20);
  doc.text(signLabel, x, lineY + 3.4, { align: "center" });
  if (wingLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(wingLabel, x, lineY + 7, { align: "center" });
  }
}

export function buildDailyRegisterPdf({
  month,
  dayNumbers,
  rows,
  coverTitle = "Attendance Register",
  sheetTitle,
  pageOf = (page, total) => `Page ${page} of ${total}`,
  signLabel = "Daily SI",
  wingSerial = wingPrintOrder(),
}: DailyRegisterPdfArgs) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const tableW = pageW - 8;
  const dayW = Math.max(
    5.2,
    (tableW - 8 - 22 - 16 - 28) / Math.max(dayNumbers.length, 1),
  );
  const monthLabel = formatMonthLong(month);
  const title = sheetTitle ?? `Attendance Register — ${monthLabel}`;

  doc.setFillColor(244, 226, 90);
  doc.rect(0, 0, pageW, pageH, "F");
  const boxW = 110;
  const boxH = 52;
  const boxX = (pageW - boxW) / 2;
  const boxY = (pageH - boxH) / 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.1);
  doc.rect(boxX, boxY, boxW, boxH, "FD");
  doc.setLineWidth(0.35);
  doc.rect(boxX + 2.2, boxY + 2.2, boxW - 4.4, boxH - 4.4, "S");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(coverTitle, pageW / 2, boxY + 22, { align: "center" });
  doc.setFontSize(13);
  doc.text(monthLabel.replace(" ", "-"), pageW / 2, boxY + 34, {
    align: "center",
  });
  const blocks = groupRegisterRowsByWing(rows, wingSerial);
  const pageWing = new Map<number, string>();
  const tableOpts = {
    styles: {
      fontSize: 7,
      cellPadding: 0.6,
      halign: "center" as const,
      valign: "middle" as const,
      lineWidth: 0.1,
      lineColor: 0,
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 235, 235] as [number, number, number],
      textColor: 20,
      fontStyle: "bold" as const,
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22, halign: "left" as const },
      2: { cellWidth: 16, halign: "left" as const },
      3: {
        cellWidth: 28,
        halign: "left" as const,
        overflow: "ellipsize" as const,
      },
      ...Object.fromEntries(
        dayNumbers.map((_, i) => [i + 4, { cellWidth: dayW }]),
      ),
    },
    theme: "grid" as const,
    margin: {
      left: 4,
      right: 4,
      top: HEADER_TOP + HEADER_H,
      bottom: FOOTER_H,
    },
    tableWidth: tableW,
  };

  for (const block of blocks) {
    doc.addPage("a4", "l");
    const head = ["No.", "Personal no", "Rank", "Name", ...dayNumbers.map(String)];
    const body = block.rows.map((row, i) => [
      String(i + 1),
      row.user.personal_id || "—",
      row.user.rank,
      row.user.name,
      ...row.days.map((tag) => tag || ""),
    ]);
    const startPage = doc.getCurrentPageInfo().pageNumber;
    autoTable(doc, {
      startY: HEADER_TOP + HEADER_H,
      head: [head],
      body,
      ...tableOpts,
      didDrawPage: () => {
        drawSheetHeader(doc, pageW, title, block.label);
      },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index < 4) return;
        const row = block.rows[data.row.index];
        const tag = String(data.cell.raw ?? "").trim();
        if (!row || !tag) return;
        const tone = isTrgTag(tag) ? resolveTrgTone(row.user.force) : undefined;
        const fill = tagPrintFill(tag, tone);
        data.cell.styles.fillColor = hexRgb(fill.bg);
        data.cell.styles.textColor = hexRgb(fill.fg);
        data.cell.styles.fontStyle = "bold";
      },
    });
    const endPage = doc.getCurrentPageInfo().pageNumber;
    for (let p = startPage; p <= endPage; p++) {
      pageWing.set(p, block.label);
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const wingLabel = pageWing.get(i);
    if (wingLabel) drawDailySi(doc, pageW, pageH, signLabel, wingLabel);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(pageOf(i, total), pageW / 2, pageH - 5, { align: "center" });
  }

  return doc;
}

export function downloadDailyRegisterPdf(args: DailyRegisterPdfArgs) {
  buildDailyRegisterPdf(args).save(
    args.filename ?? `attendance-register-${args.month}.pdf`,
  );
}

/** Print the same PDF the download button builds. */
export async function printDailyRegisterPdf(args: DailyRegisterPdfArgs) {
  const doc = buildDailyRegisterPdf(args);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        frame.remove();
      }, 1500);
      resolve();
    };
    const tryPrint = () => {
      const win = frame.contentWindow;
      if (!win) {
        finish();
        return;
      }
      win.focus();
      win.print();
      win.addEventListener("afterprint", finish, { once: true });
      window.setTimeout(finish, 60_000);
    };
    frame.onload = tryPrint;
    window.setTimeout(tryPrint, 800);
  });
}
