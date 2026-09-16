"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { tagPrintClass, tagPrintCss, tagPrintFill } from "@/lib/tag-colors";
import { isTrgTag, resolveTrgTone } from "@/lib/trg-tone";
import { useI18n, useT } from "@/i18n/provider";
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
    },
    ref,
  ) {
    const t = useT();
    const { locale } = useI18n();
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
    const monthBn = formatMonthLong(month, "bn-BD");
    const monthEn = formatMonthLong(month);
    const useBn = locale === "bn";

    const dayLabel = (d: number) => String(d);
    const serLabel = (n: number) => String(n);

    const tagTotals = Object.fromEntries(
      tagCodes.map((code) => [
        code,
        rows.reduce((s, r) => s + (r.tagCounts[code] ?? 0), 0),
      ]),
    ) as Partial<Record<DailyTag, number>>;
    const grandDays = rows.reduce((s, r) => s + r.totalDays, 0);

    return (
      <div
        ref={ref}
        className={cn(
          "month-ledger-print text-black",
          preview
            ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm [print-color-adjust:exact] dark:border-neutral-700"
            : "hidden print:block",
        )}
      >
        <div className="letter-masthead mb-3 text-center">
          <p className="text-[11px] font-semibold">
            {CONSUME_REPORT_META.wingBn}
          </p>
          <p className="mt-1 text-sm font-bold">
            {t("consume.ledgerTitleBn", { month: monthBn })}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-700">
            {CONSUME_REPORT_META.campBn}
          </p>
          {!useBn ? (
            <p className="mt-1 text-[9px] text-neutral-500">
              {t("consume.ledgerTitle", { month: monthEn })}
            </p>
          ) : null}
        </div>

        <style>{tagPrintCss()}</style>
        <table className="w-full border-collapse text-[9px] leading-none">
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-1 py-1">
                {t("consume.colSl")}
              </th>
              <th className="border border-black px-1 py-1 text-left">
                {t("consume.colId")}
              </th>
              <th className="border border-black px-1 py-1 text-left">
                {t("consume.colRank")}
              </th>
              <th className="border border-black px-1 py-1 text-left">
                {t("consume.colName")}
              </th>
              {columns.map(({ date, dayNum }) => (
                <th
                  key={date}
                  className="min-w-[1.35rem] border border-black px-0.5 py-1"
                >
                  {dayLabel(dayNum)}
                </th>
              ))}
              {tagCodes.map((code) => (
                <th key={code} className="border border-black px-1 py-1">
                  {code}
                </th>
              ))}
              <th className="border border-black px-1 py-1">
                {t("consume.colTotalDays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.user.id}>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {serLabel(i + 1)}
                </td>
                <td className="border border-black px-1 py-0.5 font-mono whitespace-nowrap">
                  {row.user.personal_id || "—"}
                </td>
                <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                  {row.user.rank}
                </td>
                <td className="border border-black px-1 py-0.5 text-left whitespace-nowrap">
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
                        className="min-w-[1.35rem] border border-black px-0.5 py-0.5"
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
                        "min-w-[1.35rem] border border-black px-0.5 py-0.5 text-center font-mono text-[8px] font-bold leading-none whitespace-nowrap",
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
                    className="border border-black px-1 py-0.5 text-center tabular-nums"
                  >
                    {row.tagCounts[code] ?? ""}
                  </td>
                ))}
                <td className="border border-black px-1 py-0.5 text-center tabular-nums font-semibold">
                  {row.totalDays || ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border border-black font-semibold">
              <td
                colSpan={4}
                className="border border-black px-1 py-1 text-right"
              >
                {t("consume.colGrandTotal")}
              </td>
              {columns.map(({ date }) => (
                <td key={date} className="border border-black px-0 py-1" />
              ))}
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
        </table>

        <ConsumeSignOff
          className="gap-3 text-[9px]"
          labels={(
            [
              "consume.signDailySi",
              "consume.signConsumeSi",
              "consume.signPicketSi",
              "consume.signSeniorDad",
              "consume.signMessPresident",
              "consume.signLastOfficer",
            ] as const
          ).map((key) => t(key))}
        />
      </div>
    );
  },
);
