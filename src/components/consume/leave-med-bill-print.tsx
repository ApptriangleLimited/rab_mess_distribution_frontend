"use client";

import { forwardRef } from "react";
import { ConsumeReportMasthead } from "@/components/consume/consume-report-masthead";
import { formatMonthDash } from "@/lib/date";
import { formatBdtAmount } from "@/lib/money";
import type { LeaveMedBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
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
  preview?: boolean;
};

const SIGNS = [
  "Daily SI",
  "Consume SI",
  "Mess CQ SI",
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
      preview = false,
    },
    ref,
  ) {
    const t = useT();
    const monthLabel = formatMonthDash(month);

    return (
      <div
        ref={ref}
        className={cn(
          "leave-med-bill-print text-black",
          preview
            ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
            : "hidden print:block",
        )}
      >
        <ConsumeReportMasthead
          title={t("consume.leaveMedBillTitle", { month: monthLabel })}
        />

        <table className="w-full border-collapse text-center text-[10px] text-black">
          <thead>
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
                Fresh money babod taka
              </th>
              <th className="border border-black px-1 py-1">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.id}>
                <td className="border border-black px-1 py-0.5 tabular-nums">
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
                    className="border border-black px-1 py-0.5 tabular-nums"
                  >
                    {cell(row.tagDays[code] ?? 0)}
                  </td>
                ))}
                <td className="border border-black px-1 py-0.5 tabular-nums">
                  {cell(row.totalDays)}
                </td>
                <td className="border border-black px-1 py-0.5 tabular-nums">
                  {formatBdtAmount(row.amount)}
                </td>
                <td className="border border-black px-1 py-0.5">{row.remarks}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
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
                  className="border border-black px-1 py-1 tabular-nums"
                >
                  {cell(tagTotals[code] ?? 0)}
                </td>
              ))}
              <td className="border border-black px-1 py-1 tabular-nums">
                {cell(totalDays)}
              </td>
              <td className="border border-black px-1 py-1 tabular-nums">
                {formatBdtAmount(totalAmount)}
              </td>
              <td className="border border-black px-1 py-1" />
            </tr>
          </tfoot>
        </table>

        <ConsumeSignOff
          className="grid-cols-2 gap-4 text-[11px] sm:grid-cols-6"
          labels={[...SIGNS]}
        />
      </div>
    );
  },
);
