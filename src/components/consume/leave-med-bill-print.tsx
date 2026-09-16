"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatMonthDash } from "@/lib/date";
import { formatBdtAmount } from "@/lib/money";
import type { LeaveMedBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
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
        <header className="mb-3 text-center">
          <p className="text-[10px]">{CONSUME_REPORT_META.formNo}</p>
          <p className="text-sm font-semibold">{CONSUME_REPORT_META.orgName}</p>
          <p className="text-[11px]">
            {CONSUME_REPORT_META.orgName} Camp, {CONSUME_REPORT_META.station}
          </p>
          <p className="mt-2 text-sm font-bold">
            Fresh money bill — {monthLabel} (CL, PL, Training, Witness, Doctor
            and BGH bill)
          </p>
        </header>

        <table className="w-full border-collapse text-[10px] text-black">
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-1 py-1">Sl</th>
              <th className="border border-black px-1 py-1">No</th>
              <th className="border border-black px-1 py-1">Rank</th>
              <th className="border border-black px-1 py-1 text-left">Name</th>
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
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {row.sl}
                </td>
                <td className="border border-black px-1 py-0.5 font-mono">
                  {row.user.personal_id || "—"}
                </td>
                <td className="border border-black px-1 py-0.5">{row.user.rank}</td>
                <td className="border border-black px-1 py-0.5 text-left">
                  {row.user.name}
                </td>
                {tags.map((code) => (
                  <td
                    key={code}
                    className="border border-black px-1 py-0.5 text-center tabular-nums"
                  >
                    {cell(row.tagDays[code] ?? 0)}
                  </td>
                ))}
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.totalDays)}
                </td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">
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
                className="border border-black px-1 py-1 text-right"
              >
                Total
              </td>
              {tags.map((code) => (
                <td
                  key={code}
                  className="border border-black px-1 py-1 text-center tabular-nums"
                >
                  {cell(tagTotals[code] ?? 0)}
                </td>
              ))}
              <td className="border border-black px-1 py-1 text-center tabular-nums">
                {cell(totalDays)}
              </td>
              <td className="border border-black px-1 py-1 text-right tabular-nums">
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
