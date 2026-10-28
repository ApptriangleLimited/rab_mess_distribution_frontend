"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { tagPrintClass, tagPrintCss, tagPrintFill } from "@/lib/tag-colors";
import { isTrgTag, resolveTrgTone } from "@/lib/trg-tone";
import { useT } from "@/i18n/provider";
import { chunkBillRows, CONSUME_BILL_ROWS_PER_PAGE } from "@/lib/consume-bill-pages";
import { consumeRankShort } from "@/lib/consume-rank-short";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
  /** Subset of day-of-month numbers (1-based). Default: 1..dayCount. */
  visibleDays?: number[];
  /** Cross-month: `row.days[i]` aligns with `columnDates[i]`. */
  columnDates?: string[];
  /** Show on screen for iframe print capture; default print-only. */
  preview?: boolean;
  /** Consume report is English + landscape; mess keeps Bangla. */
  reportLang?: "en" | "bn";
  /** Show SRB No beside personal number (ration ledger). */
  showSrbNo?: boolean;
  /** Official wing for this copy. Falls back to the report masthead wing. */
  wingTitle?: string;
  /** Start this wing's ledger on a new printed page. */
  pageBreak?: boolean;
  /** Repeat the sign-off under every page instead of only the last. */
  signEveryPage?: boolean;
  /** Add a page total row under every page; the last page also keeps the grand total. */
  totalEveryPage?: boolean;
};

