import { tagPrintCss } from "@/lib/tag-colors";

/** Print letter via dedicated window (Chrome honors @page landscape more reliably). */

export type PrintLetterOptions = {
  /** Keep preview fills, colors, and class styles. Default true. */
  preserveColors?: boolean;
  /** Skip computed-style copy (large registers hang Chrome before print). */
  skipInlineStyles?: boolean;
};

const TABLE_TAGS = new Set([
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TH",
  "TD",
  "CAPTION",
  "COL",
  "COLGROUP",
]);

function skipInlineProp(prop: string, preserveColors: boolean) {
  if (
    prop.startsWith("animation") ||
    prop.startsWith("transition") ||
    prop.startsWith("offset")
  ) {
    return true;
  }
  if (
    prop === "width" ||
    prop === "max-width" ||
    prop === "min-width" ||
    prop === "height" ||
    prop === "max-height" ||
    prop === "min-height" ||
    prop === "box-shadow" ||
    prop === "border-radius" ||
    prop === "margin" ||
    prop.startsWith("margin-") ||
    prop === "outline" ||
    prop.startsWith("outline-") ||
    prop === "filter" ||
    prop === "transform"
  ) {
    return true;
  }
  if (!preserveColors && prop.startsWith("border")) return true;
  return false;
}

function inlineComputedStyles(
  source: Element,
  target: Element,
  preserveColors: boolean,
) {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    const cs = window.getComputedStyle(source);
    const parts: string[] = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i);
      if (!prop || skipInlineProp(prop, preserveColors)) continue;
      parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
    }
    target.style.cssText = parts.join(";");
    if (!preserveColors) target.removeAttribute("class");
  }

  const sKids = source.children;
  const tKids = target.children;
  const n = Math.min(sKids.length, tKids.length);
  for (let i = 0; i < n; i++) {
    inlineComputedStyles(sKids[i], tKids[i], preserveColors);
  }
}

function flattenPrintSurface(node: HTMLElement, wipeFill: boolean) {
  node.style.boxShadow = "none";
  node.style.borderRadius = "0";
  node.style.outline = "none";
  node.style.filter = "none";
  node.style.transform = "none";
  node.style.margin = "0";
  node.style.overflow = "visible";
  node.style.maxWidth = "none";
  node.style.maxHeight = "none";
  if (wipeFill) {
    node.style.border = "none";
    node.style.background = "#ffffff";
  }
}

function keepPrintFill(
  node: HTMLElement,
  preserveColors: boolean,
  skipInlineStyles = false,
) {
  if (preserveColors || skipInlineStyles) return true;
  if (TABLE_TAGS.has(node.tagName)) return true;
  return (
    node.classList.contains("register-cover") ||
    node.classList.contains("register-cover-label") ||
    Boolean(node.closest(".register-cover"))
  );
}

function expandForPrintPage(
  root: HTMLElement,
  preserveColors: boolean,
  skipInlineStyles = false,
) {
  flattenPrintSurface(
    root,
    !root.querySelector(".register-cover") && !skipInlineStyles,
  );
  root.style.width = "100%";
  root.style.minWidth = "0";
  root.style.height = "auto";
  root.style.padding = "0";
  root.style.gap = "0";
  root.style.display = "block";

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const keepFill = keepPrintFill(node, preserveColors, skipInlineStyles);
    flattenPrintSurface(node, !keepFill);
    node.style.maxWidth = "none";
    if (keepFill) node.style.position = "static";
    if (node.tagName === "TABLE" || node.tagName === "SECTION") {
      if (node.classList.contains("force-rank-officer")) {
        node.style.width = "auto";
        node.style.maxWidth = "none";
      } else {
        node.style.width = "100%";
        node.style.minWidth = "0";
      }
    }
    if (node.classList.contains("consume-sign-cell")) {
      node.style.border = "none";
      node.style.background = "transparent";
      node.style.textAlign = "center";
      node.style.verticalAlign = "top";
      node.style.whiteSpace = "normal";
    }
  });
}

function pageCssSize(orientation: "portrait" | "landscape") {
  return orientation === "landscape"
    ? { w: "297mm", h: "210mm", page: "A4 landscape" }
    : { w: "210mm", h: "297mm", page: "A4 portrait" };
}

