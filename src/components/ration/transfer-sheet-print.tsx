"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import { amountToWordsEn } from "@/lib/money-words";
import { formatBdt, type RationTransferSheet } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  sheets: RationTransferSheet[];
  /** On-screen letter preview (not print-only). */
  preview?: boolean;
};

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const TransferSheetPrint = forwardRef<HTMLDivElement, Props>(
  function TransferSheetPrint({ sheets, preview = false }, ref) {
  const t = useT();

  if (!sheets.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "transfer-sheet-print text-black",
        !preview && "hidden",
        preview &&
          "block overflow-auto rounded-xl border border-neutral-200 bg-white p-5 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-neutral-700",
      )}
    >
      {sheets.map((sheet, sheetIndex) => {
        const words = amountToWordsEn(sheet.total);
        const subject = RATION_REPORT_META.subjectFreshMoney.replace(
          "{month}",
          sheet.month,
        );

        return (
          <section
            key={sheet.sender.id}
            className={cn(
              sheetIndex < sheets.length - 1 && "print:break-after-page",
              "mb-8",
            )}
          >
            <header className="mb-3 text-center">
              <p className="text-[9px] text-neutral-700">
                {RATION_REPORT_META.govLine}
              </p>
              <p className="text-xs font-semibold">
                {RATION_REPORT_META.orgNameBn}
              </p>
              <p className="text-[10px]">{RATION_REPORT_META.orgName}</p>
              <p className="mt-2 text-sm font-bold tracking-wide">
                Bank transfer / disbursement sheet
              </p>
              <p className="text-[10px] text-neutral-700">{subject}</p>
            </header>

            <div className="mb-2 grid grid-cols-2 gap-x-4 text-[10px]">
              <p>
                {t("ration.fromAccount")}: {sheet.sender.label} ·{" "}
                {sheet.sender.account_number}
              </p>
              <p>
                {t("ration.colDate")}: {sheet.reportDate}
              </p>
              <p>
                {sheet.sender.bank_name}
                {sheet.sender.branch ? ` · ${sheet.sender.branch}` : ""}
              </p>
              <p>
                {t("ration.colSenderRouting")}: {sheet.sender.routing || "—"}
              </p>
            </div>

            <table className="w-full border-collapse text-[8px] leading-tight">
              <thead>
                <tr className="border border-black bg-neutral-100">
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colSer")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colDate")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colRefNo")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colSenderAcct")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colReceiverRouting")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colSenderRouting")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colType")}
                  </th>
                  <th className="border border-black px-0.5 py-1 text-left">
                    {t("ration.colCustomerName")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colCustomerAcct")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colAmount")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colInstitute")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colEntryDesc")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colPaymentInfo")}
                  </th>
                  <th className="border border-black px-0.5 py-1">
                    {t("ration.colCurrency")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheet.lines.map((row) => (
                  <tr key={`${sheet.sender.id}-${row.ser}-${row.refNo}`}>
                    <td className="border border-black px-0.5 py-0.5 text-center tabular-nums">
                      {row.ser}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 font-mono">
                      {row.refNo}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 font-mono">
                      {row.senderAccountNo}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 font-mono">
                      {row.receiverRouting}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 font-mono">
                      {row.senderRouting}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 text-center">
                      {row.type}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 text-left">
                      {row.customerAccountName}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 font-mono">
                      {row.customerAccountNo}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 text-right tabular-nums">
                      {amt(row.amount)}
                    </td>
                    <td className="border border-black px-0.5 py-0.5">
                      {row.institute}
                    </td>
                    <td className="border border-black px-0.5 py-0.5">
                      {row.entryDescription}
                    </td>
                    <td className="border border-black px-0.5 py-0.5">
                      {row.paymentInfo}
                    </td>
                    <td className="border border-black px-0.5 py-0.5 text-center">
                      {row.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border border-black font-semibold">
                  <td
                    colSpan={9}
                    className="border border-black px-1 py-1 text-right"
                  >
                    {t("ration.totalAmount")}
                  </td>
                  <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                    {formatBdt(sheet.total)}
                  </td>
                  <td colSpan={4} className="border border-black px-0.5 py-1" />
                </tr>
              </tfoot>
            </table>

            <p className="mt-2 text-[10px]">
              <span className="font-semibold">{t("ration.amountInWords")}:</span>{" "}
              {words}
            </p>
            <p className="mt-1 text-[10px]">
              {t("ration.debitAdvice")} ({sheet.sender.account_number} ·{" "}
              {sheet.sender.bank_name})
            </p>

            <footer className="mt-10 grid grid-cols-3 gap-4 text-center text-[10px]">
              {(
                [
                  "ration.preparedBy",
                  "ration.checkedBy",
                  "ration.approvedBy",
                ] as const
              ).map((key) => (
                <div key={key} className="pt-8">
                  <div className="mx-auto mb-2 h-px w-24 bg-black" />
                  <p>{t(key)}</p>
                </div>
              ))}
            </footer>
          </section>
        );
      })}
    </div>
  );
  },
);
