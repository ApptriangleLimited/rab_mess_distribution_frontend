import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import {
  registerCellMark,
  registerDayRuns,
  type LedgerRow,
} from "@/lib/reports";

type Args = {
  month: string;
  /** Calendar day numbers as column headers (1-based). */
  dayNumbers: number[];
  /** `row.days` length must match `dayNumbers`. */
  rows: LedgerRow[];
  filename?: string;
};

export function downloadDailyRegisterPdf({
  month,
  dayNumbers,
  rows,
  filename,
}: Args) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const monthLabel = formatMonthLong(month);

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
  doc.text("Attendance Register", pageW / 2, boxY + 22, { align: "center" });
  doc.setFontSize(13);
  doc.text(monthLabel.replace(" ", "-"), pageW / 2, boxY + 34, {
    align: "center",
  });
  doc.addPage();

  let y = 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(CONSUME_REPORT_META.wing, pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(10);
  doc.text(`Attendance Register — ${monthLabel}`, pageW / 2, y, {
    align: "center",
  });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${CONSUME_REPORT_META.orgName} Camp, ${CONSUME_REPORT_META.station}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 5;

  const head = ["No.", "Number", "Rank", "Name", ...dayNumbers.map(String)];

  const body = rows.map((row, i) => {
    const cells: string[] = [
      String(i + 1),
      row.user.rab_id,
      row.user.rank,
      row.user.name,
    ];
    // Expand runs to one cell per day for autoTable (no colspan).
    for (const run of registerDayRuns(row.days)) {
      const mark = registerCellMark(run.tag, run.len);
      for (let k = 0; k < run.len; k++) {
        if (!run.tag) {
          cells.push("");
        } else if (run.len > 1) {
          // Middle of span shows label; edges show dash to suggest arrow.
          if (k === Math.floor((run.len - 1) / 2)) cells.push(mark);
          else if (k === 0) cells.push("←");
          else if (k === run.len - 1) cells.push("→");
          else cells.push("—");
        } else {
          cells.push(mark);
        }
      }
    }
    return cells;
  });

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: {
      fontSize: 4.5,
      cellPadding: 0.35,
      halign: "center",
      valign: "middle",
      lineWidth: 0.1,
      lineColor: 0,
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: 20,
      fontStyle: "bold",
      fontSize: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 5 },
      1: { cellWidth: 11, halign: "left" },
      2: { cellWidth: 11, halign: "left" },
      3: { cellWidth: 16, halign: "left", overflow: "ellipsize" },
    },
    theme: "grid",
    margin: { left: 4, right: 4 },
    tableWidth: "auto",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  doc.setTextColor(20);

  const signs = [
    "Daily SI",
    "Consume SI",
    "Mess CQ",
    "Senior DAD (Admin)",
    "President, Mess Committee",
    "Commandant",
  ];
  const signY = after + 12;
  const inset = 6;
  const usable = pageW - inset * 2;
  const gap = usable / signs.length;
  const half = Math.min(18, gap / 2 - 1.5);
  doc.setFontSize(6);
  signs.forEach((label, i) => {
    const x = inset + gap * i + gap / 2;
    doc.line(x - half, signY, x + half, signY);
    const lines = doc.splitTextToSize(label, gap - 2);
    doc.text(lines, x, signY + 3.2, { align: "center" });
  });

  doc.save(filename ?? `attendance-register-${month}.pdf`);
}
