"use client";

import { forwardRef } from "react";
import type { OfficialConsumeTable } from "@/lib/consume-official-reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { cn } from "@/lib/utils";

type Props = {
  table: OfficialConsumeTable;
  preview?: boolean;
};

const SIGNS = [
  "ডেইলি এসআই",
  "কনজিউম এসআই",
  "মেস সি কিউ এসআই",
  "সিনিয়র ডিএডি (প্রশাসন)",
  "সভাপতি\nমেস কমিটি, ফোর্সেস মেস",
  "মেজর\nউপ-পরিচালক (সদর দপ্তর)\nএসআরবি ফোর্সেস সদর দপ্তর",
] as const;

function cell(n: number) {
  return n ? String(n) : "0";
}

export const WingFoodListPrint = forwardRef<HTMLDivElement, Props>(
  function WingFoodListPrint({ table, preview = false }, ref) {
    const all = [...table.rows, { ...table.totals, label: "মোট" }];

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
        <header className="mb-3 text-center">
          <p className="text-[13px] font-bold">{table.title}</p>
          {table.lines.map((line) => (
            <p key={line} className="text-[11px] font-semibold">
              {line}
            </p>
          ))}
        </header>

        <table className="w-full border-collapse text-[10px] text-black">
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-1 py-1">ক্রমিক</th>
              <th className="border border-black px-1 py-1">পাতা নং</th>
              <th className="border border-black px-1 py-1">জনবল</th>
              <th className="border border-black px-1 py-1">দিন</th>
              <th className="border border-black px-1 py-1">FR</th>
              <th className="border border-black px-1 py-1">CL</th>
              <th className="border border-black px-1 py-1">PL</th>
              <th className="border border-black px-1 py-1">CD</th>
              <th className="border border-black px-1 py-1">TRG</th>
              <th className="border border-black px-1 py-1">Witness</th>
              <th className="border border-black px-1 py-1">MED</th>
              <th className="border border-black px-1 py-1">BGH</th>
              <th className="border border-black px-1 py-1 leading-tight">
                রেশন বিহীন
              </th>
              <th className="border border-black px-1 py-1">মোট দিন</th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <tr
                key={row.id}
                className={cn(row.id === "total" && "font-semibold")}
              >
                <td className="border border-black px-1 py-0.5 text-center">
                  {row.sl || ""}
                </td>
                <td className="border border-black px-1 py-0.5 text-left">
                  {row.label}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.manpower)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.MS ?? 0)}
                </td>
                <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                  {cell(row.tagDays.FR ?? 0)}
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
