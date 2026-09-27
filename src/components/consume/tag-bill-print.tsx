"use client";

import { forwardRef } from "react";
import { ConsumeReportMasthead } from "@/components/consume/consume-report-masthead";
import { formatMonthDash } from "@/lib/date";
import { formatBdt, type TagBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
import { consumeRankShort } from "@/lib/consume-rank-short";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tag: DailyTag | string;
  tagLabel: string;
  rows: TagBillRow[];
  totalDays: number;
  totalAmount: number;
  totalFuel: number;
  grandTotal: number;
  showFuel: boolean;
  /** Fuel bill: FR+MFR days, Fuel ৳, grand total = fuel. No allowance column. */
  fuelOnly?: boolean;
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
      fuelOnly = false,
      preview = false,
    },
    ref,
  ) {
  const t = useT();
  const monthLabel = formatMonthDash(month);
  const centerDays = String(tag).toUpperCase().includes("FR");
  const showAllowance = !fuelOnly;
  const tagKey = `${tag} ${tagLabel}`.toUpperCase();
  const title = tagKey.includes("CD") && !tagKey.includes("FR")
    ? t("consume.cdBillTitle", { month: monthLabel })
    : t("consume.frBillTitle", { month: monthLabel });

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
      <ConsumeReportMasthead title={title} />

      <table className="w-full border-collapse text-center text-[11px] text-black">
        <thead>
          <tr className="consume-col-titles border border-black bg-neutral-100">
            <th className="border border-black px-1.5 py-1">
              {fuelOnly ? "SI" : t("consume.colSl")}
            </th>
            <th className="border border-black px-1.5 py-1">
              {fuelOnly ? "ID" : t("consume.colId")}
            </th>
            <th className="border border-black px-1.5 py-1">{t("consume.colRank")}</th>
            <th className="border border-black px-1.5 py-1">
              {t("consume.colName")}
            </th>
            <th className="border border-black px-1.5 py-1">{tag}</th>
            {showAllowance ? (
              <th className="border border-black px-1.5 py-1">
                {t("consume.colFreshAmount")}
              </th>
            ) : null}
            {showFuel || fuelOnly ? (
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
              <td className="border border-black px-1.5 py-1 tabular-nums">
                {row.sl}
              </td>
              <td className="border border-black px-1.5 py-1 font-mono text-[10px]">
                {row.user.personal_id || "—"}
              </td>
              <td className="border border-black px-1.5 py-1">
                {consumeRankShort(row.user.rank)}
              </td>
              <td className="border border-black px-1.5 py-1">
                {row.user.name}
              </td>
              <td
                className={cn(
                  "border border-black px-1.5 py-1 tabular-nums",
                  centerDays && "consume-days",
                )}
              >
                {row.days}
              </td>
              {showAllowance ? (
                <td className="consume-money border border-black px-1.5 py-1 tabular-nums">
                  {formatBdt(row.amount)}
                </td>
              ) : null}
              {showFuel || fuelOnly ? (
                <td className="consume-money border border-black px-1.5 py-1 tabular-nums">
                  {formatBdt(row.fuelAmount)}
                </td>
              ) : null}
              <td className="consume-money border border-black px-1.5 py-1 tabular-nums font-medium">
                {formatBdt(fuelOnly ? row.fuelAmount : row.grandTotal)}
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
              className="border border-black px-1.5 py-1.5 text-left"
            >
              {t("consume.billTotal")}
            </td>
            <td
              className={cn(
                "border border-black px-1.5 py-1.5 tabular-nums",
                centerDays && "consume-days",
              )}
            >
              {totalDays}
            </td>
            {showAllowance ? (
              <td className="consume-money border border-black px-1.5 py-1.5 tabular-nums">
                {formatBdt(totalAmount)}
              </td>
            ) : null}
            {showFuel || fuelOnly ? (
              <td className="consume-money border border-black px-1.5 py-1.5 tabular-nums">
                {formatBdt(totalFuel)}
              </td>
            ) : null}
            <td className="consume-money border border-black px-1.5 py-1.5 tabular-nums">
              {formatBdt(fuelOnly ? totalFuel : grandTotal)}
            </td>
            <td className="border border-black px-1.5 py-1.5" />
          </tr>
        </tfoot>
      </table>

      {fuelOnly ? null : (
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
      )}
    </div>
  );
  },
);
