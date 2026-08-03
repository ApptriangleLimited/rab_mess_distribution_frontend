import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type {
  TagBillRow,
  UserMonthRow,
  WingSummaryRow,
} from "@/lib/reports";

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function downloadTagBillPdf(args: {
  month: string;
  tag: DailyTag;
  tagLabel: string;
  rows: TagBillRow[];
  showFuel: boolean;
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
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
    filename,
  } = args;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFontSize(8);
  doc.text(CONSUME_REPORT_META.formNo, pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(CONSUME_REPORT_META.orgName, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(12);
  doc.text(`${tagLabel} bill — ${month} (${tag})`, pageW / 2, y, {
    align: "center",
  });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Wing: ${CONSUME_REPORT_META.wing}`, 14, y);
  doc.text(`Station: ${CONSUME_REPORT_META.station}`, pageW / 2, y);
  y += 6;

  const head = [
    "Ser",
    "Pers No",
    "Rank",
    "Name",
    tag,
    "Allowance",
    ...(showFuel ? ["Fuel"] : []),
    "Grand total",
    "Remarks",
  ];
  const body = rows.map((r) => [
    String(r.sl),
    r.user.rab_id,
    r.user.rank,
    r.user.name,
    String(r.days),
    amt(r.amount),
    ...(showFuel ? [amt(r.fuelAmount)] : []),
    amt(r.grandTotal),
    r.remarks || "",
  ]);
  const foot = [
    "",
    "",
    "",
    "Total",
    String(totalDays),
    amt(totalAmount),
    ...(showFuel ? [amt(totalFuel)] : []),
    amt(grandTotal),
    "",
  ];

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: [foot],
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  doc.save(filename ?? `consume-bill-${month}-${tag}.pdf`);
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
  y += 6;

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
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Ser",
        "Pers No",
        "Rank",
        "Name",
        "Total days",
        "Allowance days",
        "Amount",
      ],
    ],
    body: rows.map((r, i) => [
      String(i + 1),
      r.user.rab_id,
      r.user.rank,
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
