import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { consumeHqLine } from "@/components/consume/consume-report-masthead";
import { chunkBillRows } from "@/lib/consume-bill-pages";
import { consumeRankShort } from "@/lib/consume-rank-short";
import {
  drawConsumeReportSigns,
  drawUnderlinedCenter,
} from "@/lib/consume-pdf-signs";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthDash, formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type {
  LeaveMedBillRow,
  TagBillRow,
  UserMonthRow,
  WingSummaryRow,
} from "@/lib/reports";

function consumeWingBillTitle(head: string, wing: string, monthLabel: string) {
  const wingPart = wing.trim().toUpperCase();
  const monthPart = monthLabel.toUpperCase();
  return wingPart
    ? `${head} - ${wingPart} - ${monthPart}`
    : `${head} - ${monthPart}`;
}

function drawConsumeBillSigns(doc: jsPDF, afterY: number, pinToPageEnd = false) {
  drawConsumeReportSigns(doc, {
    afterY: pinToPageEnd ? undefined : afterY,
    pinToPageEnd,
    marginX: 10,
  });
}

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type TotalCell = {
  text: string;
  colSpan?: number;
  align?: "left" | "center" | "right";
};

type AutoColBox = { x: number; width: number };

function recordConsumeColBox(
  doc: jsPDF,
  index: number,
  x: number,
  width: number,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boxes = ((doc as any).__consumeColBoxes ??= []) as AutoColBox[];
  if (Number.isFinite(x) && Number.isFinite(width) && width > 0) {
    boxes[index] = { x, width };
  }
}

/** jsPDF-AutoTable v5 columns have width but no x — derive x from cells or margin. */
function consumeTableColumns(doc: jsPDF): {
  finalY: number;
  columns: AutoColBox[];
} | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = (doc as any).lastAutoTable as
    | {
        finalY?: number;
        settings?: { margin?: { left?: number } };
        columns?: {
          dataKey?: string | number;
          width?: number;
          index?: number;
        }[];
        body?: { cells?: Record<string | number, { x?: number; width?: number }> }[];
        head?: { cells?: Record<string | number, { x?: number; width?: number }> }[];
      }
    | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captured = (doc as any).__consumeColBoxes as AutoColBox[] | undefined;
  if (captured?.length && captured.every((c) => c && c.width > 0)) {
    const finalY = Number(table?.finalY);
    return {
      finalY: Number.isFinite(finalY) ? finalY : 0,
      columns: captured,
    };
  }

  const raw = table?.columns;
  if (!table || !raw?.length) return null;

  const lastBody = table.body?.[table.body.length - 1];
  const lastHead = table.head?.[table.head.length - 1];
  const left = Number(table.settings?.margin?.left);
  let cursorX = Number.isFinite(left) ? left : 10;

  const columns: AutoColBox[] = raw.map((col, i) => {
    const cell =
      lastBody?.cells?.[col.dataKey ?? i] ??
      lastBody?.cells?.[i] ??
      lastHead?.cells?.[col.dataKey ?? i] ??
      lastHead?.cells?.[i];
    const width = Number(cell?.width ?? col.width);
    const x = Number(cell?.x);
    const box = {
      x: Number.isFinite(x) ? x : cursorX,
      width: Number.isFinite(width) && width > 0 ? width : 0,
    };
    cursorX = box.x + box.width;
    return box;
  });

  if (!columns.every((c) => Number.isFinite(c.x) && c.width > 0)) return null;

  const finalY = Number(table.finalY);
  return {
    finalY: Number.isFinite(finalY) ? finalY : 0,
    columns,
  };
}

function finiteRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (![x, y, w, h].every((n) => Number.isFinite(n)) || w <= 0 || h <= 0) {
    return false;
  }
  doc.rect(x, y, w, h);
  return true;
}

/** Total row under the last autoTable — same colspan layout as print preview. */
function drawConsumeTotalRow(doc: jsPDF, cells: TotalCell[]) {
  const table = consumeTableColumns(doc);
  if (!table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Number((doc as any).lastAutoTable?.finalY) || 0;
  }

  const pageH = doc.internal.pageSize.getHeight();
  const rowH = 7;
  let y = table.finalY;
  if (y + rowH > pageH - 30) {
    doc.addPage();
    y = 16;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);

  let col = 0;
  for (const cell of cells) {
    const span = Math.max(1, cell.colSpan ?? 1);
    const slice = table.columns.slice(col, col + span);
    if (!slice.length) break;
    const x = slice[0].x;
    const w = slice.reduce((sum, c) => sum + c.width, 0);
    if (finiteRect(doc, x, y, w, rowH) && cell.text) {
      const align = cell.align ?? "center";
      const textX =
        align === "right" ? x + w - 1.2 : align === "left" ? x + 1.2 : x + w / 2;
      doc.text(cell.text, textX, y + rowH / 2 + 0.8, {
        align,
        baseline: "middle",
      });
    }
    col += span;
  }

  return y + rowH;
}

