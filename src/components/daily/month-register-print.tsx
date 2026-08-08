"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import {
  registerCellMark,
  registerDayRuns,
  type LedgerRow,
} from "@/lib/reports";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  /** Calendar day numbers shown as columns (1-based). */
  dayNumbers: number[];
  /** `row.days` length must match `dayNumbers`. */
  rows: LedgerRow[];
  /** Show for on-screen review / iframe print capture. */
  preview?: boolean;
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function toBnDigits(n: number) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Landscape attendance register — matches paper garrison register layout. */
export const MonthRegisterPrint = forwardRef<HTMLDivElement, Props>(
  function MonthRegisterPrint(
    { month, dayNumbers, rows, preview = false },
    ref,
  ) {
    const t = useT();
    const { locale } = useI18n();
    const monthBn = formatMonthLong(month, "bn-BD");
    const monthEn = formatMonthLong(month);
    const useBn = locale === "bn";

    const dayLabel = (d: number) => (useBn ? toBnDigits(d) : String(d));
    const serLabel = (n: number) => (useBn ? toBnDigits(n) : String(n));

    return (
      <div
        ref={ref}
        className={cn(
          "month-register-print text-black",
          preview
            ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
            : "hidden print:block",
        )}
      >
        <div className="letter-masthead mb-3 text-center">
          <p className="text-[11px] font-semibold">
            {CONSUME_REPORT_META.wingBn}
          </p>
          <p className="mt-1 text-sm font-bold">
            {t("daily.registerTitleBn", { month: monthBn })}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-700">
            {CONSUME_REPORT_META.campBn}
          </p>
          {!useBn ? (
            <p className="mt-1 text-[9px] text-neutral-500">
              {t("daily.registerTitle", { month: monthEn })}
            </p>
          ) : null}
        </div>

        <table className="w-full table-fixed border-collapse text-[6.5px] leading-tight">
          <colgroup>
            <col style={{ width: "2.2%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            {dayNumbers.map((d, i) => (
              <col key={`${d}-${i}`} />
            ))}
          </colgroup>
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-0 py-0.5">
                {t("daily.registerColSl")}
              </th>
              <th className="border border-black px-0 py-0.5 text-left">
                {t("daily.registerColId")}
              </th>
              <th className="border border-black px-0 py-0.5 text-left">
                {t("daily.registerColRank")}
              </th>
              <th className="border border-black px-0 py-0.5 text-left">
                {t("daily.registerColName")}
              </th>
              {dayNumbers.map((d, i) => (
                <th key={`${d}-${i}`} className="border border-black px-0 py-0.5">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const runs = registerDayRuns(row.days);
              return (
                <tr key={row.user.id}>
                  <td className="overflow-hidden border border-black px-0 py-0 text-center tabular-nums">
                    {serLabel(i + 1)}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 font-mono truncate">
                    {row.user.rab_id}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 truncate">
                    {row.user.rank}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 text-left truncate">
                    {row.user.name}
                  </td>
                  {runs.map((run, ri) => {
                    const mark = registerCellMark(run.tag, run.len);
                    const span = run.len > 1 && Boolean(run.tag);
                    return (
                      <td
                        key={`${row.user.id}-${ri}`}
                        colSpan={run.len}
                        className="border border-black px-0 py-0 text-center font-mono"
                      >
                        {span ? (
                          <span className="relative mx-auto flex items-center justify-center px-0.5">
                            <span
                              aria-hidden
                              className="absolute inset-x-0.5 top-1/2 h-px bg-black"
                            />
                            <span className="relative z-[1] bg-white px-0.5 text-[6px] font-bold leading-none">
                              {mark}
                            </span>
                          </span>
                        ) : (
                          mark
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-right text-[8px] text-neutral-500">
          {t("daily.registerFooter", { month: useBn ? monthBn : monthEn })}
        </p>

        <div className="mt-10 grid grid-cols-3 gap-4 text-center text-[9px]">
          {(
            [
              "daily.signDailySi",
              "daily.signAdmin",
              "daily.signCommandant",
            ] as const
          ).map((key) => (
            <div key={key} className="pt-8">
              <div className="mx-auto mb-2 h-px w-28 bg-black" />
              <p>{t(key)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