function letterSheetCss() {
  return `
  table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
  }
  th, td {
    border: 1px solid #111 !important;
    padding: 3px 4px !important;
    color: #111 !important;
    vertical-align: middle;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  thead th, tfoot th, tfoot td {
    font-weight: 600;
    background: #f4f4f4 !important;
  }
  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .month-ledger-print table:not(.consume-sign-off) {
    table-layout: fixed !important;
    width: 100% !important;
  }
  .month-ledger-print .ledger-id,
  .month-ledger-print .ledger-rank,
  .month-ledger-print .ledger-name {
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: clip !important;
  }
  .month-ledger-print th,
  .month-ledger-print td {
    padding: 3px 3px !important;
    font-size: 9px !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
    word-break: keep-all !important;
    white-space: nowrap !important;
  }
  .month-ledger-print td.register-tag {
    font-size: 8px !important;
    font-weight: 700 !important;
    padding: 3px 2px !important;
  }
  .consume-sign-off {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed !important;
    border: none !important;
    margin-top: 28px !important;
  }
  .consume-sign-off td,
  .consume-sign-off .consume-sign-cell {
    border: none !important;
    background: transparent !important;
    text-align: center !important;
    vertical-align: top !important;
    width: 16.66% !important;
    padding: 24px 6px 0 !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    font-weight: 400 !important;
  }
  .consume-sign-off .consume-sign-line {
    width: 72% !important;
    max-width: 7.5rem !important;
    height: 1px !important;
    margin: 0 auto 6px !important;
    background: #111 !important;
  }
  .consume-sign-off .consume-sign-label {
    line-height: 1.25 !important;
    text-align: center !important;
  }
  .transfer-sheet-print th,
  .transfer-sheet-print td {
    padding: 1px 2px !important;
    font-size: 8px !important;
  }
  .tag-bill-print th,
  .tag-bill-print td,
  .staff-payout-print th,
  .staff-payout-print td,
  .mess-reports-letter th,
  .mess-reports-letter td,
  .official-consume-letter th,
  .official-consume-letter td,
  .wing-summary-print th,
  .wing-summary-print td {
    font-size: 10px !important;
  }
  .manpower-letter,
  .strength-letter {
    width: 100% !important;
    max-width: 100% !important;
  }
  .manpower-letter table,
  .strength-letter table {
    table-layout: fixed !important;
    width: 100% !important;
  }
  .manpower-letter th,
  .manpower-letter td,
  .strength-letter th,
  .strength-letter td {
    padding: 1px 1px !important;
    font-size: 7.5px !important;
    line-height: 1.15 !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    white-space: normal !important;
  }
  .force-rank-letter {
    width: 100% !important;
    max-width: 100% !important;
  }
  .force-rank-letter .force-rank-header {
    display: grid !important;
    grid-template-columns: 1fr auto 1fr !important;
    align-items: start !important;
    gap: 8px !important;
    margin-bottom: 6px !important;
  }
  .force-rank-letter .force-rank-titles {
    text-align: center !important;
  }
  .force-rank-letter .force-rank-date {
    text-align: right !important;
    white-space: nowrap !important;
  }
  .force-rank-letter table.force-rank-main {
    width: 100% !important;
    table-layout: auto !important;
  }
  .force-rank-letter table.force-rank-officer {
    width: auto !important;
    max-width: none !important;
  }
  .force-rank-letter table.force-rank-footer {
    width: 100% !important;
    border: none !important;
    margin-top: 8px !important;
  }
  .force-rank-letter table.force-rank-footer > tbody > tr > td {
    border: none !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .force-rank-letter .force-rank-grand {
    border: none !important;
    text-align: right !important;
    vertical-align: bottom !important;
    white-space: nowrap !important;
    font-weight: 700 !important;
  }`;
}

