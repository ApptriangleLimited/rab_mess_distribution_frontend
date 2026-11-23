import { CONSUME_REPORT_META, rankOfficialSerial } from "@/lib/constants";
import {
  registerWingGroup,
  registerWingSignLabel,
  wingPrintOrder,
} from "@/lib/daily-register-wings";
import { formatDateLong } from "@/lib/date";
import { downloadExcelSheets, type ExcelSheetSpec } from "@/lib/excel";
import type { LedgerRow } from "@/lib/reports";
import { getState } from "@/lib/store";

type TagLine = {
  date: string;
  id: string;
  rank: string;
  name: string;
  tag: string;
  wing: string;
};

function dateLabel(dates: string[]) {
  if (!dates.length) return "";
  if (dates.length === 1) return formatDateLong(dates[0]);
  return `${formatDateLong(dates[0])} – ${formatDateLong(dates[dates.length - 1])}`;
}

function sheetTitle(name: string, index: number) {
  const clean = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (clean || `Wing ${index + 1}`).slice(0, 31);
}

function lineRows(lines: TagLine[], includeDate: boolean): string[][] {
  return lines.map((line, i) => {
    const body = [
      String(i + 1),
      line.id || "—",
      line.rank || "—",
      line.name || "—",
      line.tag,
    ];
    return includeDate ? [formatDateLong(line.date), ...body] : body;
  });
}

function headers(includeDate: boolean) {
  const cols = ["SL", "ID", "Rank", "Name", "Tag"];
  return includeDate ? ["Date", ...cols] : cols;
}

/** Tag list Excel, grouped by wing. Preview / PDF data is not modified. */
export function downloadDailyTagExcel({
  dates,
  rows,
  tag,
  filename,
}: {
  dates: string[];
  rows: LedgerRow[];
  tag?: string;
  filename?: string;
}) {
  const wanted = (tag ?? "").trim().toUpperCase();
  const filterTag = wanted && wanted !== "ALL" ? wanted : "";
  const includeDate = dates.length > 1;
  const lines: TagLine[] = [];

  for (const row of rows) {
    row.days.forEach((cell, i) => {
      const cellTag = String(cell ?? "").trim().toUpperCase();
      if (!cellTag) return;
      if (filterTag && cellTag !== filterTag) return;
      const date = dates[i];
      if (!date) return;
      lines.push({
        date,
        id: row.user.personal_id || "",
        rank: row.user.rank || "",
        name: row.user.name || "",
        tag: cellTag,
        wing: registerWingGroup(row.user.wing),
      });
    });
  }

  const serial = wingPrintOrder();
  const rank = new Map(serial.map((wing, i) => [wing, i]));
  const buckets = new Map<string, TagLine[]>();
  for (const line of lines) {
    const list = buckets.get(line.wing) ?? [];
    list.push(line);
    buckets.set(line.wing, list);
  }
  const wingKeys = [...buckets.keys()].sort((a, b) => {
    const ai = rank.has(a) ? rank.get(a)! : 1000;
    const bi = rank.has(b) ? rank.get(b)! : 1000;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  const serials = getState().rank_serials;
  const sortLines = (list: TagLine[]) =>
    [...list].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp) return dateCmp;
      const as = rankOfficialSerial(a.rank, serials) ?? 10_000;
      const bs = rankOfficialSerial(b.rank, serials) ?? 10_000;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name);
    });

  const tagLabel = filterTag || "All";
  const when = dateLabel(dates);
  const titles = [
    { text: `${tagLabel} Report — ${when}`, role: "title" as const },
    { text: CONSUME_REPORT_META.orgName, role: "org" as const },
    { text: `Date: ${when}`, role: "meta" as const },
    { text: `Tag: ${tagLabel}`, role: "meta" as const },
    { text: `${lines.length} members`, role: "meta" as const },
  ];
  const cols = headers(includeDate);

  const sheets: ExcelSheetSpec[] = [
    {
      name: "All",
      titles,
      headers: cols,
      rows: lineRows(sortLines(lines), includeDate),
    },
    ...wingKeys.map((key, i) => {
      const label = registerWingSignLabel(key);
      const wingLines = sortLines(buckets.get(key) ?? []);
      return {
        name: sheetTitle(label, i),
        titles: [
          ...titles,
          { text: `${label} (${wingLines.length})`, role: "meta" as const },
        ],
        headers: cols,
        rows: lineRows(wingLines, includeDate),
      };
    }),
  ];

  const stem = filterTag
    ? `daily-rr-${filterTag}-${dates[0] ?? "list"}`
    : `daily-rr-tags-${dates[0] ?? "list"}`;
  downloadExcelSheets(filename ?? `${stem}.xls`, sheets);
}
