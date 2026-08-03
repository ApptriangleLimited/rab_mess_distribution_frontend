import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";

type Args = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
  filename?: string;
};

export function downloadConsumeLedgerPdf({
  month,
  dayCount,
  tagCodes,
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
  doc.text(`Forces Mess food consumption list — ${monthLabel}`, pageW / 2, y, {
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

  const head = [
    "Ser",
    "Rank",
    "Name",
    ...days.map(String),
    ...tagCodes,
    "Total",
  ];

  const body = rows.map((row, i) => [
    String(i + 1),
    row.user.rank,
    row.user.name,
    ...row.days.map((d) => d || ""),
    ...tagCodes.map((code) =>
      row.tagCounts[code] ? String(row.tagCounts[code]) : "",
    ),
    row.totalDays ? String(row.totalDays) : "",
  ]);

  const tagTotals = tagCodes.map((code) =>
    String(rows.reduce((s, r) => s + (r.tagCounts[code] ?? 0), 0) || ""),
  );
  const grandDays = rows.reduce((s, r) => s + r.totalDays, 0);
  const foot = [
    "",
    "",
    "Grand total",
    ...days.map(() => ""),
    ...tagTotals,
    String(grandDays || ""),
  ];

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: [foot],
    styles: {
      fontSize: 4.5,
      cellPadding: 0.4,
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
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: 20,
      fontStyle: "bold",
      fontSize: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 6 },
      1: { cellWidth: 12, halign: "left" },
      2: { cellWidth: 22, halign: "left" },
    },
    theme: "grid",
    margin: { left: 6, right: 6 },
    tableWidth: "auto",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
  const signs = [
    "Consume SI",
    "Picket SI",
    "Senior DAD (Admin)",
    "President, Mess Committee",
  ];
  const gap = pageW / signs.length;
  doc.setFontSize(7);
  signs.forEach((label, i) => {
    const x = gap * i + gap / 2;
    doc.line(x - 18, after, x + 18, after);
    doc.text(label, x, after + 4, { align: "center" });
  });

  doc.save(filename ?? `consume-ledger-${month}.pdf`);
}