function colorSheetCss() {
  return `
  html, body, * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .pritibhoj-table th,
  .pritibhoj-table td,
  .pb-cell {
    border: 1px solid #d4d4d4 !important;
  }
  .pb-head,
  .pb-head .pb-cell {
    background-color: #f5f5f5 !important;
  }
  .pb-sky { background-color: #e0f2fe !important; }
  .pb-sky-soft { background-color: #f0f9ff !important; }
  .pb-amber { background-color: #fef3c7 !important; }
  .pb-amber-soft { background-color: #fffbeb !important; }
  .pb-foot td,
  .pb-foot .pb-cell {
    background-color: #f0f9ff !important;
    font-weight: 600;
  }
  .pb-foot .pb-sky { background-color: #e0f2fe !important; }
  .pb-foot .pb-amber { background-color: #fef3c7 !important; }
  .pb-grand td {
    background-color: #e0f2fe !important;
    font-weight: 700;
  }
  .pritibhoj-sheets,
  .pritibhoj-sheets * {
    max-width: 100% !important;
    min-width: 0 !important;
  }
  .pritibhoj-sheets {
    width: 100% !important;
    overflow: visible !important;
  }
  .pritibhoj-sheets section {
    page-break-inside: avoid;
    break-inside: avoid;
    margin-bottom: 6mm;
    overflow: visible !important;
  }
  .pritibhoj-table {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    border: 1px solid #d4d4d4 !important;
    border-collapse: collapse !important;
  }
  .pritibhoj-table th,
  .pritibhoj-table td,
  .pb-cell {
    box-sizing: border-box !important;
    padding: 3px 2px !important;
    font-size: 8.5px !important;
    line-height: 1.25 !important;
    overflow: hidden !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
  .pritibhoj-table th:nth-child(1),
  .pritibhoj-table td:nth-child(1) { width: 4%; }
  .pritibhoj-table th:nth-child(2),
  .pritibhoj-table td:nth-child(2) { width: 16%; }
  .pritibhoj-table th:nth-child(n+3),
  .pritibhoj-table td:nth-child(n+3) { width: 7.27%; }
  .register-cover {
    background: #f4e25a !important;
    min-height: calc(210mm - 16mm);
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .register-cover-label {
    background: #fff !important;
    color: #000 !important;
    border: 3px double #000 !important;
    padding: 16mm 18mm !important;
    text-align: center !important;
  }
  .register-cover-title,
  .register-cover-month {
    color: #000 !important;
  }
  .register-sheet {
    page-break-before: always;
    break-before: page;
    background: #fff !important;
  }
  .month-register-print table,
  .register-sheet table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .month-register-print th,
  .month-register-print td,
  .register-sheet th,
  .register-sheet td {
    border: 1px solid #000 !important;
    padding: 1px 2px !important;
  }
  .month-register-print thead th,
  .register-sheet thead th {
    background: #f4f4f4 !important;
    color: #000 !important;
  }
  .month-register-print td:not(.register-tag),
  .register-sheet td:not(.register-tag) {
    background: #fff !important;
    color: #000 !important;
  }
  .month-register-print td.register-tag,
  .register-sheet td.register-tag {
    font-weight: 700 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  }
  .register-sheet tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }`;
}

function waitForPaint(win: Window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });
}

function printAndWait(win: Window) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      win.removeEventListener("afterprint", finish);
      resolve();
    };
    win.addEventListener("afterprint", finish);
    win.focus();
    win.print();
    // Some browsers skip afterprint if the dialog is dismissed instantly.
    win.setTimeout(finish, 120_000);
  });
}

function previewMatchCss() {
  return `
  html, body, * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print { display: none !important; }
  td.register-tag,
  td.register-tag * {
    color: inherit !important;
  }
  ${colorSheetCss()}
  ${tagPrintCss()}
  ${letterSheetCss()}
  `;
}

function copyDocumentStyles(fromDoc: Document, toDoc: Document) {
  fromDoc.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
    toDoc.head.appendChild(toDoc.importNode(node, true));
  });
}

async function waitForPrintAssets(win: Window) {
  await waitForPaint(win);
  try {
    await win.document.fonts.ready;
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => {
    win.setTimeout(() => resolve(), 250);
  });
}

