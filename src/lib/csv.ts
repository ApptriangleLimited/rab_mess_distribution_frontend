export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    if (/[",\n]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`;
    return cell;
  };
  const body = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
