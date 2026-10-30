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

const BANK_LETTER_SELECTOR = [
  ".trust-bank-letter",
  ".community-bank-letter",
  ".sonali-bank-letter",
  ".fr-transfer-letter",
].join(", ");

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
    if (node.closest(".manpower-verified-watermark")) return;
    if (node.closest(BANK_LETTER_SELECTOR)) {
      if (node.tagName === "TABLE") {
        node.style.width = "100%";
        node.style.maxWidth = "100%";
      }
      return;
    }
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

function consumePrintRoot(node: HTMLElement) {
  return Boolean(
    node.closest(
      [
        ".official-consume-letter",
        ".official-consume-page",
        ".tag-bill-print",
        ".leave-med-bill-print",
        ".wing-food-list-print",
        ".wing-summary-print",
        ".month-ledger-print",
        ".manpower-letter",
        ".strength-letter",
      ].join(", "),
    ),
  );
}

function letterSheetCss() {
  return `
  table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
  }
  th, td {
    border: 1.5px solid #000 !important;
    padding: 3px 4px !important;
    color: #000 !important;
    vertical-align: middle;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  thead th, tfoot th, tfoot td {
    font-weight: 800;
    color: #000 !important;
    background: #fff !important;
  }
  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .letter-masthead {
    margin-bottom: 24px !important;
  }
  .letter-masthead p {
    white-space: normal !important;
    word-spacing: normal !important;
    letter-spacing: normal !important;
  }
  .trust-bank-letter,
  .community-bank-letter,
  .sonali-bank-letter,
  .fr-transfer-letter {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    padding: 4mm 0 !important;
    overflow: visible !important;
  }
  .trust-bank-letter p,
  .community-bank-letter p,
  .sonali-bank-letter p,
  .fr-transfer-letter p {
    white-space: normal !important;
    word-spacing: normal !important;
    letter-spacing: normal !important;
    overflow-wrap: break-word !important;
    word-break: normal !important;
  }
  .trust-bank-letter table,
  .community-bank-letter table,
  .sonali-bank-letter table,
  .fr-transfer-letter table {
    table-layout: auto !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  .trust-bank-letter thead,
  .community-bank-letter thead,
  .sonali-bank-letter thead,
  .fr-transfer-letter thead {
    display: table-row-group !important;
  }
  .trust-bank-letter th,
  .trust-bank-letter td,
  .community-bank-letter th,
  .community-bank-letter td,
  .sonali-bank-letter th,
  .sonali-bank-letter td,
  .fr-transfer-letter th,
  .fr-transfer-letter td {
    font-size: 8px !important;
    line-height: 1.2 !important;
    padding: 2px 3px !important;
    white-space: normal !important;
    overflow-wrap: break-word !important;
    word-break: normal !important;
    word-wrap: break-word !important;
    text-align: left !important;
    vertical-align: middle !important;
  }
  .trust-bank-letter .beftn-ser,
  .community-bank-letter .beftn-ser,
  .sonali-bank-letter .beftn-ser {
    width: 7.5mm !important;
    max-width: 7.5mm !important;
    padding-left: 1px !important;
    padding-right: 1px !important;
  }
  .trust-bank-letter .beftn-ref,
  .community-bank-letter .beftn-ref,
  .sonali-bank-letter .beftn-ref {
    width: 34mm !important;
    min-width: 34mm !important;
    white-space: nowrap !important;
    overflow-wrap: normal !important;
    word-break: keep-all !important;
  }
  .trust-bank-letter .text-center,
  .community-bank-letter .text-center,
  .sonali-bank-letter .text-center,
  .fr-transfer-letter .text-center {
    text-align: center !important;
  }
  .trust-bank-letter .text-right,
  .community-bank-letter .text-right,
  .sonali-bank-letter .text-right,
  .fr-transfer-letter .text-right {
    text-align: right !important;
  }
  .beftn-letter-page {
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    page-break-after: always !important;
    break-after: page !important;
  }
  .beftn-letter-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  .beftn-page-no {
    display: block !important;
    margin-top: 8px !important;
    padding-top: 4px !important;
    text-align: right !important;
    font-size: 10px !important;
    line-height: 1 !important;
  }
  .month-ledger-print .letter-masthead {
    margin-bottom: 8px !important;
  }
  .tag-bill-print .letter-masthead,
  .leave-med-bill-print .letter-masthead,
  .month-register-print .letter-masthead {
    margin-bottom: 24px !important;
  }
  .official-consume-letter .official-consume-page,
  .official-consume-letter .print-page {
    display: block !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    min-height: 0 !important;
    height: auto !important;
    max-height: none !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .official-consume-letter thead {
    display: table-header-group !important;
  }
  .official-consume-letter thead tr.official-title-row th,
  .official-consume-letter .official-title-cell {
    border: none !important;
    background: #fff !important;
    text-align: center !important;
    padding: 0 0 8px 0 !important;
    font-weight: 700 !important;
  }
  .official-consume-letter .consume-bill-signs,
  .official-consume-letter .consume-sign-off {
    margin-top: 16mm !important;
    page-break-before: avoid !important;
    break-before: avoid !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .official-consume-letter .official-consume-page:last-child,
  .official-consume-letter .print-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  .consume-wing-break {
    page-break-before: always !important;
    break-before: page !important;
  }
  .tag-bill-print,
  .leave-med-bill-print,
  .wing-food-list-print,
  .wing-summary-print,
  .month-ledger-print {
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    min-height: 0 !important;
    height: auto !important;
  }
  .official-consume-letter > header,
  .wing-food-list-print > header,
  .wing-food-list-print .letter-masthead,
  .wing-summary-print > header,
  .mess-reports-letter > header,
  .transfer-sheet-print header,
  .member-list-letter > header,
  .state-report-letter header {
    margin-bottom: 22px !important;
  }
  .month-ledger-print .letter-masthead p {
    margin: 0 !important;
    white-space: normal !important;
    word-spacing: normal !important;
  }
  .month-ledger-print .letter-masthead p.ledger-title {
    margin: 0 !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    line-height: 1.15 !important;
  }
  .month-ledger-print .letter-masthead p.ledger-title + p.ledger-title {
    margin-top: 2px !important;
  }
  .month-ledger-print .letter-masthead p + p {
    margin-top: 2px !important;
  }
  .wing-food-list-print .wing-food-title,
  .wing-food-list-print .wing-food-report-title {
    font-size: 14px !important;
    font-weight: 700 !important;
    line-height: 1.15 !important;
    color: #111 !important;
    margin-top: 2px !important;
  }
  .wing-food-list-print .wing-food-title {
    margin-top: 0 !important;
  }
  .wing-food-list-print .wing-food-hq {
    font-size: 9px !important;
    font-weight: 400 !important;
    color: #9ca3af !important;
    margin-top: 6px !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .consume-masthead.letter-masthead p,
  .month-ledger-print .consume-masthead p,
  .official-consume-letter .consume-masthead.letter-masthead p,
  .wing-food-list-print .consume-masthead p,
  .wing-food-list-print .consume-masthead .wing-food-hq,
  .wing-summary-print .consume-masthead p {
    text-transform: uppercase !important;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
    color: #111 !important;
  }
  .month-ledger-print table:not(.consume-sign-off) {
    table-layout: fixed !important;
    width: 100% !important;
  }
  .month-ledger-print th.ledger-srb,
  .month-ledger-print th.ledger-id {
    text-align: left !important;
  }
  .month-ledger-print td.ledger-srb,
  .consume-ledger-en td.ledger-id {
    font-size: 5.5px !important;
  }
  .consume-ledger-en th.ledger-tag-3 {
    font-size: 5.5px !important;
  }
  .consume-ledger-en td.register-tag.ledger-tag-3 {
    font-size: 5px !important;
  }
  .month-ledger-print .ledger-id,
  .month-ledger-print .ledger-srb,
  .month-ledger-print .ledger-rank {
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: clip !important;
  }
  .month-ledger-print .ledger-name {
    overflow: visible !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    text-overflow: clip !important;
    line-height: 1.15 !important;
  }
  .month-ledger-print th,
  .month-ledger-print td {
    padding: 2px 1px !important;
    font-size: 8px !important;
    overflow: hidden !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
    word-break: keep-all !important;
    white-space: nowrap !important;
  }
  .month-ledger-print td.register-tag {
    font-size: 6px !important;
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
  .official-consume-letter .consume-bill-signs .consume-sign-off {
    margin-top: 0 !important;
  }
  .consume-sign-off td,
  .consume-sign-off .consume-sign-cell {
    border: none !important;
    background: transparent !important;
    text-align: center !important;
    vertical-align: top !important;
    width: 20% !important;
    padding: 24px 6px 0 !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    font-weight: 400 !important;
  }
  .consume-sign-off .consume-sign-line {
    width: 72% !important;
    max-width: 7.5rem !important;
    height: 0 !important;
    margin: 0 auto 6px !important;
    background: none !important;
    border: none !important;
    border-top: 1px solid #111 !important;
  }
  .consume-sign-off .consume-sign-label {
    line-height: 1.25 !important;
    text-align: center !important;
  }
  .consume-sign-off td.consume-sign-left,
  .consume-sign-off .consume-sign-left,
  .consume-sign-off .consume-sign-left .consume-sign-label,
  .consume-sign-off .consume-sign-left .consume-sign-label p {
    text-align: left !important;
  }
  .consume-sign-off .consume-sign-left .consume-sign-line {
    margin-left: 0 !important;
    margin-right: auto !important;
  }
  .transfer-sheet-print th,
  .transfer-sheet-print td {
    padding: 1px 2px !important;
    font-size: 8px !important;
  }
  .tag-bill-print th,
  .tag-bill-print td,
  .leave-med-bill-print th,
  .leave-med-bill-print td,
  .staff-payout-print th,
  .staff-payout-print td,
  .mess-reports-letter th,
  .mess-reports-letter td,
  .official-consume-letter table:not(.consume-sign-off) th,
  .official-consume-letter table:not(.consume-sign-off) td,
  .wing-summary-print th,
  .wing-summary-print td {
    font-size: 10px !important;
  }
  .tag-bill-print th,
  .tag-bill-print td,
  .leave-med-bill-print th,
  .leave-med-bill-print td {
    text-align: center !important;
    vertical-align: middle !important;
  }
  .consume-bill-page {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
    height: auto !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  .tag-bill-print .consume-bill-page--signed,
  .leave-med-bill-print .consume-bill-page--signed {
    min-height: 0 !important;
    height: auto !important;
  }
  .tag-bill-print thead,
  .leave-med-bill-print thead {
    display: table-row-group !important;
  }
  .tag-bill-print thead tr.consume-bill-title-row th,
  .leave-med-bill-print thead tr.consume-bill-title-row th,
  .tag-bill-print .consume-bill-title-cell,
  .leave-med-bill-print .consume-bill-title-cell {
    border: none !important;
    background: #fff !important;
    padding: 0 0 4px 0 !important;
    text-align: center !important;
  }
  .tag-bill-print .letter-masthead,
  .leave-med-bill-print .letter-masthead {
    margin-bottom: 3mm !important;
  }
  .consume-bill-sheet {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    height: auto !important;
  }
  .tag-bill-print .consume-bill-signs,
  .leave-med-bill-print .consume-bill-signs {
    margin-top: 10mm !important;
    page-break-before: avoid !important;
    break-before: avoid-page !important;
    flex-shrink: 0 !important;
  }
  .tag-bill-print .consume-masthead,
  .leave-med-bill-print .consume-masthead,
  .consume-bill-page--full .consume-masthead {
    margin-bottom: 3mm !important;
  }
  .tag-bill-print .consume-masthead p,
  .leave-med-bill-print .consume-masthead p,
  .consume-bill-page--full .consume-masthead p {
    margin-top: 0 !important;
  }
  .tag-bill-print table th,
  .tag-bill-print table td,
  .leave-med-bill-print table th,
  .leave-med-bill-print table td,
  .consume-bill-page--full table th,
  .consume-bill-page--full table td {
    padding-top: 1px !important;
    padding-bottom: 1px !important;
    font-size: 8px !important;
    line-height: 1.15 !important;
  }
  .tag-bill-print .consume-sign-off,
  .leave-med-bill-print .consume-sign-off,
  .consume-bill-page--full .consume-sign-off {
    margin-top: 0 !important;
  }
  .tag-bill-print .consume-sign-cell,
  .leave-med-bill-print .consume-sign-cell,
  .consume-bill-page--full .consume-sign-cell {
    padding-top: 8px !important;
  }
  .consume-ledger-page .consume-bill-signs {
    margin-top: auto !important;
  }
  .consume-ledger-page .ledger-page-no {
    display: block !important;
    margin: 4px 0 0 !important;
    text-align: right !important;
    font-size: 6px !important;
    font-weight: 500 !important;
    line-height: 1 !important;
  }
  .consume-ledger-page {
    display: flex !important;
    flex-direction: column !important;
    min-height: 178mm !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  .month-ledger-print tbody td.consume-sl {
    text-align: center !important;
  }
  .tag-bill-print tbody td,
  .tag-bill-print tfoot td,
  .leave-med-bill-print tbody td,
  .leave-med-bill-print tfoot td {
    text-align: left !important;
  }
  .tag-bill-print tbody td.consume-sl,
  .leave-med-bill-print tbody td.consume-sl {
    text-align: center !important;
  }
  .tag-bill-print td.consume-money,
  .tag-bill-print td.consume-num,
  .tag-bill-print td.consume-days,
  .leave-med-bill-print td.consume-money,
  .leave-med-bill-print td.consume-num {
    text-align: right !important;
  }
  .official-consume-letter td.consume-page-no {
    text-align: center !important;
  }
  .official-consume-letter td.consume-wing {
    text-align: left !important;
  }
  .manpower-letter,
  .strength-letter {
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
  }
  .manpower-verified-watermark {
    position: absolute !important;
    inset: 0 !important;
    z-index: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }
  .manpower-verified-watermark > div {
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    width: 140% !important;
    transform: translate(-50%, -50%) rotate(-32deg) !important;
    text-align: center !important;
    font-size: 42mm !important;
    font-weight: 900 !important;
    letter-spacing: 0.18em !important;
    text-transform: uppercase !important;
    color: rgba(6, 95, 70, 0.14) !important;
  }
  .manpower-letter table,
  .strength-letter table {
    table-layout: fixed !important;
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
  }
  .manpower-letter th,
  .manpower-letter td,
  .strength-letter th,
  .strength-letter td {
    padding: 1px 1px !important;
    font-size: 7px !important;
    line-height: 1.15 !important;
    overflow: hidden !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    white-space: normal !important;
    vertical-align: middle !important;
  }
  .force-rank-letter {
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  .force-rank-letter .force-rank-wing + .force-rank-wing {
    margin-top: 10px !important;
  }
  .force-rank-letter .force-rank-wing-title {
    font-weight: 700 !important;
    margin: 0 0 4px !important;
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
  .pritibhoj-sheets {
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    gap: 4mm !important;
    page: pritibhoj-page;
  }
  @page pritibhoj-page {
    size: A4 portrait;
    margin: 8mm;
  }
  .pritibhoj-sheets section {
    width: 100% !important;
    margin: 0 0 4mm !important;
    overflow: visible !important;
    border-radius: 0 !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pritibhoj-sheets section > div:first-child {
    padding: 2.5mm 3mm !important;
  }
  .pritibhoj-sheets h2 {
    font-size: 14px !important;
    line-height: 1.25 !important;
    margin: 0 !important;
  }
  .pritibhoj-sheets section p {
    font-size: 10px !important;
    line-height: 1.3 !important;
    margin: 1px 0 0 !important;
  }
  .pritibhoj-table {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed !important;
    border: 1px solid #222 !important;
    border-collapse: collapse !important;
  }
  .pb-col-sl { width: 5% !important; }
  .pb-col-wing { width: 17% !important; }
  .pb-col-num { width: 7.09% !important; }
  .pritibhoj-table th,
  .pritibhoj-table td,
  .pb-cell {
    box-sizing: border-box !important;
    padding: 4px 2px !important;
    font-size: 9px !important;
    line-height: 1.25 !important;
    text-align: center !important;
    vertical-align: middle !important;
    position: static !important;
    left: auto !important;
    border: 1px solid #222 !important;
  }
  .pritibhoj-table th {
    font-size: 7.5px !important;
    font-weight: 700 !important;
    padding: 4px 1px !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
  .pritibhoj-table td {
    white-space: nowrap !important;
    overflow: visible !important;
    word-break: keep-all !important;
  }
  .pritibhoj-table th:nth-child(2),
  .pritibhoj-table tbody tr td:nth-child(2) {
    text-align: left !important;
    padding-left: 4px !important;
    white-space: normal !important;
    word-break: break-word !important;
  }
  .pritibhoj-member-print {
    width: 100% !important;
    max-width: 100% !important;
    color: #111 !important;
  }
  .pritibhoj-member-print .pb-member-head {
    text-align: center !important;
    margin: 0 0 5mm !important;
  }
  .pritibhoj-member-print .pb-member-org {
    margin: 0 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
  }
  .pritibhoj-member-print h1 {
    margin: 1mm 0 0 !important;
    font-size: 16px !important;
    font-weight: 800 !important;
    line-height: 1.3 !important;
  }
  .pritibhoj-member-print .pb-member-event {
    margin: 1mm 0 0 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
  }
  .pritibhoj-member-print h2 {
    margin: 3mm 0 0 !important;
    font-size: 14px !important;
    font-weight: 800 !important;
    line-height: 1.3 !important;
  }
  .pritibhoj-member-print .pb-member-meta {
    margin: 1mm 0 0 !important;
    font-size: 11px !important;
  }
  .pritibhoj-member-table {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
  }
  .pritibhoj-member-table th,
  .pritibhoj-member-table td {
    border: 1px solid #222 !important;
    padding: 5px 6px !important;
    font-size: 11px !important;
    line-height: 1.3 !important;
    text-align: left !important;
    white-space: normal !important;
    word-break: break-word !important;
    vertical-align: middle !important;
    color: #111 !important;
    background: #fff !important;
  }
  .pritibhoj-member-table th {
    background: #f3f4f6 !important;
    font-weight: 700 !important;
    text-align: center !important;
  }
  .pritibhoj-member-table td:first-child,
  .pritibhoj-member-table th:first-child {
    width: 8% !important;
    text-align: center !important;
  }
  .pritibhoj-table button {
    all: unset !important;
    display: inline !important;
    font: inherit !important;
    color: inherit !important;
    background: transparent !important;
    border: 0 !important;
    padding: 0 !important;
  }
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

function lockPrintOrientation(
  doc: Document,
  orientation: "portrait" | "landscape",
) {
  const { page } = pageCssSize(orientation);
  const style = doc.createElement("style");
  style.setAttribute("data-print-orientation", orientation);
  style.textContent = `
    @page { size: ${page}; margin: 8mm; }
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      min-height: 0 !important;
      height: auto !important;
    }
    .print-page,
    .manpower-letter,
    .strength-letter {
      min-height: 0 !important;
      height: auto !important;
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .pritibhoj-sheets,
    .pritibhoj-sheets section,
    .pritibhoj-table {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      zoom: 1 !important;
    }
    .pritibhoj-table {
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .pb-col-sl { width: 5% !important; }
    .pb-col-wing { width: 17% !important; }
    .pb-col-num { width: 7.09% !important; }
    .pritibhoj-table th,
    .pritibhoj-table td {
      position: static !important;
      left: auto !important;
      width: auto !important;
      max-width: none !important;
      text-align: center !important;
      vertical-align: middle !important;
      font-size: 9px !important;
      line-height: 1.25 !important;
      padding: 4px 2px !important;
      border: 1px solid #222 !important;
    }
    .pritibhoj-table th {
      font-size: 7.5px !important;
      font-weight: 700 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }
    .pritibhoj-table td {
      white-space: nowrap !important;
      word-break: keep-all !important;
    }
    .pritibhoj-table th:nth-child(2),
    .pritibhoj-table tbody tr td:nth-child(2) {
      text-align: left !important;
      white-space: normal !important;
      word-break: break-word !important;
    }
    .pritibhoj-member-print {
      width: 100% !important;
      max-width: 100% !important;
      color: #111 !important;
    }
    .pritibhoj-member-print .pb-member-head {
      text-align: center !important;
      margin: 0 0 5mm !important;
    }
    .pritibhoj-member-print h1 {
      font-size: 16px !important;
      font-weight: 800 !important;
      margin: 1mm 0 0 !important;
    }
    .pritibhoj-member-print h2 {
      font-size: 14px !important;
      font-weight: 800 !important;
      margin: 3mm 0 0 !important;
    }
    .pritibhoj-member-print .pb-member-org,
    .pritibhoj-member-print .pb-member-event,
    .pritibhoj-member-print .pb-member-meta {
      font-size: 11px !important;
      margin: 1mm 0 0 !important;
    }
    .pritibhoj-member-table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .pritibhoj-member-table th,
    .pritibhoj-member-table td {
      border: 1px solid #222 !important;
      padding: 5px 6px !important;
      font-size: 11px !important;
      text-align: left !important;
      white-space: normal !important;
      word-break: break-word !important;
      background: #fff !important;
      color: #111 !important;
    }
    .pritibhoj-member-table th {
      background: #f3f4f6 !important;
      font-weight: 700 !important;
      text-align: center !important;
    }
    .pritibhoj-member-table td:first-child {
      text-align: center !important;
    }
  `;
  doc.head.appendChild(style);
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
    min-height: 0;
    height: auto;
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
      flattenPrintSurface(kid, true);
      const last = i === pages.length - 1;
      const allowFlow =
        kid.classList.contains("register-sheet") ||
        Boolean(kid.querySelector("table"));
      kid.style.width = "100%";
      kid.style.maxWidth = "100%";
      kid.style.height = "auto";
      kid.style.minHeight = "0";
      kid.style.boxSizing = "border-box";
      kid.style.padding = kid.matches(BANK_LETTER_SELECTOR) ? "4mm 0" : "0";
      kid.style.border = "none";
      kid.style.boxShadow = "none";
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
    clone.style.height = "auto";
    clone.style.minHeight = "0";
    if (!consumePrintRoot(clone)) {
      clone.style.minHeight = `calc(${h} - 16mm)`;
    }
    clone.style.boxSizing = "border-box";
    clone.style.padding = "0";
    clone.style.border = "none";
    clone.style.boxShadow = "none";
  }

  return clone;
}

const LARGE_LETTER_SELECTOR = [
  ".month-register-print",
  ".register-cover",
  ".month-ledger-print",
  ".tag-bill-print",
  ".leave-med-bill-print",
  ".wing-summary-print",
  ".staff-payout-print",
  ".trust-bank-letter",
  ".community-bank-letter",
  ".sonali-bank-letter",
  ".fr-transfer-letter",
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

function isBankLetterSurface(el: HTMLElement) {
  return (
    el.matches(BANK_LETTER_SELECTOR) ||
    Boolean(el.querySelector(BANK_LETTER_SELECTOR))
  );
}

function bankLetterPrintCss() {
  return `
  @page {
    size: A4 landscape;
    margin: 6mm 4mm 10mm 4mm;
  }
  @page {
    @top-left { content: none; }
    @top-center { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-center { content: none; }
    @bottom-right { content: none; }
  }
  html { color-scheme: light; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    word-spacing: normal;
    letter-spacing: 0;
    width: 100%;
    max-width: 100%;
  }
  html, body, body * {
    box-sizing: border-box !important;
    font-family: Arial, Helvetica, sans-serif !important;
    color: #000 !important;
    word-spacing: normal !important;
    letter-spacing: 0 !important;
    box-shadow: none !important;
    text-shadow: none !important;
    filter: none !important;
    transform: none !important;
  }
  .no-print { display: none !important; }
  .trust-bank-letter,
  .community-bank-letter,
  .sonali-bank-letter,
  .fr-transfer-letter,
  .staff-payout-print {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
    page-break-after: always;
    break-after: page;
  }
  .trust-bank-letter:last-child,
  .community-bank-letter:last-child,
  .sonali-bank-letter:last-child,
  .fr-transfer-letter:last-child,
  .staff-payout-print:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .letter-masthead {
    display: block !important;
    text-align: center !important;
    margin: 0 0 14px 0 !important;
    padding: 0 !important;
  }
  .letter-masthead p {
    display: block !important;
    margin: 0 0 2px 0 !important;
    padding: 0 !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
    white-space: normal !important;
  }
  .letter-masthead .font-semibold,
  .letter-masthead p.font-semibold {
    font-size: 13px !important;
    font-weight: 700 !important;
    margin-top: 4px !important;
  }
  .justify-end {
    display: block !important;
    text-align: right !important;
    margin: 0 0 10px 0 !important;
  }
  p {
    white-space: normal !important;
    margin: 0 0 6px 0 !important;
    font-size: 11px !important;
    line-height: 1.4 !important;
  }
  .font-bold, .font-semibold { font-weight: 700 !important; }
  .underline { text-decoration: underline !important; }
  table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    margin: 6px 0 8px 0 !important;
  }
  thead { display: table-row-group !important; }
  th, td {
    border: 1px solid #000 !important;
    color: #000 !important;
    padding: 1px 2px !important;
    font-size: 8px !important;
    line-height: 1.15 !important;
    text-align: left !important;
    vertical-align: top !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    background: #fff !important;
  }
  .beftn-ser {
    width: 7.5mm !important;
    max-width: 7.5mm !important;
    padding-left: 1px !important;
    padding-right: 1px !important;
  }
  .beftn-ref {
    width: 34mm !important;
    min-width: 34mm !important;
    white-space: nowrap !important;
    overflow-wrap: normal !important;
    word-break: keep-all !important;
  }
  thead th {
    background: #fff !important;
    color: #000 !important;
    font-weight: 800 !important;
    border: 1.5px solid #000 !important;
  }
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }
  .beftn-letter-page {
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    page-break-after: always !important;
    break-after: page !important;
  }
  .beftn-letter-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  .beftn-page-no {
    display: block !important;
    margin-top: 8px !important;
    padding-top: 4px !important;
    text-align: right !important;
    font-size: 10px !important;
    line-height: 1 !important;
    border: none !important;
  }
  `;
}

async function printBankLetterElement(el: HTMLElement) {
  const prevMax = el.style.maxHeight;
  const prevOverflow = el.style.overflow;
  el.style.maxHeight = "none";
  el.style.overflow = "visible";

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((node) => node.remove());
  clone.classList.remove("hidden");
  clone.style.display = "block";
  clone.style.width = "100%";
  clone.style.maxWidth = "100%";
  clone.style.height = "auto";
  clone.style.minHeight = "0";
  clone.style.gap = "0";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<title></title>
<style>${bankLetterPrintCss()}</style>
</head><body></body></html>`;

  const printWin = window.open("", "mess-print", "width=1100,height=800");
  try {
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.document.title = "";
      printWin.document.body.appendChild(
        printWin.document.importNode(clone, true),
      );
      await waitForPaint(printWin);
      await printAndWait(printWin);
      try {
        printWin.close();
      } catch {
        /* ignore */
      }
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "297mm",
      height: "210mm",
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
    await printAndWait(win);
    iframe.remove();
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
  }
}

export async function printLetterElement(
  el: HTMLElement,
  _filename = "letter.pdf",
  orientation: "portrait" | "landscape" = "landscape",
  options: PrintLetterOptions = {},
) {
  if (isBankLetterSurface(el)) {
    await printBankLetterElement(el);
    return;
  }

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
    orientation === "portrait" ? "mess-print-portrait" : "mess-print-landscape",
    `width=${orientation === "landscape" ? 1100 : 800},height=${orientation === "landscape" ? 800 : 1000}`,
  );

  try {
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      if (preserveColors) copyDocumentStyles(document, printWin.document);
      lockPrintOrientation(printWin.document, orientation);
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
    lockPrintOrientation(doc, orientation);
    doc.body.appendChild(doc.importNode(clone, true));
    await waitForPrintAssets(win);
    await printAndWait(win);
    iframe.remove();
  } finally {
    el.style.maxHeight = prevMax;
    el.style.overflow = prevOverflow;
  }
}
