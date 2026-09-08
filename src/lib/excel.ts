function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cellXml(value: string) {
  const asNumber = value.trim() !== "" && /^-?\d+(\.\d+)?$/.test(value);
  return `<Cell><Data ss:Type="${asNumber ? "Number" : "String"}">${xmlEscape(value)}</Data></Cell>`;
}

function sheetName(name: string) {
  return xmlEscape(name.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31) || "Sheet1");
}

/** Excel 2003 XML workbook — opens in Excel / Sheets without an extra package. */
export function downloadExcel(
  filename: string,
  rows: string[][],
  worksheetName = "Sheet1",
) {
  const table = rows
    .map((row) => `<Row>${row.map(cellXml).join("")}</Row>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${sheetName(worksheetName)}">
    <Table>${table}</Table>
  </Worksheet>
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
