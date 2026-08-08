/** Print letter via dedicated window (Chrome honors @page landscape more reliably). */

function inlineComputedStyles(source: Element, target: Element) {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    const cs = window.getComputedStyle(source);
    const parts: string[] = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i);
      if (!prop) continue;
      if (
        prop.startsWith("animation") ||
        prop.startsWith("transition") ||
        prop.startsWith("offset") ||
        prop === "width" ||
        prop === "max-width" ||
        prop === "min-width" ||
        prop === "height" ||
        prop === "max-height" ||
        prop === "min-height" ||
        prop === "box-shadow" ||
        prop === "border-radius" ||
        prop.startsWith("border") ||
        prop === "margin" ||
        prop.startsWith("margin-") ||
        prop === "outline" ||
        prop.startsWith("outline-") ||
        prop === "filter" ||
        prop === "transform"
      ) {
        continue;
      }
      parts.push(`${prop}:${cs.getPropertyValue(prop)}`);
    }
    target.style.cssText = parts.join(";");
    target.removeAttribute("class");
  }

  const sKids = source.children;
  const tKids = target.children;
  const n = Math.min(sKids.length, tKids.length);
  for (let i = 0; i < n; i++) {
    inlineComputedStyles(sKids[i], tKids[i]);
  }
}

function flattenPrintSurface(node: HTMLElement) {
  node.style.border = "none";
  node.style.boxShadow = "none";
  node.style.borderRadius = "0";
  node.style.outline = "none";
  node.style.filter = "none";
  node.style.transform = "none";
  node.style.margin = "0";
  node.style.background = "#ffffff";
  node.style.overflow = "visible";
  node.style.maxWidth = "none";
  node.style.maxHeight = "none";
}

function expandForPrintPage(root: HTMLElement) {
  flattenPrintSurface(root);
  root.style.width = "100%";
  root.style.minWidth = "0";
  root.style.height = "auto";
  root.style.padding = "0";
  root.style.gap = "0";
  root.style.display = "block";

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    flattenPrintSurface(node);
    node.style.maxWidth = "none";
    if (node.tagName === "TABLE" || node.tagName === "SECTION") {
      node.style.width = "100%";
    }
  });
}

function pageCssSize(orientation: "portrait" | "landscape") {
  return orientation === "landscape"
    ? { w: "297mm", h: "210mm", page: "A4 landscape" }
    : { w: "210mm", h: "297mm", page: "A4 portrait" };
}

function buildPrintHtml(orientation: "portrait" | "landscape") {
  const { w, h, page } = pageCssSize(orientation);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Print</title>
<style>
  @page { size: ${page}; margin: 10mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    width: ${w};
  }
  * { box-shadow: none !important; filter: none !important; }
  table { width: 100% !important; border-collapse: collapse; table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: anywhere; }
  .print-page {
    width: ${w};
    min-height: calc(${h} - 20mm);
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    background: #fff;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
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
) {
  const { w, h } = pageCssSize(orientation);
  const clone = el.cloneNode(true) as HTMLElement;
  inlineComputedStyles(el, clone);
  expandForPrintPage(clone);

  if (clone.dataset.printStack === "true") {
    const pages = Array.from(clone.children);
    pages.forEach((kid, i) => {
      if (!(kid instanceof HTMLElement)) return;
      kid.className = "print-page";
      flattenPrintSurface(kid);
      const last = i === pages.length - 1;
      kid.style.width = w;
      kid.style.minHeight = `calc(${h} - 20mm)`;
      kid.style.boxSizing = "border-box";
      kid.style.padding = "0";
      kid.style.pageBreakAfter = last ? "auto" : "always";
      kid.style.breakAfter = last ? "auto" : "page";
      kid.style.pageBreakInside = "avoid";
      kid.style.breakInside = "avoid";
    });
    clone.style.width = w;
    clone.style.display = "block";
    clone.style.gap = "0";
  } else {
    clone.className = "print-page";
    flattenPrintSurface(clone);
    clone.style.width = w;
    clone.style.minHeight = `calc(${h} - 20mm)`;
    clone.style.boxSizing = "border-box";
    clone.style.padding = "0";
  }

  return clone;
}

export async function printLetterElement(
  el: HTMLElement,
  _filename = "letter.pdf",
  orientation: "portrait" | "landscape" = "landscape",
) {
  const prevMax = el.style.maxHeight;
  const prevOverflow = el.style.overflow;
  el.style.maxHeight = "none";
  el.style.overflow = "visible";

  const { w, h } = pageCssSize(orientation);
  const html = buildPrintHtml(orientation);
  const clone = prepareClone(el, orientation);

  // Visible popup — Chrome applies @page landscape more reliably than hidden iframe.
  const printWin = window.open(
    "",
    "_blank",
    `noopener,noreferrer,width=${orientation === "landscape" ? 1100 : 800},height=${orientation === "landscape" ? 800 : 1000}`,
  );

  try {
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.document.body.appendChild(clone);

      await new Promise<void>((resolve) => {
        printWin.requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 120);
      });

      printWin.focus();
      printWin.print();
      // Close after dialog — delay so print spool can capture DOM.
      setTimeout(() => {
        try {
          printWin.close();
        } catch {
          /* ignore */
        }
      }, 400);
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
    doc.body.appendChild(clone);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 120);
    });

    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
  }
}
