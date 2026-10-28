"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import { formatDateOrdinal, todayISO } from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import type { RationTransferSheet } from "@/lib/reports";
import {
  TRUST_BANK_COLUMNS,
  beftnAlignClass,
  beftnPageLabel,
  beftnWidthClass,
  chunkBeftnPages,
  trustBankBody,
  trustBankCells,
  trustBankMoney,
  trustBankSubject,
} from "@/lib/trust-bank-letter";
import { cn } from "@/lib/utils";

type Props = {
  sheet: RationTransferSheet;
  className?: string;
};

/** Official Trust Bank BEFTN letter — English paper layout, same payout data. */
export const TrustBankLetterPrint = forwardRef<HTMLDivElement, Props>(
  function TrustBankLetterPrint({ sheet, className }, ref) {
    const subject = trustBankSubject(sheet.month);
    const words = amountToWordsEn(sheet.total);
    const city =
      sheet.sender.branch_location?.trim() ||
      RATION_REPORT_META.station.split(",")[1]?.trim() ||
      "Dhaka";
    const pages = chunkBeftnPages(sheet.lines);

    return (
      <div
        ref={ref}
        className={cn(
          "trust-bank-letter staff-payout-print text-black",
          "box-border block w-[297mm] max-w-none overflow-visible",
          "bg-white p-5",
          className,
        )}
      >
        {pages.map((lines, pageIndex) => {
          const last = pageIndex === pages.length - 1;
          return (
        <section key={pageIndex} className="beftn-letter-page">
          <div className="letter-masthead mb-8 text-center text-black">
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.govLine}
            </p>
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.policeLine}
            </p>
            <p className="mt-1 text-sm font-semibold text-black">
              {RATION_REPORT_META.orgName}
            </p>
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.station}
            </p>
          </div>

          <div className="mb-3 flex items-start justify-end text-[11px]">
            <p className="shrink-0 text-right font-medium">
              Dt. {formatDateOrdinal(todayISO())}
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
            {trustBankBody(sheet.month)}
          </p>

          <table className="w-full border-collapse text-[10px] leading-tight">
            <thead>
              <tr className="border border-black bg-white text-black">
                {TRUST_BANK_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      "border border-black px-0.5 py-1 align-middle font-semibold",
                      beftnWidthClass(col),
                      beftnAlignClass(col, "head"),
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((row) => (
                <tr key={`${row.ser}-${row.refNo}`}>
                  {trustBankCells(row).map((cell, i) => (
                    <td
                      key={`${row.ser}-${i}`}
                      className={cn(
                        "border border-black px-0.5 py-0.5 align-middle",
                        beftnWidthClass(TRUST_BANK_COLUMNS[i] ?? ""),
                        beftnAlignClass(TRUST_BANK_COLUMNS[i] ?? "", "body"),
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {last ? (
            <tfoot>
              <tr className="border border-black font-semibold">
                <td
                  colSpan={11}
                  className="border border-black px-1 py-1 text-right"
                >
                  G/Total:
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {trustBankMoney(sheet.total)}
                </td>
                <td colSpan={3} className="border border-black px-0.5 py-1" />
              </tr>
            </tfoot>
            ) : null}
          </table>

          {last ? (
            <>
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
            </>
          ) : null}
          <p className="beftn-page-no">{beftnPageLabel(pageIndex + 1)}</p>
        </section>
          );
        })}
      </div>
    );
  },
);
