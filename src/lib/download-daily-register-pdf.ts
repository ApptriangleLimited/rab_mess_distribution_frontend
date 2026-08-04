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
  dayCount: number;
  rows: LedgerRow[];
  filename?: string;
};

export function downloadDailyRegisterPdf({
  month,
  dayCount,
  rows,
  filename,
}: Args) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const monthLabel = formatMonthLong(month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

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

  const head = ["No.", "Number", "Rank", "Name", ...days.map(String)];

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
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`ATTENDANCE REGISTER (${monthLabel.toUpperCase()})`, pageW - 8, after, {
    align: "right",
  });
  doc.setTextColor(20);

  const signs = ["Daily SI", "Admin Officer", "Commandant"];
  const signY = after + 14;
  const gap = pageW / signs.length;
  signs.forEach((label, i) => {
    const x = gap * i + gap / 2;
    doc.line(x - 18, signY, x + 18, signY);
    doc.text(label, x, signY + 4, { align: "center" });
  });

  doc.save(filename ?? `attendance-register-${month}.pdf`);
}
