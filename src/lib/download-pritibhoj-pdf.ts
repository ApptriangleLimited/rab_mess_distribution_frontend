import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { finalizePritibhojRow, sumPritibhojRows } from "@/lib/pritibhoj-demo";
import type { PritibhojEvent, PritibhojRow } from "@/lib/types";

const HEADERS = [
  "ক্রমিক",
  "উইং/শাখা/সেল",
  "অফিসার",
  "ডিএডি",
  "আজাদ হল",
  "বিতরণ",
  "অন্যান্য",
  "বেসামরিক",
  "নন-মুসলিম",
  "মোট",
  "আজাদ হল",
  "বিতরণ",
  "মোট বিতরণ",
];

function rowCells(row: PritibhojRow, index: number) {
  const live = finalizePritibhojRow(row);
  return [
    String(index + 1),
    live.wing,
    String(live.officer),
    String(live.dad),
    String(live.azadHall),
    String(live.distribution),
    String(live.others),
    String(live.civilian),
    String(live.nonMuslim),
    String(live.total),
    String(live.azadHallDist),
    String(live.distribution2),
    String(live.totalDistribution),
  ];
}

function totalCells(rows: PritibhojRow[], label: string) {
  const totals = sumPritibhojRows(rows.map(finalizePritibhojRow));
  return [
    "",
    label,
    String(totals.officer),
    String(totals.dad),
    String(totals.azadHall),
    String(totals.distribution),
    String(totals.others),
    String(totals.civilian),
    String(totals.nonMuslim),
    String(totals.total),
    String(totals.azadHallDist),
    String(totals.distribution2),
    String(totals.totalDistribution),
  ];
}

function drawSheet(
  doc: jsPDF,
  title: string,
  rows: PritibhojRow[],
  foot: string,
  startY: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, 8, startY);
  autoTable(doc, {
    startY: startY + 3,
    head: [HEADERS],
    body: [
      ...rows.map((row, i) => rowCells(row, i)),
      totalCells(rows, foot),
    ],
    styles: {
      fontSize: 6,
      cellPadding: 0.8,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [251, 191, 36],
      textColor: 30,
      fontStyle: "bold",
    },
    columnStyles: { 1: { halign: "left", cellWidth: 28 } },
    margin: { left: 8, right: 8 },
  });
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? startY + 40;
}

export function downloadPritibhojPdf(event: PritibhojEvent) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(event.title || "Pritibhoj", pageW / 2, 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const meta = [event.org, event.occasion, event.date].filter(Boolean).join("  ·  ");
  if (meta) doc.text(meta, pageW / 2, 18, { align: "center" });

  const afterMain = drawSheet(
    doc,
    "মূল উইং",
    event.main_rows,
    "মোট জনবল =",
    24,
  );
  const nextY = afterMain + 10 > pageH - 40 ? 16 : afterMain + 10;
  if (afterMain + 10 > pageH - 40) doc.addPage();
  drawSheet(doc, "প্রশাসন ও অর্থ", event.admin_rows, "মোট =", nextY);

  const stem = `pritibhoj-${event.date || "sheet"}`.replace(/[^\w.-]+/g, "-");
  doc.save(`${stem}.pdf`);
}
