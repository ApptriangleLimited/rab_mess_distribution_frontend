import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import type { DailyStateReport } from "@/lib/types";

function statusLabel(status: DailyStateReport["status"]) {
  if (status === "pending") return "PENDING";
  if (status === "approved") return "APPROVED";
  return "REJECTED";
}

/** Formal A4 duty-state letter for paper trail. */
export function downloadStateReportPdf(
  report: DailyStateReport,
  filename?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const dateLabel = formatDateLong(report.date);
  const status = statusLabel(report.status);

  let y = 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(CONSUME_REPORT_META.wing, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(13);
  doc.text("Daily State Report", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${CONSUME_REPORT_META.orgName} Camp, ${CONSUME_REPORT_META.station}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Date: ${dateLabel}`, 14, y);
  doc.text(`Status: ${status}`, pageW - 14, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Submitted by: ${report.submitted_by || "—"}`, 14, y);
  if (report.submitted_at) {
    doc.text(
      new Date(report.submitted_at).toLocaleString("en-GB"),
      pageW - 14,
      y,
      { align: "right" },
    );
  }
  y += 4;
  if (report.reviewed_by && report.reviewed_at) {
    doc.text(
      `Reviewed by: ${report.reviewed_by} · ${new Date(report.reviewed_at).toLocaleString("en-GB")}`,
      14,
      y,
    );
    y += 4;
  }
  if (report.boro_khana) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 80, 0);
    doc.text("Boro Khana day — everyone eats", 14, y);
    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    y += 4;
  }
  if (report.note) {
    doc.setTextColor(140, 20, 40);
    doc.text(`Note: ${report.note}`, 14, y, { maxWidth: pageW - 28 });
    doc.setTextColor(20);
    y += 6;
  } else {
    y += 2;
  }

  const tagBits = Object.entries(report.totals.by_tag)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, n]) => `${tag}:${n}`)
    .join("  ");
  doc.setFontSize(8);
  doc.text(
    `Active: ${report.totals.active}  ·  Mess eaters: ${report.totals.mess_eaters}${
      tagBits ? `  ·  ${tagBits}` : ""
    }`,
    14,
    y,
    { maxWidth: pageW - 28 },
  );
  y += 6;

  const head = report.boro_khana
    ? [["No.", "Number", "Rank", "Name", "Wing", "Tag", "Mess"]]
    : [["No.", "Number", "Rank", "Name", "Wing", "Tag"]];

  const body = report.members.map((m, i) => {
    const row = [
      String(i + 1),
      m.rab_id || "—",
      m.rank || "—",
      m.name,
      m.wing || "—",
      m.tag || "—",
    ];
    if (report.boro_khana) row.push(m.mess_reason ?? "—");
    return row;
  });

  autoTable(doc, {
    startY: y,
    head,
    body:
      body.length > 0
        ? body
        : [
            report.boro_khana
              ? ["—", "—", "—", "No active members", "—", "—", "—"]
              : ["—", "—", "—", "No active members", "—", "—"],
          ],
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
    columnStyles: report.boro_khana
      ? {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 24 },
          2: { cellWidth: 22 },
          3: { cellWidth: 52, overflow: "ellipsize" },
          4: { cellWidth: 22 },
          5: { cellWidth: 16, halign: "center" },
          6: { cellWidth: 16, halign: "center" },
        }
      : {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 28 },
          2: { cellWidth: 26 },
          3: { cellWidth: 60, overflow: "ellipsize" },
          4: { cellWidth: 28 },
          5: { cellWidth: 18, halign: "center" },
        },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let signY = (((doc as any).lastAutoTable?.finalY ?? y) as number) + 14;
  if (signY > 270) {
    doc.addPage();
    signY = 30;
  }

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`STATE REPORT (${report.date}) · ${status}`, pageW - 14, signY - 6, {
    align: "right",
  });
  doc.setTextColor(20);
  const signs = ["Daily SI", "Admin Officer", "Commandant"];
  const gap = pageW / signs.length;
  signs.forEach((label, i) => {
    const x = gap * i + gap / 2;
    doc.line(x - 18, signY, x + 18, signY);
    doc.text(label, x, signY + 4, { align: "center" });
  });

  doc.save(filename ?? `state-report-${report.date}-${report.status}.pdf`);
}
