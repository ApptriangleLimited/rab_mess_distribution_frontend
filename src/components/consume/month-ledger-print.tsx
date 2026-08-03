"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
  /** Show on screen for iframe print capture; default print-only. */
  preview?: boolean;
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function toBnDigits(n: number) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Landscape Forces Mess consume ledger — matches BN register print. */
export const MonthLedgerPrint = forwardRef<HTMLDivElement, Props>(
  function MonthLedgerPrint(
    { month, dayCount, tagCodes, rows, preview = false },
    ref,
  ) {
    const t = useT();
    const { locale } = useI18n();
    const days = Array.from({ length: dayCount }, (_, i) => i + 1);
    const monthBn = formatMonthLong(month, "bn-BD");
    const monthEn = formatMonthLong(month);
    const useBn = locale === "bn";

    const dayLabel = (d: number) => (useBn ? toBnDigits(d) : String(d));
    const serLabel = (n: number) => (useBn ? toBnDigits(n) : String(n));

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
            ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
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

        <table className="w-full border-collapse text-[7px] leading-tight">
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-0.5 py-0.5">
                {t("consume.colSl")}
              </th>
              <th className="border border-black px-0.5 py-0.5 text-left">
                {t("consume.colRank")}
              </th>
              <th className="border border-black px-0.5 py-0.5 text-left">
                {t("consume.colName")}
              </th>
              {days.map((d) => (
                <th key={d} className="border border-black px-0 py-0.5 w-3">
                  {dayLabel(d)}
                </th>
              ))}
              {tagCodes.map((code) => (
                <th key={code} className="border border-black px-0.5 py-0.5">
                  {code}
                </th>
              ))}
              <th className="border border-black px-0.5 py-0.5">
                {t("consume.colTotalDays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.user.id}>
                <td className="border border-black px-0.5 py-0 text-center tabular-nums">
                  {serLabel(i + 1)}
                </td>
                <td className="border border-black px-0.5 py-0 whitespace-nowrap">
                  {row.user.rank}
                </td>
                <td className="border border-black px-0.5 py-0 text-left whitespace-nowrap">
                  {row.user.name}
                </td>
                {row.days.map((cell, di) => (
                  <td
                    key={di}
                    className="border border-black px-0 py-0 text-center font-mono"
                  >
                    {cell || ""}
                  </td>
                ))}
                {tagCodes.map((code) => (
                  <td
                    key={code}
                    className="border border-black px-0.5 py-0 text-center tabular-nums"
                  >
                    {row.tagCounts[code] ?? ""}
                  </td>
                ))}
                <td className="border border-black px-0.5 py-0 text-center tabular-nums font-semibold">
                  {row.totalDays || ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border border-black font-semibold">
              <td
                colSpan={3}
                className="border border-black px-1 py-1 text-right"
              >
                {t("consume.colGrandTotal")}
              </td>
              {days.map((d) => (
                <td key={d} className="border border-black px-0 py-1" />
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

        <div className="mt-10 grid grid-cols-4 gap-4 text-center text-[9px]">
          {(
            [
              "consume.signConsumeSi",
              "consume.signPicketSi",
              "consume.signSeniorDad",
              "consume.signMessPresident",
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
