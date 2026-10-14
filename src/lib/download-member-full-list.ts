import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadExcelReport, reportFileStem } from "@/lib/excel";

export { reportFileStem } from "@/lib/excel";

export type MemberFullListDownloadArgs = {
  org: string;
  title: string;
  countLabel: string;
  chips: string[];
  headers: string[];
  rows: string[][];
  filename?: string;
};

function writeMasthead(
  doc: jsPDF,
  title: string,
  org: string,
  countLabel: string,
  chips: string[],
) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(org, pageW / 2, y, { align: "center" });
  doc.setTextColor(20, 20, 20);
  y += 4.5;
  doc.setFontSize(9);
  doc.text(countLabel, pageW / 2, y, { align: "center" });
  y += 4.5;
  if (chips.length) {
    doc.setFontSize(7.5);
    doc.text(chips.join(" · "), pageW / 2, y, {
      align: "center",
      maxWidth: pageW - 20,
    });
    y += 8;
  } else {
    y += 5;
  }
  return y;
}

export function downloadMemberFullListPdf({
  org,
  title,
  countLabel,
  chips,
  headers,
  rows,
  filename,
}: MemberFullListDownloadArgs) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const startY = writeMasthead(doc, title, org, countLabel, chips);

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 6.5,
      cellPadding: 1,
      halign: "left",
      valign: "middle",
      overflow: "linebreak",
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: 20,
      fontStyle: "bold",
    },
    theme: "grid",
    margin: { left: 8, right: 8 },
  });

  doc.save(filename ?? `${reportFileStem(title)}.pdf`);
}

export function downloadMemberFullListExcel({
  org,
  title,
  countLabel,
  chips,
  headers,
  rows,
  filename,
}: MemberFullListDownloadArgs) {
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
