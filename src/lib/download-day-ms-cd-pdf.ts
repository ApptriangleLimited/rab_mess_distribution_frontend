import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import type { User } from "@/lib/types";

type Args = {
  date: string;
  ms: User[];
  cd: User[];
  /** Which sections to include. Default both. */
  include?: "all" | "MS" | "CD";
  filename?: string;
};

function memberRows(users: User[]) {
  return users.map((u, i) => [
    String(i + 1),
    u.personal_id || "—",
    u.rank || "—",
    u.name,
    u.wing || "—",
  ]);
}

function writeSection(
  doc: jsPDF,
  title: string,
  users: User[],
  startY: number,
) {
  let y = startY;

  if (y > 250) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`${title} (${users.length})`, 14, y);
  y += 3;

  if (users.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("No members.", 14, y + 4);
    doc.setTextColor(20);
    return y + 10;
  }

  autoTable(doc, {
    startY: y,
    head: [["No.", "Number", "Rank", "Name", "Wing"]],
    body: memberRows(users),
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      valign: "middle",
      lineWidth: 0.1,
      lineColor: 0,
      textColor: 20,
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: 20,
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 28, halign: "left" },
      2: { cellWidth: 28, halign: "left" },
      3: { cellWidth: 70, halign: "left", overflow: "ellipsize" },
      4: { cellWidth: 28, halign: "left" },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = ((doc as any).lastAutoTable?.finalY ?? y) as number;
  return after + 8;
}

/** Single-date MS / CD member list PDF (portrait A4). */
export function downloadDayMsCdPdf({
  date,
  ms,
  cd,
  include = "all",
  filename,
}: Args) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const dateLabel = formatDateLong(date);

  let y = 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(CONSUME_REPORT_META.wing, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(12);
  const scope =
    include === "MS" ? "MS" : include === "CD" ? "CD" : "MS & CD";
  doc.text(`${scope} Report — ${dateLabel}`, pageW / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${CONSUME_REPORT_META.orgName} Camp, ${CONSUME_REPORT_META.station}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 8;

  const showMs = include === "all" || include === "MS";
  const showCd = include === "all" || include === "CD";

  if (showMs) y = writeSection(doc, "MS — Mess", ms, y);
  if (showCd) y = writeSection(doc, "CD — Cash Diet", cd, y);

  const signs = ["Daily SI", "Admin Officer", "Commandant"];
  let signY = y + 10;
  if (signY > 270) {
    doc.addPage();
    signY = 30;
  }
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`${scope.toUpperCase()} (${date})`, pageW - 14, signY - 6, {
    align: "right",
  });
  doc.setTextColor(20);
  const gap = pageW / signs.length;
  signs.forEach((label, i) => {
    const x = gap * i + gap / 2;
    doc.line(x - 18, signY, x + 18, signY);
    doc.text(label, x, signY + 4, { align: "center" });
  });

  doc.save(filename ?? `ms-cd-${date}.pdf`);
}
