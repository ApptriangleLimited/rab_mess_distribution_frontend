import { jsPDF } from "jspdf";

function saveCanvasPdf(
  canvas: HTMLCanvasElement,
  filename: string,
  orientation: "portrait" | "landscape",
) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let heightLeft = imgH;
  let position = 0;
  doc.addImage(imgData, "JPEG", 0, position, imgW, imgH, undefined, "FAST");
  heightLeft -= pageH;
  while (heightLeft > 0.4) {
    position -= pageH;
    doc.addPage();
    doc.addImage(imgData, "JPEG", 0, position, imgW, imgH, undefined, "FAST");
    heightLeft -= pageH;
  }

  const stem = filename.replace(/[^\w.-]+/g, "-");
  doc.save(stem.endsWith(".pdf") ? stem : `${stem}.pdf`);
}

function setPaint(
  ctx: CanvasRenderingContext2D,
  value: string,
  fallback: string,
) {
  ctx.fillStyle = fallback;
  ctx.strokeStyle = fallback;
  try {
    ctx.fillStyle = value;
    ctx.strokeStyle = value;
  } catch {
    /* keep fallback — oklch can fail on older canvas */
  }
}

function originOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function skipNode(el: HTMLElement) {
  if (el.classList.contains("no-print")) return true;
  const cs = getComputedStyle(el);
  return cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0";
}

function paintBox(
  ctx: CanvasRenderingContext2D,
  box: DOMRect,
  origin: { x: number; y: number },
  cs: CSSStyleDeclaration,
) {
  const x = box.left - origin.x;
  const y = box.top - origin.y;
  const w = box.width;
  const h = box.height;
  if (w <= 0 || h <= 0) return;

  const bg = cs.backgroundColor;
  if (bg && bg !== "transparent" && !bg.includes("0)") && bg !== "rgba(0, 0, 0, 0)") {
    setPaint(ctx, bg, "#ffffff");
    ctx.fillRect(x, y, w, h);
  }

  const sides: Array<{
    width: string;
    color: string;
    draw: () => void;
  }> = [
    {
      width: cs.borderTopWidth,
      color: cs.borderTopColor,
      draw: () => {
        const t = parseFloat(cs.borderTopWidth) || 0;
        if (t <= 0) return;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x, y + t / 2);
        ctx.lineTo(x + w, y + t / 2);
        ctx.stroke();
      },
    },
    {
      width: cs.borderRightWidth,
      color: cs.borderRightColor,
      draw: () => {
        const t = parseFloat(cs.borderRightWidth) || 0;
        if (t <= 0) return;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x + w - t / 2, y);
        ctx.lineTo(x + w - t / 2, y + h);
        ctx.stroke();
      },
    },
    {
      width: cs.borderBottomWidth,
      color: cs.borderBottomColor,
      draw: () => {
        const t = parseFloat(cs.borderBottomWidth) || 0;
        if (t <= 0) return;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x, y + h - t / 2);
        ctx.lineTo(x + w, y + h - t / 2);
        ctx.stroke();
      },
    },
    {
      width: cs.borderLeftWidth,
      color: cs.borderLeftColor,
      draw: () => {
        const t = parseFloat(cs.borderLeftWidth) || 0;
        if (t <= 0) return;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x + t / 2, y);
        ctx.lineTo(x + t / 2, y + h);
        ctx.stroke();
      },
    },
  ];
  for (const side of sides) {
    if ((parseFloat(side.width) || 0) <= 0) continue;
    setPaint(ctx, side.color, "#111111");
    side.draw();
  }
}

function paintText(
  ctx: CanvasRenderingContext2D,
  node: Text,
  origin: { x: number; y: number },
) {
  const raw = node.textContent ?? "";
  const text = raw.replace(/\s+/g, " ");
  if (!text.trim()) return;
  const parent = node.parentElement;
  if (!parent) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  const box = range.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;

  const cs = getComputedStyle(parent);
  const size = cs.fontSize || "12px";
  const weight = cs.fontWeight || "400";
  const style = cs.fontStyle || "normal";
  ctx.save();
  setPaint(ctx, cs.color, "#111111");
  ctx.font = `${style} ${weight} ${size} ${cs.fontFamily}, "Nirmala UI", "Noto Sans Bengali", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const x = box.left - origin.x;
  const y = box.top - origin.y + box.height / 2;

  const rotate = parent.closest(".manpower-verified-watermark");
  if (rotate) {
    const wr = rotate.getBoundingClientRect();
    const cx = wr.left - origin.x + wr.width / 2;
    const cy = wr.top - origin.y + wr.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((-32 * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.fillText(text.trim(), 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

function walk(
  node: Node,
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number },
) {
  if (node.nodeType === Node.TEXT_NODE) {
    paintText(ctx, node as Text, origin);
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  if (skipNode(node)) return;
  const cs = getComputedStyle(node);
  paintBox(ctx, node.getBoundingClientRect(), origin, cs);
  for (const child of Array.from(node.childNodes)) {
    walk(child, ctx, origin);
  }
}

/** Paint the live letter with the browser text engine (keeps Bangla shaping). */
async function rasterizeLetter(el: HTMLElement) {
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const origin = originOf(el);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(origin.w * scale));
  canvas.height = Math.max(1, Math.ceil(origin.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, origin.w, origin.h);
  walk(el, ctx, origin);
  return canvas;
}

/** Snapshot the live letter — same layout as print preview. */
export async function downloadLetterElementPdf(
  el: HTMLElement,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
) {
  const pageWidth = orientation === "landscape" ? "297mm" : "210mm";
  const prev = {
    maxHeight: el.style.maxHeight,
    overflow: el.style.overflow,
    width: el.style.width,
    minWidth: el.style.minWidth,
    maxWidth: el.style.maxWidth,
    background: el.style.background,
    boxShadow: el.style.boxShadow,
  };
  el.style.maxHeight = "none";
  el.style.overflow = "visible";
  el.style.width = pageWidth;
  el.style.minWidth = pageWidth;
  el.style.maxWidth = pageWidth;
  el.style.background = "#ffffff";
  el.style.boxShadow = "none";

  try {
    const canvas = await rasterizeLetter(el);
    saveCanvasPdf(canvas, filename, orientation);
  } finally {
    el.style.maxHeight = prev.maxHeight;
    el.style.overflow = prev.overflow;
    el.style.width = prev.width;
    el.style.minWidth = prev.minWidth;
    el.style.maxWidth = prev.maxWidth;
    el.style.background = prev.background;
    el.style.boxShadow = prev.boxShadow;
  }
}

export function manpowerPdfFilename(
  form: "1" | "2" | "3" | "4",
  date: string,
  filterWing = "all",
) {
  const wingPart =
    form === "4" && filterWing && filterWing !== "all" ? `-${filterWing}` : "";
  return `manpower-form${form}${wingPart}-${date}.pdf`.replace(/[^\w.-]+/g, "-");
}
