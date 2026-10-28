"use client";

import { forwardRef } from "react";
import { ConsumeReportMasthead } from "@/components/consume/consume-report-masthead";
import { formatMonthDash } from "@/lib/date";
import { formatBdtAmount } from "@/lib/money";
import type { LeaveMedBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
import { chunkBillRows } from "@/lib/consume-bill-pages";
import { consumeRankShort } from "@/lib/consume-rank-short";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tags: readonly DailyTag[];
  rows: LeaveMedBillRow[];
  tagTotals: Partial<Record<DailyTag, number>>;
  totalDays: number;
  totalAmount: number;
  rate: number;
  wingLabel?: string;
  pageBreak?: boolean;
  preview?: boolean;
};

const SIGNS = [
  "Daily SI",
  "Consume SI",
  "Senior DAD (Admin)",
  "President\nMess Committee, Forces Mess",
  "Major\nDeputy Director (HQ)\nSRB Forces Headquarters",
] as const;

function cell(n: number) {
  return n ? String(n) : "";
}

export const LeaveMedBillPrint = forwardRef<HTMLDivElement, Props>(
  function LeaveMedBillPrint(
    {
      month,
      tags,
      rows,
      tagTotals,
      totalDays,
      totalAmount,
      rate,
      wingLabel,
      pageBreak = false,
      preview = false,
    },
    ref,
  ) {
    const t = useT();
    const monthLabel = formatMonthDash(month);
    const pages = chunkBillRows(rows);

    return (
      <div
        ref={ref}
        className={cn(
          "leave-med-bill-print flex flex-col gap-6 text-black",
          pageBreak && "consume-wing-break",
          preview ? "block" : "hidden print:block",
        )}
      >
        {pages.map((pageRows, pageIndex) => {
          return (
        <section
          key={pageIndex}
          className={cn(
            "consume-bill-page consume-bill-page--full consume-bill-page--signed",
            pageIndex > 0 && "consume-wing-break",
            preview &&
              "overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700",
          )}
        >
        <div className="consume-bill-sheet">
        <table className="w-full border-collapse text-[10px] text-black">
          <thead>
            <tr className="consume-bill-title-row">
              <th
                colSpan={7 + tags.length}
                className="consume-bill-title-cell border-0 bg-white pb-2 text-center"
              >
                <ConsumeReportMasthead
                  title={t("consume.leaveMedBillTitle", {
                    wing: (wingLabel ?? "").trim().toUpperCase(),
                    month: monthLabel.toUpperCase(),
                  })}
                  className="mb-0"
                />
              </th>
            </tr>
            <tr className="consume-col-titles border border-black bg-neutral-100">
              <th className="border border-black px-1 py-1">SL</th>
              <th className="border border-black px-1 py-1">{t("consume.colId")}</th>
              <th className="border border-black px-1 py-1">Rank</th>
              <th className="border border-black px-1 py-1">Name</th>
              {tags.map((code) => (
                <th key={code} className="border border-black px-1 py-1">
                  {code}
                </th>
              ))}
              <th className="border border-black px-1 py-1">Total</th>
              <th className="border border-black px-1 py-1 leading-tight">
                {t("consume.colFreshMoneyRate", {
                  rate: formatBdtAmount(rate),
                })}
              </th>
              <th className="border border-black px-1 py-1">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.user.id}>
                <td className="consume-sl border border-black px-1 py-0.5 text-center tabular-nums">
                  {row.sl}
                </td>
                <td className="border border-black px-1 py-0.5 font-mono">
                  {row.user.personal_id || "—"}
                </td>
                <td className="border border-black px-1 py-0.5">
                  {consumeRankShort(row.user.rank)}
                </td>
                <td className="border border-black px-1 py-0.5">
                  {row.user.name}
                </td>
                {tags.map((code) => (
                  <td
                    key={code}
                    className="consume-num border border-black px-1 py-0.5 text-right tabular-nums"
                  >
                    {cell(row.tagDays[code] ?? 0)}
                  </td>
                ))}
                <td className="consume-num border border-black px-1 py-0.5 text-right tabular-nums">
                  {cell(row.totalDays)}
                </td>
                <td className="consume-money consume-num border border-black px-1 py-0.5 text-right tabular-nums">
                  {formatBdtAmount(row.amount)}
                </td>
                <td className="border border-black px-1 py-0.5">{row.remarks}</td>
              </tr>
            ))}
            <tr className="border border-black font-semibold">
              <td
                colSpan={4}
                className="border border-black px-1 py-1 text-left"
              >
                Total
              </td>
              {tags.map((code) => (
                <td
                  key={code}
                  className="consume-num border border-black px-1 py-1 text-right tabular-nums"
                >
                  {cell(tagTotals[code] ?? 0)}
                </td>
              ))}
              <td className="consume-num border border-black px-1 py-1 text-right tabular-nums">
                {cell(totalDays)}
              </td>
              <td className="consume-money consume-num border border-black px-1 py-1 text-right tabular-nums">
                {formatBdtAmount(totalAmount)}
              </td>
              <td className="border border-black px-1 py-1" />
            </tr>
          </tbody>
        </table>

        <div className="consume-bill-signs">
        <ConsumeSignOff
          className="mt-0 grid-cols-2 gap-4 text-[11px] sm:grid-cols-5"
          labels={[...SIGNS]}
        />
        </div>
        </div>
        </section>
          );
        })}
      </div>
    );
  },
);