export function downloadTagBillPdf(args: {
  month: string;
  tag: DailyTag | string;
  tagLabel: string;
  rows: TagBillRow[];
  showFuel: boolean;
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
  allowanceRate?: number;
  fuelRate?: number;
  /** FR+MFR fuel bill: no allowance column, grand total is the fuel figure. */
  fuelOnly?: boolean;
  /** One bill per official wing. Each section keeps the same columns. */
  sections?: {
    wingLabel: string;
    rows: TagBillRow[];
    totalDays: number;
    totalAmount: number;
    totalFuel: number;
    grandTotal: number;
  }[];
  filename?: string;
}) {
  const {
    month,
    tag,
    tagLabel,
    rows,
    showFuel,
    totalDays,
    totalAmount,
    totalFuel,
    grandTotal,
    fuelOnly = false,
    allowanceRate,
    fuelRate,
    sections,
    filename,
  } = args;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const monthLabel = formatMonthDash(month);
  const tagKey = `${tag} ${tagLabel}`.toUpperCase();
  const titleHead =
    tagKey.includes("CD") && !tagKey.includes("FR") ? "CD BILL" : "FR BILL";
  const bills = sections?.length
    ? sections
    : [
        {
          wingLabel: "",
          rows,
          totalDays,
          totalAmount,
          totalFuel,
          grandTotal,
        },
      ];

  bills.forEach((section, wingIndex) => {
    const pageGroups = chunkBillRows(section.rows);
    pageGroups.forEach((pageRows, pageIndex) => {
    if (wingIndex > 0 || pageIndex > 0) doc.addPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).__consumeColBoxes = [];
    let y = 12;

    const title = consumeWingBillTitle(titleHead, section.wingLabel, monthLabel);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    drawUnderlinedCenter(doc, title.toUpperCase(), pageW, y);
    y += 6.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    drawUnderlinedCenter(doc, consumeHqLine().toUpperCase(), pageW, y);
    y += 10;

    const dailyAllowance = amt(allowanceRate ?? section.rows[0]?.rate ?? 0);
    const dailyFuel = amt(fuelRate ?? section.rows[0]?.fuelRate ?? 0);
    const head = fuelOnly
      ? ["SI", "ID", "Rank", "Name", tag, `Fuel Tk ${dailyFuel}`, "Grand total", "Remarks"]
      : [
          "SL",
          "Personal No",
          "Rank",
          "Name",
          tag,
          `Allowance Tk ${dailyAllowance}`,
          ...(showFuel ? [`Fuel Tk ${dailyFuel}`] : []),
          "Grand total",
          "Remarks",
        ];
    const body = pageRows.map((r) =>
      fuelOnly
        ? [
            String(r.sl),
            r.user.personal_id || "—",
            consumeRankShort(r.user.rank),
            r.user.name,
            String(r.days),
            amt(r.fuelAmount),
            amt(r.fuelAmount),
            r.remarks || "",
          ]
        : [
            String(r.sl),
            r.user.personal_id || "—",
            consumeRankShort(r.user.rank),
            r.user.name,
            String(r.days),
            amt(r.amount),
            ...(showFuel ? [amt(r.fuelAmount)] : []),
            amt(r.grandTotal),
            r.remarks || "",
          ],
    );
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 1.2,
        halign: "left",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: 20,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      theme: "grid",
      margin: { left: 12, right: 12, bottom: 28 },
      didParseCell: (data) => {
        if (data.section === "head") return;
        if (data.column.index === 0) {
          data.cell.styles.halign = "center";
          return;
        }
        const last = data.table.columns.length - 1;
        if (data.column.index >= 4 && data.column.index < last) {
          data.cell.styles.halign = "right";
        }
      },
      didDrawCell: (data) => {
        recordConsumeColBox(doc, data.column.index, data.cell.x, data.cell.width);
      },
    });

    const afterTable = drawConsumeTotalRow(
      doc,
      fuelOnly
        ? [
            { text: "Total", colSpan: 4, align: "left" },
            { text: String(section.totalDays), align: "right" },
            { text: amt(section.totalFuel), align: "right" },
            { text: amt(section.totalFuel), align: "right" },
            { text: "" },
          ]
        : [
            { text: "Total", colSpan: 4, align: "left" },
            { text: String(section.totalDays), align: "right" },
            { text: amt(section.totalAmount), align: "right" },
            ...(showFuel
              ? [{ text: amt(section.totalFuel), align: "right" as const }]
              : []),
            { text: amt(section.grandTotal), align: "right" },
            { text: "" },
          ],
    );
    drawConsumeBillSigns(doc, afterTable + 12, true);
    });
  });

  doc.save(filename ?? `consume-bill-${month}-${tag}.pdf`);
}

