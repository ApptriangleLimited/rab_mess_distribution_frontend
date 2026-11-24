import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CONSUME_REPORT_META } from "@/lib/constants";

export type TagRequestPdfRow = string[];

function generatedOnLabel(now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Generated on: ${date} at ${time}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function downloadTagRequestPdf({
  title,
  headers,
  rows,
  filename,
}: {
  title: string;
  headers: string[];
  rows: TagRequestPdfRow[];
  filename?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(CONSUME_REPORT_META.orgName, pageW / 2, 12, { align: "center" });
  doc.setFontSize(14);
  doc.text(title, pageW / 2, 19, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(generatedOnLabel(), pageW / 2, 25, { align: "center" });
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows.length
      ? rows
      : [headers.map((_, i) => (i === 0 ? "—" : ""))],
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      valign: "middle",
      halign: "center",
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [32, 32, 32],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: { 0: { cellWidth: 12 } },
    margin: { left: 8, right: 8 },
  });
  doc.save(filename ?? "tag-requests.pdf");
}

export function printTagRequestList({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: TagRequestPdfRow[];
}) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) {
    frame.remove();
    return;
  }
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: sans-serif; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
      p { font-size: 12px; margin: 0 0 10px; text-align: center; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: center; font-size: 10px; }
      th { background: #202020; color: #fff; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(generatedOnLabel())}</p>
    <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${body || `<tr><td colspan="${headers.length}">—</td></tr>`}</tbody></table>
    </body></html>`);
  doc.close();
  view.addEventListener("afterprint", () => frame.remove(), { once: true });
  window.setTimeout(() => {
    view.focus();
    view.print();
  }, 250);
}
