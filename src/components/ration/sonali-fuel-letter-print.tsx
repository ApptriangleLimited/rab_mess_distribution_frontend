"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import type { RationStaffSheet } from "@/lib/reports";
import {
  SONALI_FUEL_COLUMNS,
  sonaliFuelBody,
  sonaliFuelCells,
  sonaliFuelSubject,
} from "@/lib/sonali-bank-letter";
import { trustBankMoney } from "@/lib/trust-bank-letter";
import { cn } from "@/lib/utils";

type Props = {
  sheet: RationStaffSheet;
  className?: string;
};

/** FR Fuel + Sonali Bank — staff letter with G/Total and amount in words. */
export const SonaliFuelLetterPrint = forwardRef<HTMLDivElement, Props>(
  function SonaliFuelLetterPrint({ sheet, className }, ref) {
    const monthLabel = formatMonthLong(sheet.month);
    const city =
      sheet.sender.branch_location?.trim() ||
      RATION_REPORT_META.station.split(",")[1]?.trim() ||
      "Dhaka";

    return (
      <div
        ref={ref}
        className={cn(
          "sonali-fuel-letter staff-payout-print text-black",
          "box-border block w-[210mm] min-h-[297mm] max-w-none overflow-visible",
          "bg-white p-5",
          className,
        )}
      >
        <section>
          <div className="letter-masthead mb-4 text-center">
            <p className="text-[10px] text-neutral-700">
              {RATION_REPORT_META.govLine}
            </p>
            <p className="text-[10px] text-neutral-700">
              {RATION_REPORT_META.policeLine}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {RATION_REPORT_META.orgName}
            </p>
            <p className="text-[10px] text-neutral-600">
              {RATION_REPORT_META.station}
            </p>
          </div>

          <div className="mb-3 flex items-start justify-between gap-4 text-[11px]">
            <p className="text-left">
              {RATION_REPORT_META.refPrefix}/{sheet.month}
            </p>
            <p className="shrink-0 text-right font-medium">DT: {monthLabel}</p>
          </div>

          <div className="mb-3 space-y-0.5 text-left text-[11px]">
            <p>
              <span className="font-semibold">To,</span>
            </p>
            <p>Manager</p>
            <p>{sheet.sender.bank_name || sheet.sender.label}</p>
            {sheet.sender.branch ? <p>{sheet.sender.branch}</p> : null}
            <p>{city}</p>
          </div>

          <p className="mb-3 text-left text-[11px] font-bold underline decoration-1 underline-offset-2">
            SUBJECT: {sonaliFuelSubject(sheet.month)}
          </p>

          <p className="mb-1 text-left text-[11px]">Dear Sir,</p>
          <p className="mb-3 text-left text-[11px]">
            {sonaliFuelBody(sheet.month)}
          </p>

          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border border-black bg-neutral-100">
                {SONALI_FUEL_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      "border border-black px-1 py-1",
                      (col === "Name" || col === "Bank Name") && "text-left",
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((row) => (
                <tr key={`${sheet.sender.id}-${row.user.id}`}>
                  {sonaliFuelCells(row).map((cell, i) => (
                    <td
                      key={`${row.user.id}-${i}`}
                      className={cn(
                        "border border-black px-1 py-0.5",
                        i === 0 || i === 2
                          ? "text-center"
                          : i === 7
                            ? "text-right tabular-nums"
                            : i === 3 || i === 6
                              ? "text-left"
                              : "font-mono",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border border-black font-semibold">
                <td
                  colSpan={7}
                  className="border border-black px-1 py-1 text-right"
                >
                  G/Total:
                </td>
                <td className="border border-black px-1 py-1 text-right tabular-nums">
                  {trustBankMoney(sheet.total)}
                </td>
                <td className="border border-black px-1 py-1" />
              </tr>
            </tfoot>
          </table>

          <p className="mt-3 text-[11px]">
            <span className="font-semibold">Amount in word:</span>{" "}
            {amountToWordsEn(sheet.total)}
          </p>
          <p className="mt-1 text-[11px]">
            Please, the above amount will be sent today from your branch.
          </p>

          <div className="mt-8 text-left text-[11px]">
            <p>Thanking You</p>
            <p className="mt-6">Sincerely Yours,</p>
          </div>
        </section>
      </div>
    );
  },
);
