"use client";

import { CONSUME_REPORT_META } from "@/lib/constants";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { useT } from "@/i18n/provider";

type Props = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
};

export function MonthLedgerPrint({ month, dayCount, tagCodes, rows }: Props) {
  const t = useT();
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  return (
    <div className="month-ledger-print hidden print:block">
      <header className="mb-3 text-center text-black">
        <p className="text-sm font-semibold">{CONSUME_REPORT_META.orgNameBn}</p>
        <p className="text-xs">{CONSUME_REPORT_META.stationBn}</p>
        <p className="mt-2 text-base font-bold">
          {t("consume.ledgerTitle", { month })}
        </p>
      </header>

      <div className="overflow-visible">
        <table className="w-full border-collapse text-[8px] text-black">
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
                <th key={d} className="border border-black px-0.5 py-0.5">
                  {d}
                </th>
              ))}
              {tagCodes.map((code) => (
                <th key={code} className="border border-black px-0.5 py-0.5">
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.user.id}>
                <td className="border border-black px-0.5 py-0.5 text-center">
                  {i + 1}
                </td>
                <td className="border border-black px-0.5 py-0.5 whitespace-nowrap">
                  {row.user.rank}
                </td>
                <td className="border border-black px-0.5 py-0.5 text-left whitespace-nowrap">
                  {row.user.name}
                </td>
                {row.days.map((cell, di) => (
                  <td
                    key={di}
                    className="border border-black px-0.5 py-0.5 text-center font-mono"
                  >
                    {cell || ""}
                  </td>
                ))}
                {tagCodes.map((code) => (
                  <td
                    key={code}
                    className="border border-black px-0.5 py-0.5 text-center tabular-nums"
                  >
                    {row.tagCounts[code] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
