"use client";

import { RATION_REPORT_META } from "@/lib/constants";
import { amountToWordsEn } from "@/lib/money-words";
import { formatBdt, type RationStaffSheet } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  sheets: RationStaffSheet[];
  /** When true, show this sheet on window.print */
  active?: boolean;
};

export function StaffPayoutPrint({ sheets, active = false }: Props) {
  const t = useT();

  if (!sheets.length) return null;

  return (
    <div
      className={cn(
        "staff-payout-print hidden text-black",
        active && "print-this",
      )}
    >      {sheets.map((sheet, sheetIndex) => {
        const subject = RATION_REPORT_META.subjectFreshMoney.replace(
          "{month}",
          sheet.month,
        );
        const words = amountToWordsEn(sheet.total);

        return (
          <section
            key={sheet.sender.id}
            className={cn(
              sheetIndex < sheets.length - 1 && "print:break-after-page",
              "mb-8",
            )}
          >
            <header className="mb-4 text-center">
              <p className="text-[10px] text-neutral-700">
                {RATION_REPORT_META.govLine}
              </p>
              <p className="text-[10px] text-neutral-700">
                {RATION_REPORT_META.policeLine}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {RATION_REPORT_META.orgNameBn}
              </p>
              <p className="text-xs font-medium">{RATION_REPORT_META.orgName}</p>
              <p className="text-[10px] text-neutral-600">
                {RATION_REPORT_META.stationBn} · {RATION_REPORT_META.station}
              </p>
              <p className="mt-3 text-left text-[11px]">
                {RATION_REPORT_META.refPrefix}/{sheet.month}
              </p>
            </header>

            <div className="mb-3 space-y-1 text-left text-[11px]">
              <p>
                <span className="font-semibold">{t("ration.toManager")}:</span>{" "}
                The Manager
              </p>
              <p className="pl-0">
                {sheet.sender.bank_name}
                {sheet.sender.branch ? `, ${sheet.sender.branch}` : ""}
              </p>
              <p className="mt-2">
                <span className="font-semibold">{t("ration.subject")}:</span>{" "}
                {subject}
              </p>
              <p className="text-neutral-700">
                {sheet.sender.label} · A/C {sheet.sender.account_number}
              </p>
            </div>

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
                  <th className="border border-black px-1 py-1">
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
                    <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                      {row.ser}
                    </td>
                    <td className="border border-black px-1 py-0.5 font-mono">
                      {row.user.rab_id}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {row.user.rank}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-left">
                      {row.user.name}
                    </td>
                    <td className="border border-black px-1 py-0.5 font-mono">
                      {row.user.account_number || "—"}
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
                    <td className="border border-black px-1 py-0.5">
                      {row.remarks || (row.missingBank ? t("ration.missingBank") : "")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border border-black font-semibold">
                  <td
                    colSpan={7}
                    className="border border-black px-1 py-1.5 text-right"
                  >
                    {t("ration.totalAmount")}
                  </td>
                  <td className="border border-black px-1 py-1.5 text-right tabular-nums">
                    {formatBdt(sheet.total)}
                  </td>
                  <td className="border border-black px-1 py-1.5" />
                </tr>
              </tfoot>
            </table>

            <p className="mt-3 text-[11px]">
              <span className="font-semibold">{t("ration.amountInWords")}:</span>{" "}
              {words}
            </p>
            <p className="mt-1 text-[10px] text-neutral-700">
              {t("ration.debitAdvice")}
            </p>

            <footer className="mt-12 grid grid-cols-3 gap-6 text-center text-[11px]">
              {(
                [
                  "ration.preparedBy",
                  "ration.checkedBy",
                  "ration.approvedBy",
                ] as const
              ).map((key) => (
                <div key={key} className="pt-10">
                  <div className="mx-auto mb-2 h-px w-28 bg-black" />
                  <p>{t(key)}</p>
                </div>
              ))}
            </footer>
          </section>
        );
      })}
    </div>
  );
}
