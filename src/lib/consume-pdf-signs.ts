import type { jsPDF } from "jspdf";

const CONSUME_REPORT_SIGNS = [
  ["Daily SI"],
  ["Consume SI"],
  ["Senior DAD (Admin)"],
  ["President", "Mess Committee, Forces Mess"],
  ["Major", "Deputy Director (HQ)", "SRB Forces Headquarters"],
] as const;

/** Ledger print-preview signs: first four centered, last two left under the line. */
export function drawConsumeReportSigns(
  doc: jsPDF,
  opts?: { afterY?: number; pinToPageEnd?: boolean; marginX?: number },
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = opts?.marginX ?? 6;
  const signBlockH = 20;
  let after = opts?.pinToPageEnd !== false && opts?.afterY == null
    ? pageH - 10 - signBlockH
    : (opts?.afterY ?? pageH - 10 - signBlockH);
  if (opts?.afterY != null && !opts.pinToPageEnd && after + signBlockH > pageH - 8) {
    doc.addPage();
    after = 16;
  }
  const usable = pageW - marginX * 2;
  const colW = usable / CONSUME_REPORT_SIGNS.length;
  const lineW = Math.min(colW * 0.72, 31.75);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setDrawColor(17);
  doc.setLineWidth(0.25);
  CONSUME_REPORT_SIGNS.forEach((lines, i) => {
    const colLeft = marginX + colW * i;
    const center = colLeft + colW / 2;
    const leftAlign = i >= CONSUME_REPORT_SIGNS.length - 2;
    const lineStart = leftAlign ? colLeft + 1.5 : center - lineW / 2;
    doc.line(lineStart, after, lineStart + lineW, after);
    lines.forEach((line, li) => {
      doc.text(line, leftAlign ? lineStart : center, after + 3.4 + li * 3.05, {
        align: leftAlign ? "left" : "center",
      });
    });
  });
}

export function drawUnderlinedCenter(
  doc: jsPDF,
  text: string,
  pageW: number,
  y: number,
) {
  doc.text(text, pageW / 2, y, { align: "center" });
  const w = doc.getTextWidth(text);
  doc.setDrawColor(17);
  doc.setLineWidth(0.28);
  doc.line((pageW - w) / 2, y + 1.1, (pageW + w) / 2, y + 1.1);
}
