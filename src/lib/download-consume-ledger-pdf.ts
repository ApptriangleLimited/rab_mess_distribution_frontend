import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { chunkBillRows, CONSUME_BILL_ROWS_PER_PAGE } from "@/lib/consume-bill-pages";
import { consumeRankShort } from "@/lib/consume-rank-short";
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

type Args = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
  visibleDays?: number[];
  /** Cross-month: `row.days[i]` aligns with `columnDates[i]`. */
  columnDates?: string[];
  /** One ledger per official wing. Each copy keeps the same columns. */
  sections?: { wingLabel: string; rows: LedgerRow[] }[];
  filename?: string;
};

export function downloadConsumeLedgerPdf({
  month,
  dayCount,
  tagCodes,
  rows,
  visibleDays,
  columnDates,
  sections,
  filename,
}: Args) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const monthLabel = formatMonthLong(month).toUpperCase();
  const rangeMode = Boolean(columnDates?.length);
  const dayHeaders = columnDates?.length
    ? columnDates.map((d) => Number(d.slice(8, 10)))
    : visibleDays?.length
      ? visibleDays
      : Array.from({ length: dayCount }, (_, i) => i + 1);
  const ledgers = sections?.length
    ? sections
    : [{ wingLabel: CONSUME_REPORT_META.wing, rows }];

  ledgers.forEach((section, wingIndex) => {
    const pageGroups = chunkBillRows(section.rows);
    pageGroups.forEach((pageRows, pageIndex) => {
      if (wingIndex > 0 || pageIndex > 0) doc.addPage();
      const lastPage = pageIndex === pageGroups.length - 1;
      let y = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(section.wingLabel.toUpperCase(), pageW / 2, y, { align: "center" });
      y += 4.2;
      doc.text(
        `FORCES MESS FOOD CONSUMPTION LIST — ${monthLabel}`,
        pageW / 2,
        y,
        { align: "center" },
      );
      y += 3.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `${CONSUME_REPORT_META.orgName} Camp, ${CONSUME_REPORT_META.station}`,
        pageW / 2,
        y,
        { align: "center" },
      );
      y += 8;

      const head = [
        "SL",
        "Personal No",
        "SRB No",
        "Rank",
        "Name",
        ...dayHeaders.map(String),
        ...tagCodes,
        "Total",
      ];
      const serialOffset = pageIndex * CONSUME_BILL_ROWS_PER_PAGE;
      const body = pageRows.map((row, i) => [
        String(serialOffset + i + 1),
        row.user.personal_id || "—",
        row.user.rab_id || "—",
        consumeRankShort(row.user.rank),
        row.user.name,
        ...(rangeMode
          ? dayHeaders.map((_, di) => row.days[di] || "")
          : dayHeaders.map((d) => row.days[d - 1] || "")),
        ...tagCodes.map((code) =>
          row.tagCounts[code] ? String(row.tagCounts[code]) : "",
        ),
        row.totalDays ? String(row.totalDays) : "",
      ]);
      const tagTotals = tagCodes.map((code) =>
        String(
          section.rows.reduce((s, r) => s + (r.tagCounts[code] ?? 0), 0) || "",
        ),
      );
      const grandDays = section.rows.reduce((s, r) => s + r.totalDays, 0);
      const foot = [
        "Grand total",
        ...Array.from({ length: 4 + dayHeaders.length }, () => ""),
        ...tagTotals,
        String(grandDays || ""),
      ];

      autoTable(doc, {
        startY: y,
        head: [head],
        body,
        foot: lastPage ? [foot] : undefined,
        styles: {
          fontSize: 6.5,
          cellPadding: 0.8,
          halign: "left",
          valign: "middle",
          lineWidth: 0.35,
          lineColor: 0,
          textColor: 0,
          overflow: "visible",
          minCellWidth: 4.2,
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: 0,
          fontStyle: "bold",
          fontSize: 6.5,
          halign: "center",
          lineColor: 0,
          lineWidth: 0.45,
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: 0,
          fontStyle: "bold",
          fontSize: 6.5,
          lineColor: 0,
          lineWidth: 0.35,
        },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 24, halign: "left" },
          2: { cellWidth: 16, halign: "left" },
          3: { cellWidth: 12, halign: "left" },
          4: { cellWidth: 36, halign: "left", overflow: "linebreak" },
        },
        theme: "grid",
        margin: { left: 6, right: 6, bottom: lastPage ? 28 : 10 },
        tableWidth: "auto",
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            data.cell.styles.halign = "center";
          }
          if (data.section === "body" && data.column.index >= 5) {
            data.cell.styles.halign = "center";
          }
          if (data.section === "foot" && data.column.index === 0) {
            data.cell.colSpan = 5 + dayHeaders.length;
            data.cell.styles.halign = "left";
          }
          if (data.section !== "body" || data.column.index < 5) return;
          if (data.column.index >= 5 + dayHeaders.length) return;
          const row = pageRows[data.row.index];
          const tag = String(data.cell.raw ?? "").trim();
          if (!row || !tag) return;
          const tone = isTrgTag(tag) ? resolveTrgTone(row.user.force) : undefined;
          const fill = tagPrintFill(tag, tone);
          data.cell.styles.fillColor = hexRgb(fill.bg);
          data.cell.styles.textColor = hexRgb(fill.fg);
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 6;
          data.cell.styles.halign = "center";
        },
      });

      if (!lastPage) return;

      const signs = [
        ["Daily SI"],
        ["Consume SI"],
        ["Mess CQ SI"],
        ["Senior DAD (Admin)"],
        ["President", "Mess Committee, Forces Mess"],
        ["Major", "Deputy Director (HQ)", "SRB Forces Headquarters"],
      ];
      const signBlockH = 18;
      const after = pageH - 8 - signBlockH;
      const gap = pageW / signs.length;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      signs.forEach((lines, i) => {
        const leftAlign = i >= signs.length - 2;
        const x = leftAlign ? gap * i + 4 : gap * i + gap / 2;
        if (leftAlign) doc.line(x, after, x + 32, after);
        else doc.line(x - 16, after, x + 16, after);
        lines.forEach((line, li) => {
          doc.text(line, x, after + 3.6 + li * 3.1, {
            align: leftAlign ? "left" : "center",
          });
        });
      });
    });
  });

  doc.save(filename ?? `consume-ledger-${month}.pdf`);
}