export function downloadLeaveMedBillPdf(args: {
  month: string;
  tags: readonly DailyTag[];
  rows: LeaveMedBillRow[];
  tagTotals: Partial<Record<DailyTag, number>>;
  totalDays: number;
  totalAmount: number;
  allowanceRate?: number;
  sections?: {
    wingLabel: string;
    rows: LeaveMedBillRow[];
    tagTotals: Partial<Record<DailyTag, number>>;
    totalDays: number;
    totalAmount: number;
  }[];
  filename?: string;
}) {
  const { month, tags, rows, tagTotals, totalDays, totalAmount, allowanceRate, sections, filename } =
    args;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const monthLabel = formatMonthDash(month);
  const titleHead = "FRESH MONEY BILL";
  const bills = sections?.length
    ? sections
    : [{ wingLabel: "", rows, tagTotals, totalDays, totalAmount }];

  bills.forEach((section, wingIndex) => {
    const pageGroups = chunkBillRows(section.rows);
    pageGroups.forEach((pageRows, pageIndex) => {
    if (wingIndex > 0 || pageIndex > 0) doc.addPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).__consumeColBoxes = [];
    let y = 12;

    const title = consumeWingBillTitle(titleHead, section.wingLabel, monthLabel);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    drawUnderlinedCenter(doc, title.toUpperCase(), pageW, y);
    y += 6.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    drawUnderlinedCenter(doc, consumeHqLine().toUpperCase(), pageW, y);
    y += 10;

    const head = [
      "SL",
      "Personal No",
      "Rank",
      "Name",
      ...tags,
      "Total",
      `Fresh money Tk ${amt(allowanceRate ?? section.rows[0]?.rate ?? 0)}`,
      "Remarks",
    ];
    const body = pageRows.map((r) => [
      String(r.sl),
      r.user.personal_id || "—",
      consumeRankShort(r.user.rank),
      r.user.name,
      ...tags.map((code) => (r.tagDays[code] ? String(r.tagDays[code]) : "")),
      String(r.totalDays),
      amt(r.amount),
      r.remarks || "",
    ]);
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      styles: {
        fontSize: 7.5,
        cellPadding: 1,
        halign: "left",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: 20,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      theme: "grid",
      margin: { left: 10, right: 10, bottom: 28 },
      didParseCell: (data) => {
        if (data.section === "head") return;
        if (data.column.index === 0) {
          data.cell.styles.halign = "center";
          return;
        }
        const last = data.table.columns.length - 1;
        if (data.column.index >= 4 && data.column.index < last) {
          data.cell.styles.halign = "right";
        }
      },
      didDrawCell: (data) => {
        recordConsumeColBox(doc, data.column.index, data.cell.x, data.cell.width);
      },
    });

    const afterTable = drawConsumeTotalRow(doc, [
      { text: "Total", colSpan: 4, align: "left" },
      ...tags.map((code) => ({
        text: section.tagTotals[code] ? String(section.tagTotals[code]) : "",
        align: "right" as const,
      })),
      { text: section.totalDays ? String(section.totalDays) : "", align: "right" },
      { text: amt(section.totalAmount), align: "right" },
      { text: "" },
    ]);
    drawConsumeBillSigns(doc, afterTable + 12, true);
    });
  });

  doc.save(filename ?? `consume-bill-${month}-leave-med.pdf`);
}

export function downloadWingSummaryPdf(args: {
  month: string;
  tagCodes: DailyTag[];
  rows: WingSummaryRow[];
  totals: {
    manpower: number;
    tagDays: Partial<Record<DailyTag, number>>;
    totalDays: number;
  };
  filename?: string;
}) {
  const { month, tagCodes, rows, totals, filename } = args;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(CONSUME_REPORT_META.orgName, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(12);
  doc.text(`Consume summary by wing — ${formatMonthLong(month)}`, pageW / 2, y, {
    align: "center",
  });
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [["Wing", "Manpower", ...tagCodes, "Total days", "Remarks"]],
    body: rows.map((r) => [
      r.wing,
      String(r.manpower),
      ...tagCodes.map((c) => String(r.tagDays[c] ?? 0)),
      String(r.totalDays),
      "",
    ]),
    foot: [
      [
        "Total",
        String(totals.manpower),
        ...tagCodes.map((c) => String(totals.tagDays[c] ?? 0)),
        String(totals.totalDays),
        "",
      ],
    ],
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 10, right: 10 },
  });

  doc.save(filename ?? `consume-wing-summary-${month}.pdf`);
}

export function downloadConsumeMonthPdf(args: {
  month: string;
  rows: UserMonthRow[];
  filename?: string;
}) {
  const { month, rows, filename } = args;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(CONSUME_REPORT_META.orgName, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(12);
  doc.text(`Monthly consume — ${formatMonthLong(month)}`, pageW / 2, y, {
    align: "center",
  });
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "SL",
        "Personal No",
        "Rank",
        "Name",
        "Total days",
        "Allowance days",
        "Amount",
      ],
    ],
    body: rows.map((r, i) => [
      String(i + 1),
      r.user.personal_id || "—",
      consumeRankShort(r.user.rank),
      r.user.name,
      String(r.totalDays),
      String(r.allowanceDays),
      amt(r.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  doc.save(filename ?? `consume-${month}.pdf`);
}
