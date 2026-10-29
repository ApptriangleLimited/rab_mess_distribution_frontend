"use client";

import { forwardRef } from "react";
import { ConsumeReportMasthead } from "@/components/consume/consume-report-masthead";
import { formatMonthDash } from "@/lib/date";
import { formatBdtAmount } from "@/lib/money";
import { formatBdt, type TagBillRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { useT } from "@/i18n/provider";
import { chunkBillRows } from "@/lib/consume-bill-pages";
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
  /** Settings daily allowance rate shown in the column title. */
  allowanceRate?: number;
  /** Settings daily fuel rate shown in the column title. */
  fuelRate?: number;
  showFuel: boolean;
  /** Fuel bill: FR+MFR days, Fuel ৳, grand total = fuel. No allowance column. */
  fuelOnly?: boolean;
  /** Official wing name, same split as the consume summary. */
  wingLabel?: string;
  /** Start this wing's bill on a new printed page. */
  pageBreak?: boolean;
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
      allowanceRate,
      fuelRate,
      showFuel,
      fuelOnly = false,
      wingLabel,
      pageBreak = false,
      preview = false,
    },
    ref,
  ) {
  const t = useT();
  const monthLabel = formatMonthDash(month);
  const showAllowance = !fuelOnly;
  const tagKey = `${tag} ${tagLabel}`.toUpperCase();
  const titleParts = {
    wing: (wingLabel ?? "").trim().toUpperCase(),
    month: monthLabel.toUpperCase(),
  };
  const title =
    tagKey.includes("CD") && !tagKey.includes("FR")
      ? t("consume.cdBillTitle", titleParts)
      : t("consume.frBillTitle", titleParts);
  const pages = chunkBillRows(rows);
  const multiPage = pages.length > 1;
  const colCount =
    7 + (showAllowance ? 1 : 0) + (showFuel || fuelOnly ? 1 : 0);

  function moneyTotal(days: number, amount: number, fuel: number, grand: number) {
    return (
      <>
        <td className="consume-num border border-black px-1.5 py-1.5 text-right tabular-nums">
          {days}
        </td>
        {showAllowance ? (
          <td className="consume-money consume-num border border-black px-1.5 py-1.5 text-right tabular-nums">
            {formatBdt(amount)}
          </td>
        ) : null}
        {showFuel || fuelOnly ? (
          <td className="consume-money consume-num border border-black px-1.5 py-1.5 text-right tabular-nums">
            {formatBdt(fuel)}
          </td>
        ) : null}
        <td className="consume-money consume-num border border-black px-1.5 py-1.5 text-right tabular-nums">
          {formatBdt(fuelOnly ? fuel : grand)}
        </td>
        <td className="border border-black px-1.5 py-1.5" />
      </>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "tag-bill-print flex flex-col gap-6 text-black",
        pageBreak && "consume-wing-break",
        preview ? "block" : "hidden print:block",
      )}
    >
      {pages.map((pageRows, pageIndex) => {
        const lastPage = pageIndex === pages.length - 1;
        const pageDays = pageRows.reduce((s, r) => s + r.days, 0);
        const pageAmount = pageRows.reduce((s, r) => s + r.amount, 0);
        const pageFuel = pageRows.reduce((s, r) => s + r.fuelAmount, 0);
        const pageGrand = pageRows.reduce((s, r) => s + r.grandTotal, 0);
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
      <table className="w-full border-collapse text-[11px] text-black">
        <thead>
          <tr className="consume-bill-title-row">
            <th
              colSpan={colCount}
              className="consume-bill-title-cell border-0 bg-white pb-2 text-center"
            >
              <ConsumeReportMasthead title={title} className="mb-0" />
            </th>
          </tr>
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
              <th className="border border-black px-1.5 py-1 leading-tight">
                {t("consume.colFreshAmountRate", {
                  rate: formatBdtAmount(allowanceRate ?? rows[0]?.rate ?? 0),
                })}
              </th>
            ) : null}
            {showFuel || fuelOnly ? (
              <th className="border border-black px-1.5 py-1 leading-tight">
                {t("consume.colFuelAmountRate", {
                  rate: formatBdtAmount(fuelRate ?? rows[0]?.fuelRate ?? 0),
                })}
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
          {pageRows.map((row) => (
            <tr key={row.user.id}>
              <td className="consume-sl border border-black px-1.5 py-1 text-center tabular-nums">
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
              <td className="consume-num border border-black px-1.5 py-1 text-right tabular-nums">
                {row.days}
              </td>
              {showAllowance ? (
                <td className="consume-money consume-num border border-black px-1.5 py-1 text-right tabular-nums">
                  {formatBdt(row.amount)}
                </td>
              ) : null}
              {showFuel || fuelOnly ? (
                <td className="consume-money consume-num border border-black px-1.5 py-1 text-right tabular-nums">
                  {formatBdt(row.fuelAmount)}
                </td>
              ) : null}
              <td className="consume-money consume-num border border-black px-1.5 py-1 text-right tabular-nums font-medium">
                {formatBdt(fuelOnly ? row.fuelAmount : row.grandTotal)}
              </td>
              <td className="border border-black px-1.5 py-1">
                {row.remarks || ""}
              </td>
            </tr>
          ))}
          {multiPage ? (
            <tr className="border border-black font-semibold">
              <td
                colSpan={4}
                className="border border-black px-1.5 py-1.5 text-left"
              >
                {t("consume.colPageTotal")}
              </td>
              {moneyTotal(pageDays, pageAmount, pageFuel, pageGrand)}
            </tr>
          ) : null}
          {lastPage ? (
            <tr className="border border-black font-bold">
              <td
                colSpan={4}
                className="border border-black px-1.5 py-1.5 text-left"
              >
                {t("consume.billTotal")}
              </td>
              {moneyTotal(totalDays, totalAmount, totalFuel, grandTotal)}
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="consume-bill-signs">
      <ConsumeSignOff
        className="mt-0 grid-cols-2 gap-4 text-[11px] sm:grid-cols-5"
        labels={(
          [
            "consume.signDailySi",
            "consume.signConsumeSi",
            "consume.signSeniorDad",
            "consume.signMessPresident",
            "consume.signLastOfficer",
          ] as const
        ).map((key) => t(key))}
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