/** Landscape Forces Mess consume ledger — matches BN register print. */
export const MonthLedgerPrint = forwardRef<HTMLDivElement, Props>(
  function MonthLedgerPrint(
    {
      month,
      dayCount,
      tagCodes,
      rows,
      visibleDays,
      columnDates,
      preview = false,
      reportLang = "bn",
      showSrbNo = false,
      wingTitle,
      pageBreak = false,
      signEveryPage = false,
      totalEveryPage = false,
    },
    ref,
  ) {
    const t = useT();
    const english = reportLang === "en";
    const rangeMode = Boolean(columnDates?.length);
    const columns = columnDates?.length
      ? columnDates.map((date) => ({
          date,
          dayNum: Number(date.slice(8, 10)),
        }))
      : (visibleDays?.length
          ? visibleDays
          : Array.from({ length: dayCount }, (_, i) => i + 1)
        ).map((dayNum) => ({
          date: `${month}-${String(dayNum).padStart(2, "0")}`,
          dayNum,
        }));
    const monthEn = formatMonthLong(month, "en-US");
    const campEn = `${CONSUME_REPORT_META.orgName}, ${CONSUME_REPORT_META.station}`;
    const wingHeading = (wingTitle || CONSUME_REPORT_META.wing).toUpperCase();
    const pages = chunkBillRows(rows);

    const dayLabel = (d: number) => String(d);
    const serLabel = (n: number) => String(n);

    const tagTotals = Object.fromEntries(
      tagCodes.map((code) => [
        code,
        rows.reduce((s, r) => s + (r.tagCounts[code] ?? 0), 0),
      ]),
    ) as Partial<Record<DailyTag, number>>;
    const grandDays = rows.reduce((s, r) => s + r.totalDays, 0);
    const multiPage = pages.length > 1;

    const totalRow = (
      key: string,
      label: string,
      sourceRows: LedgerRow[],
      emphasis: "page" | "grand",
    ) => {
      const counts = Object.fromEntries(
        tagCodes.map((code) => [
          code,
          sourceRows.reduce((s, r) => s + (r.tagCounts[code] ?? 0), 0),
        ]),
      ) as Partial<Record<DailyTag, number>>;
      const days = sourceRows.reduce((s, r) => s + r.totalDays, 0);
      return (
        <tr
          key={key}
          className={cn(
            "border border-black font-semibold",
            emphasis === "grand" && "font-bold",
          )}
        >
          {Array.from({ length: identityColCount - 1 }, (_, i) => (
            <td key={`id-${i}`} className="border border-black px-0.5 py-1" />
          ))}
          <td className="ledger-name border border-black px-0.5 py-1 text-center">
            {label}
          </td>
          {columns.map(({ date }) => (
            <td key={date} className="border border-black px-0 py-1" />
          ))}
          {tagCodes.map((code) => (
            <td
              key={code}
              className="border border-black px-0.5 py-1 text-center tabular-nums"
            >
              {counts[code] || ""}
            </td>
          ))}
          <td className="border border-black px-0.5 py-1 text-center tabular-nums">
            {days || ""}
          </td>
        </tr>
      );
    };

    /** Inside the preview padding and the 8mm print margin, so the last column stays on the sheet. */
    const pageMm = english ? 270 : 291;
    const tagColMm = (code: string) =>
      english ? (code.length >= 3 ? 6.5 : 5.2) : 7;
    const tagColsMm = tagCodes.reduce((s, code) => s + tagColMm(code), 0);
    const totalColMm = english ? 8 : 10;
    const fixedWithoutName = showSrbNo
      ? english
        ? 6 + 16 + 10 + 11
        : 7 + 16 + 16 + 14
      : english
        ? 6 + 16 + 11
        : 7 + 22 + 16;
    const minDayMm = 3.4;
    const maxNameMm = Math.max(
      14,
      pageMm -
        fixedWithoutName -
        tagColsMm -
        totalColMm -
        columns.length * minDayMm,
    );
    const longestName = Math.max(
      (english ? "Name" : t("consume.colName")).length,
      ...rows.map((row) => row.user.name.trim().length),
      1,
    );
    const nameMm = Math.min(maxNameMm, Math.max(14, longestName * 1.45 + 2));
    const identityMm = showSrbNo
      ? english
        ? [6, 16, 10, 11, nameMm]
        : [7, 16, 16, 14, nameMm]
      : english
        ? [6, 16, 11, nameMm]
        : [7, 22, 16, nameMm];
    const identityColCount = identityMm.length;
    const reservedMm =
      identityMm.reduce((s, n) => s + n, 0) + tagColsMm + totalColMm;
    const dayColMm = Math.max(
      3.5,
      (pageMm - reservedMm) / Math.max(columns.length, 1),
    );

    return (
      <div
        ref={ref}
        className={cn(
          "month-ledger-print flex flex-col gap-6 text-black",
          pageBreak && "consume-wing-break",
          preview ? "block" : "hidden print:block",
        )}
      >
        {pages.map((pageRows, pageIndex) => {
          const lastPage = pageIndex === pages.length - 1;
          const serialOffset = pageIndex * CONSUME_BILL_ROWS_PER_PAGE;
          return (
        <section
          key={pageIndex}
          className={cn(
            "consume-ledger-page",
            english &&
              "consume-ledger-en box-border w-[281mm] max-w-[281mm] overflow-visible",
            pageIndex > 0 && "consume-wing-break",
            preview
              ? "mx-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-sm [print-color-adjust:exact] dark:border-neutral-700"
              : "",
          )}
        >
        <div>
        <div className="consume-masthead letter-masthead mb-2 whitespace-normal text-center [word-spacing:normal]">
          <p className="ledger-title text-sm font-bold leading-tight">
            {wingHeading}
          </p>
          <p className="ledger-title mt-0.5 text-sm font-bold leading-tight">
            Forces Mess food consumption list — {monthEn}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-neutral-700">
            {campEn}
          </p>
        </div>

        <style>{tagPrintCss()}</style>
        <table className="w-full table-fixed border-collapse text-[8px] leading-none">
          <colgroup>
            {identityMm.map((w, i) => (
              <col key={`id-${i}`} style={{ width: `${w}mm` }} />
            ))}
            {columns.map(({ date }) => (
              <col key={`d-${date}`} style={{ width: `${dayColMm}mm` }} />
            ))}
            {tagCodes.map((code) => (
              <col key={`t-${code}`} style={{ width: `${tagColMm(code)}mm` }} />
            ))}
            <col style={{ width: `${totalColMm}mm` }} />
          </colgroup>
          <thead>
            <tr className="consume-col-titles border border-black bg-neutral-100">
              <th className="border border-black px-0.5 py-1">
                {t("consume.colSl")}
              </th>
              <th className="ledger-id border border-black px-0.5 py-1 text-left">
                {t("consume.colId")}
              </th>
              {showSrbNo ? (
                <th className="ledger-srb border border-black px-0.5 py-1 text-left">
                  {t("consume.colSrbNo")}
                </th>
              ) : null}
              <th className="border border-black px-0.5 py-1">
                {t("consume.colRank")}
              </th>
              <th className="border border-black px-0.5 py-1">
                {t("consume.colName")}
              </th>
              {columns.map(({ date, dayNum }) => (
                <th
                  key={date}
                  className="border border-black px-0 py-1"
                >
                  {dayLabel(dayNum)}
                </th>
              ))}
              {tagCodes.map((code) => (
                <th
                  key={code}
                  className={cn(
                    "overflow-hidden border border-black px-0 py-1 whitespace-nowrap",
                    code.length >= 3 ? "ledger-tag-3 text-[5.5px]" : "text-[7px]",
                  )}
                >
                  {code}
                </th>
              ))}
              <th className="overflow-hidden border border-black px-0 py-1 text-[7px] whitespace-nowrap">
                {english ? "Total" : t("consume.colTotalDays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={row.user.id}>
                <td className="consume-sl border border-black px-0.5 py-0.5 text-center tabular-nums">
                  {serLabel(serialOffset + i + 1)}
                </td>
                <td className="ledger-id overflow-hidden border border-black px-0.5 py-0.5 font-mono text-[5.5px] leading-none whitespace-nowrap">
                  {row.user.personal_id || "—"}
                </td>
                {showSrbNo ? (
                  <td className="ledger-srb overflow-hidden border border-black px-0.5 py-0.5 font-mono text-[5.5px] leading-none whitespace-nowrap">
                    {row.user.rab_id || "—"}
                  </td>
                ) : null}
                <td className="ledger-rank overflow-hidden border border-black px-0.5 py-0.5 whitespace-nowrap">
                  {consumeRankShort(row.user.rank)}
                </td>
                <td className="ledger-name border border-black px-0.5 py-0.5 text-left">
                  {row.user.name}
                </td>
                {columns.map(({ date, dayNum }, vi) => {
                  const cell = rangeMode
                    ? (row.days[vi] ?? "")
                    : (row.days[dayNum - 1] ?? "");
                  if (!cell) {
                    return (
                      <td
                        key={date}
                        className="border border-black px-0 py-0.5"
                      />
                    );
                  }
                  const tone = isTrgTag(cell)
                    ? resolveTrgTone(row.user.force)
                    : undefined;
                  const fill = tagPrintFill(cell, tone);
                  return (
                    <td
                      key={date}
                      className={cn(
                        tagPrintClass(cell, tone),
                        "border border-black px-0 py-0.5 text-center font-mono font-bold leading-none",
                        cell.length >= 3
                          ? "ledger-tag-3 text-[5px]"
                          : "text-[6px]",
                      )}
                      style={{ backgroundColor: fill.bg, color: fill.fg }}
                    >
                      {cell}
                    </td>
                  );
                })}
                {tagCodes.map((code) => (
                  <td
                    key={code}
                    className="border border-black px-0 py-0.5 text-center tabular-nums"
                  >
                    {row.tagCounts[code] ?? ""}
                  </td>
                ))}
                <td className="border border-black px-0 py-0.5 text-center tabular-nums font-semibold">
                  {row.totalDays || ""}
                </td>
              </tr>
            ))}
          </tbody>
          {totalEveryPage ? (
          <tfoot>
            {multiPage
              ? totalRow("page", t("consume.colPageTotal"), pageRows, "page")
              : null}
            {lastPage
              ? totalRow("grand", t("consume.colGrandTotal"), rows, "grand")
              : null}
          </tfoot>
          ) : lastPage ? (
          <tfoot>
            <tr className="border border-black font-semibold">
              <td
                colSpan={identityColCount + columns.length}
                className="border border-black px-1 py-1 text-left"
              >
                {t("consume.colGrandTotal")}
              </td>
              {tagCodes.map((code) => (
                <td
                  key={code}
                  className="border border-black px-0.5 py-1 text-center tabular-nums"
                >
                  {tagTotals[code] || ""}
                </td>
              ))}
              <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                {grandDays || ""}
              </td>
            </tr>
          </tfoot>
          ) : null}
        </table>
        </div>

        {lastPage || signEveryPage ? (
        <div className="consume-bill-signs">
        <ConsumeSignOff
          className="mt-0 text-[8px]"
          labels={(
            [
              "consume.signDailySi",
              "consume.signConsumeSi",
              "consume.signSeniorDad",
              "consume.signMessPresident",
              "consume.signLastOfficer",
            ] as const
          ).map((key) => t(key))}
        />
        </div>
        ) : null}
        {english ? (
          <p className="ledger-page-no">
            {t("common.pageOf", {
              page: pageIndex + 1,
              total: pages.length,
            })}
          </p>
        ) : null}
        </section>
          );
        })}
      </div>
    );
  },
);
