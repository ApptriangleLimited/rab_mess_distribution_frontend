"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatBdt, type TagBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tag: DailyTag;
  tagLabel: string;
  rows: TagBillRow[];
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
  showFuel: boolean;
  /** Show on-screen for review; default print-only. */
  preview?: boolean;
};

export const TagBillPrint = forwardRef<HTMLDivElement, Props>(
  function TagBillPrint(
    {
      month,
      tag,
      tagLabel,
      rows,
      totalDays,
      totalAmount,
      totalFuel,
      grandTotal,
      showFuel,
      preview = false,
    },
    ref,
  ) {
  const t = useT();
  const [year, mon] = month.split("-");

  return (
    <div
      ref={ref}
      className={cn(
        "tag-bill-print text-black",
        preview
          ? "block overflow-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700"
          : "hidden print:block",
      )}
    >
      <header className="mb-4 text-center text-black">
        <p className="text-[10px] text-neutral-600">{CONSUME_REPORT_META.formNo}</p>
        <p className="text-sm font-semibold">{CONSUME_REPORT_META.orgNameBn}</p>
        <p className="text-xs">{CONSUME_REPORT_META.orgName}</p>
        <p className="mt-2 text-base font-bold tracking-wide">
          {t("consume.billTitle", { label: tagLabel, month, tag })}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-[11px]">
          <p>
            {t("consume.metaWing")}: {CONSUME_REPORT_META.wingBn}
          </p>
          <p>
            {t("consume.metaStation")}: {CONSUME_REPORT_META.stationBn}
          </p>
          <p>
            {t("consume.month")}: {mon}/{year}
          </p>
          <p>
            {t("consume.tag")}: {tag}
          </p>
        </div>
      </header>

      <table className="w-full border-collapse text-[11px] text-black">
        <thead>
          <tr className="border border-black bg-neutral-100">
            <th className="border border-black px-1.5 py-1">{t("consume.colSl")}</th>
            <th className="border border-black px-1.5 py-1">{t("consume.colId")}</th>
            <th className="border border-black px-1.5 py-1">{t("consume.colRank")}</th>
            <th className="border border-black px-1.5 py-1 text-left">
              {t("consume.colName")}
            </th>
            <th className="border border-black px-1.5 py-1">{tag}</th>
            <th className="border border-black px-1.5 py-1">
              {t("consume.colFreshAmount")}
            </th>
            {showFuel ? (
              <th className="border border-black px-1.5 py-1">
                {t("consume.colFuelAmount")}
              </th>
            ) : null}
            <th className="border border-black px-1.5 py-1">
              {t("consume.colGrandTotal")}
            </th>
            <th className="border border-black px-1.5 py-1">
              {t("consume.colRemarks")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user.id}>
              <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                {row.sl}
              </td>
              <td className="border border-black px-1.5 py-1 font-mono text-[10px]">
                {row.user.rab_id}
              </td>
              <td className="border border-black px-1.5 py-1">{row.user.rank}</td>
              <td className="border border-black px-1.5 py-1 text-left">
                {row.user.name}
              </td>
              <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                {row.days}
              </td>
              <td className="border border-black px-1.5 py-1 text-right tabular-nums">
                {formatBdt(row.amount)}
              </td>
              {showFuel ? (
                <td className="border border-black px-1.5 py-1 text-right tabular-nums">
                  {formatBdt(row.fuelAmount)}
                </td>
              ) : null}
              <td className="border border-black px-1.5 py-1 text-right tabular-nums font-medium">
                {formatBdt(row.grandTotal)}
              </td>
              <td className="border border-black px-1.5 py-1">
                {row.remarks || ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border border-black font-semibold">
            <td
              colSpan={4}
              className="border border-black px-1.5 py-1.5 text-right"
            >
              {t("consume.billTotal")}
            </td>
            <td className="border border-black px-1.5 py-1.5 text-center tabular-nums">
              {totalDays}
            </td>
            <td className="border border-black px-1.5 py-1.5 text-right tabular-nums">
              {formatBdt(totalAmount)}
            </td>
            {showFuel ? (
              <td className="border border-black px-1.5 py-1.5 text-right tabular-nums">
                {formatBdt(totalFuel)}
              </td>
            ) : null}
            <td className="border border-black px-1.5 py-1.5 text-right tabular-nums">
              {formatBdt(grandTotal)}
            </td>
            <td className="border border-black px-1.5 py-1.5" />
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
