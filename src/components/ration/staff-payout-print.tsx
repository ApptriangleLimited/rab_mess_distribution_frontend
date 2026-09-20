"use client";

import { forwardRef } from "react";
import { RATION_REPORT_META } from "@/lib/constants";
import { formatMonthLong } from "@/lib/date";
import { amountToWordsEn } from "@/lib/money-words";
import { isFrFuelSender } from "@/lib/official-senders";
import type { RationStaffSheet } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  sheets: RationStaffSheet[];
  /** When true, show this sheet on window.print */
  active?: boolean;
  /** On-screen letter preview (not print-only). */
  preview?: boolean;
  /** Override subject line (e.g. tag + bank letter). */
  subject?: string;
};

export const StaffPayoutPrint = forwardRef<HTMLDivElement, Props>(
  function StaffPayoutPrint(
    { sheets, active = false, preview = false, subject: subjectOverride },
    ref,
  ) {
    const t = useT();

    if (!sheets.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "staff-payout-print text-black",
          !preview && "hidden",
          active && "print-this",
          preview &&
            "block overflow-auto rounded-xl border border-neutral-200 bg-white p-5 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-neutral-700",
        )}
      >
        {sheets.map((sheet, sheetIndex) => {
          const monthLabel = formatMonthLong(sheet.month);
          const subject =
            subjectOverride ??
            (sheet.memberBank
              ? RATION_REPORT_META.subjectTagBill
                  .replace("{monthLabel}", monthLabel)
                  .replace("{bank}", sheet.memberBank)
              : RATION_REPORT_META.subjectFreshMoney.replace(
                  "{month}",
                  monthLabel,
                ));

          return (
            <section
              key={`${sheet.sender.id}-${sheet.memberBank ?? "all"}-${sheetIndex}`}
              className={cn(
                sheetIndex < sheets.length - 1 && "print:break-after-page",
                "mb-8 last:mb-0",
              )}
            >
              <div className="letter-masthead mb-8 text-center">
                <p className="text-[10px] text-neutral-700">
                  {RATION_REPORT_META.govLine}
                </p>
                <p className="text-[10px] text-neutral-700">
                  {RATION_REPORT_META.policeLine}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {RATION_REPORT_META.orgNameBn}
                </p>
                <p className="text-xs font-medium">
                  {RATION_REPORT_META.orgName}
                </p>
                <p className="text-[10px] text-neutral-600">
                  {RATION_REPORT_META.station}
                </p>
              </div>

              <div className="mb-3 flex items-start justify-end text-[11px]">
                <p className="shrink-0 text-right font-medium">
                  DT: {monthLabel}
                </p>
              </div>

              <div className="mb-3 space-y-0.5 text-left text-[11px]">
                <p>
                  <span className="font-semibold">
                    {t("ration.toManager")}:
                  </span>{" "}
                  Manager
                </p>
                <p>{sheet.sender.bank_name || sheet.sender.label}</p>
                {sheet.sender.branch ? <p>{sheet.sender.branch}</p> : null}
              </div>

              <p className="mb-3 text-left text-[11px] font-bold underline decoration-1 underline-offset-2">
                {t("ration.subject").toUpperCase()} : {subject}
              </p>

              <p className="mb-1 text-left text-[11px]">{t("ration.dearSir")}</p>
              <p className="mb-3 text-left text-[11px]">
                {t("ration.disburseBody", {
                  bill: t("ration.freshMoneyBill"),
                  month: monthLabel,
                })}
              </p>

              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border border-black bg-neutral-100">
                    <th className="border border-black px-1 py-1">
                      {t("ration.colSer")}
                    </th>
                    <th className="border border-black px-1 py-1">
                      {t("ration.colPersNo")}
                    </th>
                    <th className="border border-black px-1 py-1">
                      {t("ration.colRank")}
                    </th>
                    <th className="border border-black px-1 py-1 text-left">
                      {t("ration.colName")}
                    </th>
                    <th className="border border-black px-1 py-1 text-left">
                      {t("ration.colAcct")}
                    </th>
                    <th className="border border-black px-1 py-1">
                      {t("ration.colRouting")}
                    </th>
                    <th className="border border-black px-1 py-1 text-left">
                      {t("ration.colBank")}
                    </th>
                    <th className="border border-black px-1 py-1">
                      {t("ration.colAmount")}
                    </th>
                    <th className="border border-black px-1 py-1">
                      {t("ration.colRemarks")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.lines.map((row) => (
                    <tr key={`${sheet.sender.id}-${row.user.id}`}>
                      <td className="border border-black px-1 py-0.5 text-left tabular-nums">
                        {row.ser}
                      </td>
                      <td className="border border-black px-1 py-0.5 font-mono">
                        {row.user.personal_id || row.user.rab_id}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-left">
                        {row.user.rank}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-left">
                        {row.user.name}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-left font-mono">
                        {row.user.account_number?.trim() || "—"}
                      </td>
                      <td className="border border-black px-1 py-0.5 font-mono">
                        {row.user.routing || "—"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-left">
                        {row.user.bank_name || "—"}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-right tabular-nums">
                        {row.amount.toLocaleString("en-BD", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="border border-black px-1 py-0.5" />
                    </tr>
                  ))}
                </tbody>
              </table>
              {isFrFuelSender(sheet.sender) ? (
                <p className="mt-3 text-[11px]">
                  <span className="whitespace-nowrap font-semibold">
                    Amount in word:
                  </span>{" "}
                  {amountToWordsEn(sheet.total)}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  },
);
