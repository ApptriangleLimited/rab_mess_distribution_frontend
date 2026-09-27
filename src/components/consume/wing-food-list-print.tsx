"use client";

import { forwardRef } from "react";
import {
  officialFrDays,
  type OfficialConsumeTable,
} from "@/lib/consume-official-reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { cn } from "@/lib/utils";

type Props = {
  table: OfficialConsumeTable;
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
  return n ? String(n) : "0";
}

export const WingFoodListPrint = forwardRef<HTMLDivElement, Props>(
  function WingFoodListPrint({ table, preview = false }, ref) {
    const all = [...table.rows, { ...table.totals, label: "Total" }];

    return (
      <div
        ref={ref}
        className={cn(
          "wing-food-list-print text-black",
          preview
            ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
            : "hidden print:block",
        )}
      >
        <header className="consume-masthead letter-masthead mb-10 text-center">
          <p className="wing-food-title text-[20px] font-bold leading-tight">
            {table.title}
          </p>
          {table.lines[0] ? (
            <p className="wing-food-report-title mt-1.5 text-[16px] font-bold leading-snug">
              {table.lines[0]}
            </p>
          ) : null}
          {table.lines[1] ? (
            <p className="wing-food-hq mt-1.5 text-[9px] font-normal leading-snug text-neutral-400">
              {table.lines[1]}
            </p>
          ) : null}
        </header>

        <table className="w-full border-collapse text-[10px] text-black">
          <thead>
            <tr className="consume-col-titles border border-black bg-neutral-100">
              <th className="border border-black px-1 py-1">SL</th>
              <th className="border border-black px-1 py-1">Page no</th>
              <th className="border border-black px-1 py-1">Manpower</th>
              <th className="border border-black px-1 py-1">MS</th>
              <th className="border border-black px-1 py-1">FR</th>
              <th className="border border-black px-1 py-1">CL</th>
              <th className="border border-black px-1 py-1">PL</th>
              <th className="border border-black px-1 py-1">CD</th>
              <th className="border border-black px-1 py-1">TRG</th>
              <th className="border border-black px-1 py-1">WT</th>
              <th className="border border-black px-1 py-1">MED</th>
              <th className="border border-black px-1 py-1">BGH</th>
              <th className="border border-black px-1 py-1">LNK</th>
              <th className="border border-black px-1 py-1">WR</th>
              <th className="border border-black px-1 py-1">Total days</th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <tr
                key={row.id}
                className={cn(row.id === "total" && "font-semibold")}
              >
                {row.id === "total" ? (
                  <td
                    colSpan={2}
                    className="border border-black px-1 py-0.5 text-left"
                  >
                    Total
                  </td>
                ) : (
                  <>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {row.sl || ""}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {row.label}
                    </td>
                  </>
                )}
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.manpower)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.MS ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(officialFrDays(row.tagDays))}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.CL ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.PL ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.CD ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.TRG ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.WIT ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.MED ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.BGH ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.LNK ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.WR ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.totalDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ConsumeSignOff
          className="grid-cols-2 gap-4 text-[11px] sm:grid-cols-6"
          labels={[...SIGNS]}
        />
      </div>
    );
  },
);
