/**
 * Shared Excel report template.
 * Use this for every Excel download. It only changes alignment and look —
 * titles and cell values stay as passed.
 *
 *   Title  → large, bold, centered
 *   Org    → small, faded, centered
 *   Meta   → normal, centered
 *   Head   → left, no wrap, sized to the header text
 *   Data   → left aligned
 */

export type ExcelTitleRole = "title" | "org" | "meta";

export type ExcelTitleLine = {
  text: string;
  role?: ExcelTitleRole;
};

export type ExcelSheetSpec = {
  name: string;
  /** Centered lines above the table. Text is unchanged. */
  titles?: ExcelTitleLine[];
  /** Letter meta (To / Subject) — left aligned; 2-col rows merge the rest. */
  preamble?: string[][];
  headers?: string[];
  rows: string[][];
};

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sheetName(name: string) {
  return xmlEscape(name.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31) || "Sheet1");
}

function filledCount(row: string[]) {
  return row.filter((c) => String(c ?? "").trim() !== "").length;
}

function firstFilled(row: string[]) {
  return row.find((c) => String(c ?? "").trim() !== "") ?? "";
}

function isAmountNumber(value: string, style: string) {
  if (style !== "Money" && style !== "Total") return false;
  return /^-?\d+(\.\d+)?$/.test(value.trim().replace(/,/g, ""));
}

function styledCell(value: string, style: string) {
  const text = value ?? "";
  const numeric = isAmountNumber(text, style);
  const data = numeric ? text.replace(/,/g, "") : text;
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEscape(data)}</Data></Cell>`;
}

function titleRow(style: string, value: string, mergeAcross: number) {
  return `<Row><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell></Row>`;
}

function isWidthRow(row: string[]) {
  if (filledCount(row) < 3) return false;
  return !row.some((c) => /^(g\/)?total:?$/i.test(String(c ?? "").trim()));
}

function colWidth(header: string, values: string[], cols: number) {
  const cap = cols >= 12 ? 78 : cols >= 8 ? 140 : 220;
  const headerW = String(header ?? "").length * 6.2 + 14;
  let dataW = 32;
  for (const value of values) {
    dataW = Math.max(dataW, String(value ?? "").length * 5.6 + 12);
  }
  return Math.min(cap, Math.max(28, headerW, dataW));
}

function columnXml(headers: string[], rows: string[][], cols: number) {
  const dataRows = rows.filter(isWidthRow);
  return Array.from({ length: cols }, (_, c) => {
    const header = headers[c] ?? "";
    const values = dataRows.map((row) => row[c] ?? "");
    const w = colWidth(header, values, cols);
    return `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`;
  }).join("");
}

function padRow(row: string[], cols: number) {
  return Array.from({ length: cols }, (_, i) => row[i] ?? "");
}

function splitLegacyRows(rows: string[][]) {
  const titles: ExcelTitleLine[] = [];
  let i = 0;
  let usedTitle = false;
  while (i < rows.length) {
    const row = rows[i] ?? [];
    const n = filledCount(row);
    if (n === 0) {
      i += 1;
      break;
    }
    if (n === 1) {
      titles.push({
        text: firstFilled(row),
        role: usedTitle ? "meta" : "title",
      });
      usedTitle = true;
      i += 1;
      continue;
    }
    break;
  }
  while (i < rows.length && filledCount(rows[i] ?? []) === 0) i += 1;
  const preamble: string[][] = [];
  while (
    i < rows.length &&
    filledCount(rows[i] ?? []) > 0 &&
    filledCount(rows[i] ?? []) < 3
  ) {
    preamble.push(rows[i] ?? []);
    i += 1;
  }
  while (i < rows.length && filledCount(rows[i] ?? []) === 0) i += 1;
  let headers: string[] | undefined;
  if (i < rows.length && filledCount(rows[i] ?? []) >= 3) {
    headers = [...(rows[i] ?? [])];
    i += 1;
  }
  return { titles, preamble, headers, rows: rows.slice(i) };
}

function dataStyle(header: string) {
  const key = header.trim().toLowerCase();
  if (key.includes("amount") || key === "g/total:" || key === "g/total") {
    return "Money";
  }
  return "Data";
}

function headStyle(_header: string) {
  return "Head";
}

function preambleRowXml(row: string[], cols: number) {
  const cells = padRow(row, cols);
  const merge = Math.max(0, cols - 1);
  const first = String(cells[0] ?? "").trim();
  const second = String(cells[1] ?? "").trim();
  if (filledCount(cells) === 1 && first) {
    return `<Row><Cell ss:MergeAcross="${merge}" ss:StyleID="Plain"><Data ss:Type="String">${xmlEscape(cells[0])}</Data></Cell></Row>`;
  }
  const valueStyle = !first && second ? "PlainRight" : "Plain";
  return `<Row>${cells
    .map((cell, i) => {
      if (i === 1 && cols > 2) {
        return `<Cell ss:MergeAcross="${cols - 2}" ss:StyleID="${valueStyle}"><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`;
      }
      if (i > 1) return "";
      return styledCell(cell, "Plain");
    })
    .join("")}</Row>`;
}

function worksheetXml(sheet: ExcelSheetSpec) {
  const hasExplicit = Boolean(
    sheet.titles?.length || sheet.headers?.length || sheet.preamble?.length,
  );
  const parsed = hasExplicit
    ? {
        titles: sheet.titles ?? [],
        preamble: sheet.preamble ?? [],
        headers: sheet.headers,
        rows: sheet.rows,
      }
    : splitLegacyRows(sheet.rows);

  const tableRows = parsed.rows;
  const headers = parsed.headers ?? [];
  const maxCols = Math.max(
    1,
    headers.length,
    ...tableRows.map((r) => r.length),
  );
  const merge = Math.max(0, maxCols - 1);
  const out: string[] = [];

  for (const line of parsed.titles) {
    const text = line.text?.trim();
    if (!text) continue;
    const role = line.role ?? "meta";
    const style =
      role === "title" ? "Title" : role === "org" ? "Org" : "Meta";
    out.push(titleRow(style, text, merge));
  }
  if (parsed.titles.length) out.push("<Row></Row>");

  for (const row of parsed.preamble) {
    out.push(preambleRowXml(row, maxCols));
  }
  if (parsed.preamble.length) out.push("<Row></Row>");

  if (headers.length) {
    out.push(
      `<Row>${padRow(headers, maxCols)
        .map((cell) => styledCell(cell, headStyle(cell)))
        .join("")}</Row>`,
    );
  }

  for (const row of tableRows) {
    if (filledCount(row) === 0) {
      out.push("<Row></Row>");
      continue;
    }
    const padded = padRow(row, maxCols);
    const isTotal = padded.some((c) => /^(g\/)?total:?$/i.test(c.trim()));
    const filled = filledCount(padded);
    if (!isTotal && filled < 3) {
      out.push(preambleRowXml(padded, maxCols));
      continue;
    }
    out.push(
      `<Row>${padded
        .map((cell, i) =>
          styledCell(cell, isTotal ? "Total" : dataStyle(headers[i] ?? "")),
        )
        .join("")}</Row>`,
    );
  }

  return `<Worksheet ss:Name="${sheetName(sheet.name)}"><Table ss:DefaultColumnWidth="64">${columnXml(headers, tableRows, maxCols)}${out.join("")}</Table>${WORKSHEET_PRINT_OPTIONS}</Worksheet>`;
}

const WORKSHEET_PRINT_OPTIONS = `
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
    <PageSetup>
      <Layout x:Orientation="Landscape"/>
      <Header x:Margin="0.2"/>
      <Footer x:Margin="0.2"/>
      <PageMargins x:Bottom="0.4" x:Left="0.3" x:Right="0.3" x:Top="0.4"/>
    </PageSetup>
    <FitToPage/>
    <Print>
      <ValidPrinterInfo/>
      <PaperSizeIndex>9</PaperSizeIndex>
      <FitWidth>1</FitWidth>
      <FitHeight>0</FitHeight>
    </Print>
    <DoNotDisplayGridlines/>
  </WorksheetOptions>
