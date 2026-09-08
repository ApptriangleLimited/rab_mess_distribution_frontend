import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadExcel } from "@/lib/excel";

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
  station,
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
  doc.setFontSize(11);
  doc.text(org, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(13);
  doc.text(title, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(station, pageW / 2, y, { align: "center" });
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
    y += 6;
  }

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  doc.save(filename ?? "member-list.pdf");
}

export function downloadMemberListExcel({
  org,
  station,
  title,
  countLabel,
  chips,
  headers,
  rows,
  filename,
}: MemberListDownloadArgs) {
  const sheet: string[][] = [
    [org],
    [title],
    [station],
    [countLabel],
    ...(chips.length ? [[chips.join(" · ")]] : []),
    [],
    headers,
    ...rows,
  ];
  downloadExcel(filename ?? "member-list.xls", sheet, title);
}
