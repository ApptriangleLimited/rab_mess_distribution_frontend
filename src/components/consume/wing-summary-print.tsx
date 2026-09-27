"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import type { DailyTag } from "@/lib/types";
import type { WingSummaryRow } from "@/lib/reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tagCodes: DailyTag[];
  rows: WingSummaryRow[];
  totals: {
    manpower: number;
    tagDays: Partial<Record<DailyTag, number>>;
    totalDays: number;
  };
  /** Show on-screen for review; default print-only. */
  preview?: boolean;
};

export const WingSummaryPrint = forwardRef<HTMLDivElement, Props>(
  function WingSummaryPrint(
    { month, tagCodes, rows, totals, preview = false },
    ref,
  ) {
  const t = useT();

  return (
    <div
      ref={ref}
      className={cn(
        "wing-summary-print text-black",
        preview
          ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
          : "hidden print:block",
      )}
    >
      <header className="consume-masthead mb-8 text-center text-black">
        <p className="text-sm font-semibold">{CONSUME_REPORT_META.orgNameBn}</p>
        <p className="text-xs">{CONSUME_REPORT_META.stationBn}</p>
        <p className="mt-2 text-base font-bold">
          {t("consume.wingSummaryTitle", { month })}
        </p>
      </header>

      <table className="w-full border-collapse text-[10px] text-black">
        <thead>
          <tr className="consume-col-titles border border-black bg-neutral-100">
            <th className="border border-black px-1 py-1">
              {t("consume.colWing")}
            </th>
            <th className="border border-black px-1 py-1">
              {t("consume.colManpower")}
            </th>
            {tagCodes.map((code) => (
              <th key={code} className="border border-black px-1 py-1">
                {code}
              </th>
            ))}
            <th className="border border-black px-1 py-1">
              {t("consume.colTotalDays")}
            </th>
            <th className="border border-black px-1 py-1">
              {t("consume.colRemarks")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.wing}>
              <td className="border border-black px-1 py-1 text-left">
                {row.wing}
              </td>
              <td className="border border-black px-1 py-1 text-center tabular-nums">
                {row.manpower}
              </td>
              {tagCodes.map((code) => (
                <td
                  key={code}
                  className="border border-black px-1 py-1 text-center tabular-nums"
                >
                  {row.tagDays[code] ?? 0}
                </td>
              ))}
              <td className="border border-black px-1 py-1 text-center tabular-nums font-medium">
                {row.totalDays}
              </td>
              <td className="border border-black px-1 py-1" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="border border-black px-1 py-1.5 text-left">
              {t("consume.billTotal")}
            </td>
            <td className="border border-black px-1 py-1.5 text-center tabular-nums">
              {totals.manpower}
            </td>
            {tagCodes.map((code) => (
              <td
                key={code}
                className="border border-black px-1 py-1.5 text-center tabular-nums"
              >
                {totals.tagDays[code] ?? 0}
              </td>
            ))}
            <td className="border border-black px-1 py-1.5 text-center tabular-nums">
              {totals.totalDays}
            </td>
            <td className="border border-black px-1 py-1.5" />
          </tr>
        </tfoot>
      </table>

      <ConsumeSignOff
        className="grid-cols-2 gap-4 text-[11px] sm:grid-cols-6"
        labels={(
          [
            "consume.signDailySi",
            "consume.signConsumeSi",
            "consume.signScheduleSi",
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
