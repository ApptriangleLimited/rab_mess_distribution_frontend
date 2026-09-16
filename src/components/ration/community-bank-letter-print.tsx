"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import { formatDateOrdinal } from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import type { RationTransferSheet } from "@/lib/reports";
import {
  COMMUNITY_BANK_COLUMNS,
  communityBankBody,
  communityBankCells,
  communityBankSubject,
} from "@/lib/community-bank-letter";
import { trustBankMoney } from "@/lib/trust-bank-letter";
import { cn } from "@/lib/utils";

type Props = {
  sheet: RationTransferSheet;
  className?: string;
};

/** Official Community Bank BEFTN letter — English paper layout, same payout data. */
export const CommunityBankLetterPrint = forwardRef<HTMLDivElement, Props>(
  function CommunityBankLetterPrint({ sheet, className }, ref) {
    const subject = communityBankSubject(sheet.month);
    const words = amountToWordsEn(sheet.total);
    const city =
      sheet.sender.branch_location?.trim() ||
      RATION_REPORT_META.station.split(",")[1]?.trim() ||
      "Dhaka";

    return (
      <div
        ref={ref}
        className={cn(
          "community-bank-letter staff-payout-print text-black",
          "box-border block w-[297mm] min-h-[210mm] max-w-none overflow-visible",
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
              {RATION_REPORT_META.refPrefixPayAllce}
            </p>
            <p className="shrink-0 text-right font-medium">
              Dt. {formatDateOrdinal(sheet.reportDate)}
            </p>
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
            SUBJECT: {subject}
          </p>

          <p className="mb-1 text-left text-[11px]">Dear Sir,</p>
          <p className="mb-3 text-left text-[11px]">
            {communityBankBody(sheet.month)}
          </p>

          <table className="w-full border-collapse text-[8px] leading-tight">
            <thead>
              <tr className="border border-black bg-neutral-100">
                {COMMUNITY_BANK_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="border border-black px-0.5 py-1 font-semibold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((row) => (
                <tr key={`${row.ser}-${row.refNo}`}>
                  {communityBankCells(row).map((cell, i) => (
                    <td
                      key={`${row.ser}-${i}`}
                      className={cn(
                        "border border-black px-0.5 py-0.5",
                        i === 0 || i === 6 || i === 13
                          ? "text-center"
                          : i === 9
                            ? "text-right tabular-nums"
                            : i === 7
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
                  colSpan={9}
                  className="border border-black px-1 py-1 text-right"
                >
                  G/Total:
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {trustBankMoney(sheet.total)}
                </td>
                <td colSpan={4} className="border border-black px-0.5 py-1" />
              </tr>
            </tfoot>
          </table>

          <p className="mt-3 text-[11px]">
            <span className="font-semibold">Amount in word:</span> {words}
          </p>
          <p className="mt-1 text-[11px]">
            Please, the above amount will be debited today from our current
            account No. {sheet.sender.account_number || "—"} maintained in your
            branch.
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
