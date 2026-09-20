import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadExcelReport, reportFileStem } from "@/lib/excel";

export { reportFileStem } from "@/lib/excel";

export type MemberListDownloadArgs = {
  org: string;
  station: string;
  title: string;
  countLabel: string;
  chips: string[];
  headers: string[];
  rows: string[][];
  filename?: string;
};

export function downloadMemberListPdf({
  org,
  title,
  countLabel,
  chips,
  headers,
  rows,
  filename,
}: MemberListDownloadArgs) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(org, pageW / 2, y, { align: "center" });
  doc.setTextColor(20, 20, 20);
  y += 5;
  doc.setFontSize(9);
  doc.text(countLabel, pageW / 2, y, { align: "center" });
  y += 5;
  if (chips.length) {
    doc.setFontSize(8);
    doc.text(chips.join(" · "), pageW / 2, y, {
      align: "center",
      maxWidth: pageW - 24,
    });
    y += 12;
  } else {
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1.2, halign: "left", valign: "middle" },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  doc.save(filename ?? `${reportFileStem(title)}.pdf`);
}

export function downloadMemberListExcel({
  org,
  title,
  countLabel,
  chips,
  headers,
  rows,
  filename,
}: MemberListDownloadArgs) {
  downloadExcelReport({
    filename: filename ?? `${reportFileStem(title)}.xls`,
    sheetName: title,
    title,
    org,
    lines: [countLabel, ...chips],
    headers,
    rows,
  });
}
