import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { consumeHqLine } from "@/components/consume/consume-report-masthead";
import {
  officialBghDays,
  officialFrDays,
  officialLeaveTotal,
  officialLnkDays,
  officialMedDays,
  officialMsDays,
  officialWitDays,
  officialWrDays,
  type OfficialConsumePack,
  type OfficialConsumeRow,
  type OfficialConsumeTable,
} from "@/lib/consume-official-reports";
import { drawConsumeReportSigns, drawUnderlinedCenter } from "@/lib/consume-pdf-signs";

function cell(n: number) {
  return n ? String(n) : "0";
}

function tableBody(table: OfficialConsumeTable) {
  const all = [...table.rows, table.totals];
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  const isCd = (table.tagLabel ?? "").toUpperCase().includes("CD");

  return all.map((row) => {
    const isTotal = row.id === "total";
    const lead = isTotal
      ? [row.label || "Total", "", ...(pageCol ? [""] : [])]
      : [
          row.sl ? String(row.sl) : "",
          row.label,
          ...(pageCol ? [row.pageNo] : []),
        ];

    if (table.kind === "tag") {
      return [
        ...lead,
        cell(row.manpower),
        cell(isCd ? (row.tagDays.CD ?? 0) : officialFrDays(row.tagDays)),
        ...(table.remarks ? [""] : []),
      ];
    }

    if (table.kind === "leave") {
      return [
        ...lead,
        ...(table.showManpower ? [cell(row.manpower)] : []),
        cell(row.tagDays.CL ?? 0),
        cell(row.tagDays.JL ?? 0),
        cell(row.tagDays.TRG ?? 0),
        cell(officialWitDays(row.tagDays)),
        cell(officialMedDays(row.tagDays)),
        cell(officialBghDays(row.tagDays)),
        cell(officialLnkDays(row.tagDays)),
        cell(officialLeaveTotal(row.tagDays)),
        ...(table.remarks ? [""] : []),
      ];
    }

    return [
      ...lead,
      cell(row.manpower),
      cell(officialMsDays(row.tagDays)),
      cell(officialFrDays(row.tagDays)),
      cell(row.tagDays.CL ?? 0),
      cell(row.tagDays.JL ?? 0),
      cell(row.tagDays.CD ?? 0),
      cell(row.tagDays.TRG ?? 0),
      cell(officialWitDays(row.tagDays)),
      cell(officialMedDays(row.tagDays)),
      cell(officialBghDays(row.tagDays)),
      cell(officialLnkDays(row.tagDays)),
      cell(officialWrDays(row.tagDays)),
      cell(row.totalDays),
      ...(table.remarks ? [""] : []),
    ];
  });
}

function tableHead(table: OfficialConsumeTable) {
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  const wing = table.kind === "consume-pages" ? "Page no" : "Wing";
  const lead = ["SL", wing, ...(pageCol ? ["Page no"] : [])];
  const isCd = (table.tagLabel ?? "").toUpperCase().includes("CD");

  if (table.kind === "tag") {
    return [
      ...lead,
      "Manpower",
      table.tagLabel ?? (isCd ? "Total CD" : "Total FR"),
      ...(table.remarks ? ["Remarks"] : []),
    ];
  }
  if (table.kind === "leave") {
    return [
      ...lead,
      ...(table.showManpower ? ["Manpower"] : []),
      "CL",
      "JL",
      "TRG",
      "WT",
      "MED",
      "BGH",
      "LNK",
      "Total",
      ...(table.remarks ? ["Remarks"] : []),
    ];
  }
  return [
    ...lead,
    "Manpower",
    "MS",
    "FR",
    "CL",
    "JL",
    "CD",
    "TRG",
    "WT",
    "MED",
    "BGH",
    "LNK",
    "WR",
    "Total days",
    ...(table.remarks ? ["Remarks"] : []),
  ];
}

function drawOfficialTable(doc: jsPDF, table: OfficialConsumeTable) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  drawUnderlinedCenter(doc, table.title.toUpperCase(), pageW, y);
  y += 5.4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  drawUnderlinedCenter(doc, consumeHqLine().toUpperCase(), pageW, y);
  y += 7;

  const head = tableHead(table);
  const body = tableBody(table);
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  const leadSpan = 2 + (pageCol ? 1 : 0);

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: {
      fontSize: 7,
      cellPadding: 1,
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: 0,
      textColor: 0,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: "bold",
      halign: "center",
      lineColor: 0,
      lineWidth: 0.25,
    },
    theme: "grid",
    margin: { left: 8, right: 8, bottom: 28 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = [...table.rows, table.totals][data.row.index] as
        | OfficialConsumeRow
        | undefined;
      if (row?.id === "total" && data.column.index === 0) {
        data.cell.colSpan = leadSpan;
        data.cell.styles.halign = "left";
        data.cell.styles.fontStyle = "bold";
      }
      if (table.kind !== "consume-pages" && data.column.index === 1) {
        data.cell.styles.halign = "left";
      }
    },
  });

  drawConsumeReportSigns(doc, { pinToPageEnd: true, marginX: 8 });
}

export function downloadOfficialConsumePdf(args: {
  pack?: OfficialConsumePack;
  tables?: OfficialConsumeTable[];
  filename: string;
}) {
  const tables =
    args.tables ??
    args.pack?.pages.flatMap((page) => page.tables) ??
    [];
  if (!tables.length) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  tables.forEach((table, i) => {
    if (i > 0) doc.addPage();
    drawOfficialTable(doc, table);
  });
  doc.save(args.filename);
}
