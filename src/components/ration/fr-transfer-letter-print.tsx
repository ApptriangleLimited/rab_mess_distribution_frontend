"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatMonthBill,
  formatMonthLong,
} from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import type { RationTransferSheet } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  sheet: RationTransferSheet;
  /** Member bank shown in SUBJECT “…transfer to {bank}”. */
  transferToBank?: string;
  className?: string;
};

function amt(n: number) {
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** FR Fresh Money transfer letter (14-col) — letter layout like bank disbursement memo. */
export const FrTransferLetterPrint = forwardRef<HTMLDivElement, Props>(
  function FrTransferLetterPrint({ sheet, transferToBank, className }, ref) {
    const t = useT();
    const monthBill = formatMonthBill(sheet.month);
    const dtLabel = formatMonthLong(sheet.reportDate.slice(0, 7));
    const memberBank =
      transferToBank ||
      sheet.lines[0]?.user.bank_name ||
      "—";
    const monthLabel = formatMonthLong(sheet.month);
    const subject = RATION_REPORT_META.subjectTagBill
      .replace("{monthLabel}", monthLabel)
      .replace("{bank}", memberBank);
    const words = amountToWordsEn(sheet.total);

    return (
      <div
        ref={ref}
        className={cn(
          "fr-transfer-letter staff-payout-print text-black",
          /* A4 landscape sheet — table needs width, not portrait card */
          "box-border block w-[297mm] min-h-[210mm] max-w-none overflow-visible",
          "bg-white p-5",
          className,
        )}
      >
        <section>
          <div className="letter-masthead mb-8 text-center text-black">
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.govLine}
            </p>
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.policeLine}
            </p>
            <p className="mt-1 text-sm font-semibold text-black">
              {RATION_REPORT_META.orgNameBn}
            </p>
            <p className="text-xs font-medium text-black">
              {RATION_REPORT_META.orgName}
            </p>
            <p className="text-[10px] text-black">
              {RATION_REPORT_META.station}
            </p>
          </div>

          <div className="mb-3 flex items-start justify-end text-[11px]">
            <p className="shrink-0 text-right font-medium">DT: {dtLabel}</p>
          </div>

          <div className="mb-3 space-y-0.5 text-left text-[11px]">
            <p>
              <span className="font-semibold">{t("ration.toManager")},</span>
            </p>
            <p>Manager</p>
            <p>{sheet.sender.bank_name || sheet.sender.label}</p>
            {sheet.sender.branch ? <p>{sheet.sender.branch}</p> : null}
            <p>{RATION_REPORT_META.station.split(",")[1]?.trim() || "Dhaka"}</p>
          </div>

          <p className="mb-3 text-left text-[11px] font-bold underline decoration-1 underline-offset-2">
            {t("ration.subject").toUpperCase()}: {subject}
          </p>

          <p className="mb-1 text-left text-[11px]">{t("ration.dearSir")}</p>
          <p className="mb-3 text-left text-[11px]">
            {t("ration.disburseFreshMoneyBody", { month: monthBill })}
          </p>

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
                <th className="border border-black px-0.5 py-1 text-left">
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
                <tr key={`${row.ser}-${row.refNo}`}>
                  <td className="border border-black px-0.5 py-0.5 text-left tabular-nums">
                    {row.ser}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 whitespace-nowrap">
                    {formatDateLong(row.date)}
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
                  <td className="border border-black px-0.5 py-0.5 text-left">
                    {row.type}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-left">
                    {row.customerAccountName}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-left font-mono">
                    {row.user.account_number?.trim() ||
                      row.customerAccountNo ||
                      "—"}
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
                  <td className="border border-black px-0.5 py-0.5 text-left">
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
                  {t("ration.gTotal")}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {amt(sheet.total)}
                </td>
                <td colSpan={4} className="border border-black px-0.5 py-1" />
              </tr>
            </tfoot>
          </table>

          <p className="mt-3 text-[11px]">
            <span className="font-semibold">{t("ration.amountInWord")}:</span>{" "}
            {words}
          </p>
          <p className="mt-1 text-[11px]">
            {t("ration.debitAdviceAccount", {
              account: sheet.sender.account_number || "—",
            })}
          </p>

          <div className="mt-8 text-left text-[11px]">
            <p>{t("ration.thankingYou")}</p>
            <p className="mt-6">{t("ration.sincerelyYours")}</p>
          </div>
        </section>
      </div>
    );
  },
);