`;

const EXCEL_REPORT_STYLES = `
  <Styles>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="14"/>
    </Style>
    <Style ss:ID="Org">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Bold="0" ss:Size="8" ss:Color="#8A8A8A"/>
    </Style>
    <Style ss:ID="Meta">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Size="9"/>
    </Style>
    <Style ss:ID="Head">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="8" ss:Color="#000000"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="HeadCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#000000"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Data">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Size="8" ss:Color="#000000"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Center">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:Size="9" ss:Color="#000000"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Money">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:Size="8" ss:Color="#000000"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Total">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#000000"/>
      <Borders>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Plain">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Size="9"/>
    </Style>
    <Style ss:ID="PlainRight">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:Size="9"/>
    </Style>
  </Styles>
`;

export function reportFileStem(title: string) {
  const safe = title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return safe || "report";
}

/** Apply the shared Excel report template to one or more sheets. */
export function downloadExcelSheets(
  filename: string,
  sheets: ExcelSheetSpec[],
) {
  const body = (sheets.length ? sheets : [{ name: "Sheet1", rows: [] }])
    .map((sheet) => worksheetXml(sheet))
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
  ${EXCEL_REPORT_STYLES}
  ${body}
</Workbook>`;
  const blob = new Blob([`\uFEFF${xml}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  filename: string,
  rows: string[][],
  worksheetName = "Sheet1",
) {
  downloadExcelSheets(filename, [{ name: worksheetName, rows }]);
}

/** One-sheet report: centered titles, faded org, left-aligned table. */
export function downloadExcelReport({
  filename,
  sheetName: name,
  title,
  org,
  lines = [],
  headers,
  rows,
}: {
  filename: string;
  sheetName?: string;
  title: string;
  org?: string;
  lines?: string[];
  headers: string[];
  rows: string[][];
}) {
  const titles: ExcelTitleLine[] = [{ text: title, role: "title" }];
  if (org) titles.push({ text: org, role: "org" });
  for (const line of lines) {
    if (line.trim()) titles.push({ text: line, role: "meta" });
  }
  downloadExcelSheets(filename, [
    {
      name: name || title,
      titles,
      headers,
      rows,
    },
  ]);
}