function buildPrintHtml(
  orientation: "portrait" | "landscape",
  preserveColors: boolean,
  skipInlineStyles: boolean,
) {
  const { w, h, page } = pageCssSize(orientation);
  const allowFlow = preserveColors || skipInlineStyles;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<title>Print</title>
<style>
  html { color-scheme: light; }
  @page { size: ${page}; margin: 8mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff !important;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  ${
    preserveColors
      ? previewMatchCss()
      : `
  * {
    box-shadow: none !important;
    filter: none !important;
    color: #111 !important;
    box-sizing: border-box;
  }
  td.register-tag,
  td.register-tag * {
    color: inherit !important;
  }
  table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; border-collapse: collapse; table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: anywhere; }
  ${letterSheetCss()}
  `
  }
  .print-page {
    width: 100%;
    max-width: 100%;
    min-height: calc(${h} - 16mm);
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    overflow: visible;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    background: #fff;
    ${
      allowFlow
        ? `page-break-after: auto;
    break-after: auto;
    page-break-inside: auto;
    break-inside: auto;`
        : `page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;`
    }
  }
  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
</style></head><body></body></html>`;
}

function prepareClone(
  el: HTMLElement,
  orientation: "portrait" | "landscape",
  preserveColors: boolean,
  skipInlineStyles: boolean,
) {
  const { h } = pageCssSize(orientation);
  const clone = el.cloneNode(true) as HTMLElement;
  if (!skipInlineStyles) {
    inlineComputedStyles(el, clone, preserveColors);
  }
  clone.querySelectorAll(".no-print").forEach((node) => node.remove());
  clone.classList.remove("hidden");
  expandForPrintPage(clone, preserveColors, skipInlineStyles);

  if (clone.dataset.printStack === "true") {
    const pages = Array.from(clone.children);
    pages.forEach((kid, i) => {
      if (!(kid instanceof HTMLElement)) return;
      kid.classList.add("print-page");
      const keepFill = keepPrintFill(kid, preserveColors);
      flattenPrintSurface(kid, !keepFill);
      const last = i === pages.length - 1;
      const allowFlow =
        kid.classList.contains("register-sheet") ||
        Boolean(kid.querySelector("table"));
      kid.style.width = "100%";
      kid.style.maxWidth = "100%";
      kid.style.minHeight = `calc(${h} - 16mm)`;
      kid.style.boxSizing = "border-box";
      kid.style.padding = "0";
      kid.style.pageBreakAfter = last ? "auto" : "always";
      kid.style.breakAfter = last ? "auto" : "page";
      kid.style.pageBreakInside = allowFlow ? "auto" : "avoid";
      kid.style.breakInside = allowFlow ? "auto" : "avoid";
    });
    clone.style.width = "100%";
    clone.style.maxWidth = "100%";
    clone.style.display = "block";
    clone.style.gap = "0";
  } else {
    clone.className =
      preserveColors || skipInlineStyles
        ? `${clone.className} print-page`.trim()
        : "print-page";
    flattenPrintSurface(clone, !(preserveColors || skipInlineStyles));
    clone.style.width = "100%";
    clone.style.maxWidth = "100%";
    clone.style.minHeight = `calc(${h} - 16mm)`;
    clone.style.boxSizing = "border-box";
    clone.style.padding = "0";
  }

  return clone;
}

const LARGE_LETTER_SELECTOR = [
  ".month-register-print",
  ".register-cover",
  ".month-ledger-print",
  ".tag-bill-print",
  ".wing-summary-print",
  ".staff-payout-print",
  ".transfer-sheet-print",
  ".mess-reports-letter",
  ".member-list-letter",
  ".official-consume-letter",
  ".manpower-letter",
  ".strength-letter",
  ".force-rank-letter",
].join(", ");

function shouldSkipInlineStyles(el: HTMLElement, options: PrintLetterOptions) {
  if (options.skipInlineStyles) return true;
  return (
    el.matches(LARGE_LETTER_SELECTOR) ||
    Boolean(el.querySelector(LARGE_LETTER_SELECTOR))
  );
}

export async function printLetterElement(
  el: HTMLElement,
  _filename = "letter.pdf",
  orientation: "portrait" | "landscape" = "landscape",
  options: PrintLetterOptions = {},
) {
  const preserveColors = options.preserveColors !== false;
  const skipInlineStyles = shouldSkipInlineStyles(el, options);
  const prevMax = el.style.maxHeight;
  const prevOverflow = el.style.overflow;
  el.style.maxHeight = "none";
  el.style.overflow = "visible";

  const { w, h } = pageCssSize(orientation);
  const html = buildPrintHtml(orientation, preserveColors, skipInlineStyles);
  const clone = prepareClone(el, orientation, preserveColors, skipInlineStyles);

  // Do not use noopener — Chrome then returns null and leaves an empty about:blank.
  const printWin = window.open(
    "",
    "mess-print",
    `width=${orientation === "landscape" ? 1100 : 800},height=${orientation === "landscape" ? 800 : 1000}`,
  );

  try {
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      if (preserveColors) copyDocumentStyles(document, printWin.document);
      printWin.document.body.appendChild(
        printWin.document.importNode(clone, true),
      );
      await waitForPrintAssets(printWin);
      await printAndWait(printWin);
      try {
        printWin.close();
      } catch {
        /* ignore */
      }
      return;
    }

    // Popup blocked → iframe fallback
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: w,
      height: h,
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error("Print frame unavailable");

    doc.open();
    doc.write(html);
    doc.close();
    if (preserveColors) copyDocumentStyles(document, doc);
    doc.body.appendChild(doc.importNode(clone, true));
    await waitForPrintAssets(win);
    await printAndWait(win);
    iframe.remove();
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
  }
}
