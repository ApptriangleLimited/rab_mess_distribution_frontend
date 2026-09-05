/** Print letter via dedicated window (Chrome honors @page landscape more reliably). */

export type PrintLetterOptions = {
  /** Keep table fills and grid lines (Pritibhoj and other colored sheets). */
  preserveColors?: boolean;
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

function expandForPrintPage(root: HTMLElement, preserveColors: boolean) {
  flattenPrintSurface(root, true);
  root.style.width = "100%";
  root.style.minWidth = "0";
  root.style.height = "auto";
  root.style.padding = "0";
  root.style.gap = "0";
  root.style.display = "block";

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const keepFill = preserveColors && TABLE_TAGS.has(node.tagName);
    flattenPrintSurface(node, !keepFill);
    node.style.maxWidth = "none";
    if (keepFill) node.style.position = "static";
    if (node.tagName === "TABLE" || node.tagName === "SECTION") {
      node.style.width = "100%";
      node.style.minWidth = "0";
    }
  });
}

function pageCssSize(orientation: "portrait" | "landscape") {
  return orientation === "landscape"
    ? { w: "297mm", h: "210mm", page: "A4 landscape" }
    : { w: "210mm", h: "297mm", page: "A4 portrait" };
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
  .pritibhoj-table td:nth-child(n+3) { width: 7.27%; }`;
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

function buildPrintHtml(
  orientation: "portrait" | "landscape",
  preserveColors: boolean,
) {
  const { w, h, page } = pageCssSize(orientation);
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
    color: #111 !important;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * {
    box-shadow: none !important;
    filter: none !important;
    color: #111 !important;
    box-sizing: border-box;
  }
  table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; border-collapse: collapse; table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: anywhere; }
  ${preserveColors ? colorSheetCss() : ""}
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
      preserveColors
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
) {
  const { h } = pageCssSize(orientation);
  const clone = el.cloneNode(true) as HTMLElement;
  inlineComputedStyles(el, clone, preserveColors);
  clone.querySelectorAll(".no-print").forEach((node) => node.remove());
  expandForPrintPage(clone, preserveColors);

  if (clone.dataset.printStack === "true") {
    const pages = Array.from(clone.children);
    pages.forEach((kid, i) => {
      if (!(kid instanceof HTMLElement)) return;
      kid.className = "print-page";
      flattenPrintSurface(kid, true);
      const last = i === pages.length - 1;
      kid.style.width = "100%";
      kid.style.maxWidth = "100%";
      kid.style.minHeight = `calc(${h} - 16mm)`;
      kid.style.boxSizing = "border-box";
      kid.style.padding = "0";
      kid.style.pageBreakAfter = last ? "auto" : "always";
      kid.style.breakAfter = last ? "auto" : "page";
      kid.style.pageBreakInside = "avoid";
      kid.style.breakInside = "avoid";
    });
    clone.style.width = "100%";
    clone.style.maxWidth = "100%";
    clone.style.display = "block";
    clone.style.gap = "0";
  } else {
    clone.className = preserveColors
      ? `${clone.className} print-page`.trim()
      : "print-page";
    flattenPrintSurface(clone, !preserveColors);
    clone.style.width = "100%";
    clone.style.maxWidth = "100%";
    clone.style.minHeight = `calc(${h} - 16mm)`;
    clone.style.boxSizing = "border-box";
    clone.style.padding = "0";
  }

  return clone;
}

export async function printLetterElement(
  el: HTMLElement,
  _filename = "letter.pdf",
  orientation: "portrait" | "landscape" = "landscape",
  options: PrintLetterOptions = {},
) {
  const preserveColors = Boolean(options.preserveColors);
  const prevMax = el.style.maxHeight;
  const prevOverflow = el.style.overflow;
  el.style.maxHeight = "none";
  el.style.overflow = "visible";

  const { w, h } = pageCssSize(orientation);
  const html = buildPrintHtml(orientation, preserveColors);
  const clone = prepareClone(el, orientation, preserveColors);

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
      printWin.document.body.appendChild(
        printWin.document.importNode(clone, true),
      );
      await waitForPaint(printWin);
      await new Promise<void>((resolve) => {
        printWin.setTimeout(() => resolve(), 200);
      });
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
    doc.body.appendChild(doc.importNode(clone, true));
    await waitForPaint(win);
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 200);
    });
    await printAndWait(win);
    iframe.remove();
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
  }
}
