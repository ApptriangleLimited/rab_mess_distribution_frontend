/** Print letter node via blank iframe (no html2canvas / lab() crash). */

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
        prop === "min-height"
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

function expandForPrintPage(root: HTMLElement) {
  root.style.width = "100%";
  root.style.maxWidth = "none";
  root.style.minWidth = "0";
  root.style.height = "auto";
  root.style.maxHeight = "none";
  root.style.border = "none";
  root.style.boxShadow = "none";
  root.style.borderRadius = "0";
  root.style.margin = "0";
  root.style.padding = "0";
  root.style.overflow = "visible";
  root.style.background = "#ffffff";

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.style.maxWidth = "none";
    if (node.tagName === "TABLE" || node.tagName === "SECTION") {
      node.style.width = "100%";
    }
  });
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

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error("Print frame unavailable");

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${"\u00A0"}</title>
<style>
  @page { size: A4 ${orientation}; margin: 8mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    width: 100%;
  }
  table { width: 100% !important; border-collapse: collapse; table-layout: fixed; }
  th, td { word-wrap: break-word; overflow-wrap: anywhere; }
</style></head><body></body></html>`,
    );
    doc.close();

    const clone = el.cloneNode(true) as HTMLElement;
    inlineComputedStyles(el, clone);
    expandForPrintPage(clone);

    doc.body.appendChild(clone);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    win.focus();
    win.print();
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
    setTimeout(() => iframe.remove(), 1000);
  }
}
