"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { getMealShift, mealShiftLabel } from "@/lib/store/meal-shifts";
import type { MealAssignStatus, MealShiftId } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type MessReportLetterRow = {
  id: string;
  kind: "member" | "guest";
  date: string;
  check_in_time: string;
  shift_id: MealShiftId | null;
  name: string;
  rab_id: string;
  wing: string;
  rank: string;
  status: MealAssignStatus | null;
  info: string;
  ref: string;
  missing?: boolean;
};

type Props = {
  rows: MessReportLetterRow[];
  from: string;
  to: string;
};

function formatCheckInTime(iso: string, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const MessReportsLetter = forwardRef<HTMLDivElement, Props>(
  function MessReportsLetter({ rows, from, to }, ref) {
    const t = useT();
    const { locale } = useI18n();
    const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

    return (
      <div ref={ref} className={cn("mess-reports-letter hidden text-black")}>
        <header className="mb-3 text-center">
          <p className="text-sm font-semibold">{CONSUME_REPORT_META.orgNameBn}</p>
          <p className="text-xs">{CONSUME_REPORT_META.stationBn}</p>
          <p className="mt-2 text-base font-bold">
            {t("pages.messReports.title")}
          </p>
          <p className="text-[11px]">
            {from === to ? from : `${from} – ${to}`} · {rows.length}
          </p>
        </header>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-black px-1.5 py-1">
                {t("mess.reports.colType")}
              </th>
              <th className="border border-black px-1.5 py-1 text-left">
                {t("mess.colName")}
              </th>
              <th className="border border-black px-1.5 py-1">
                {t("mess.planning.date")}
              </th>
              <th className="border border-black px-1.5 py-1">
                {t("mess.reports.colTime")}
              </th>
              <th className="border border-black px-1.5 py-1">
                {t("mess.reports.colShift")}
              </th>
              <th className="border border-black px-1.5 py-1">
                {t("mess.colWing")}
              </th>
              <th className="border border-black px-1.5 py-1">
                {t("mess.reports.colStatus")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const shift = row.shift_id
                ? mealShiftLabel(
                    row.shift_id,
                    getMealShift(row.shift_id)?.name ?? row.shift_id,
                    t,
                  )
                : "—";
              const kind = row.missing
                ? t("mess.reports.didNotConsume")
                : row.kind === "guest"
                  ? t("mess.reports.audienceGuest")
                  : t("mess.reports.audienceMember");
              const status = row.missing
                ? t("mess.reports.didNotConsume")
                : row.status === 1
                  ? t("mess.reports.unique")
                  : row.status === 2
                    ? t("mess.reports.duplicate")
                    : "—";
              return (
                <tr key={row.id}>
                  <td className="border border-black px-1.5 py-1">{kind}</td>
                  <td className="border border-black px-1.5 py-1 text-left">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-[9px]">
                      {row.kind === "guest"
                        ? row.info || row.ref || "—"
                        : row.rab_id || "—"}
                    </p>
                  </td>
                  <td className="border border-black px-1.5 py-1">{row.date}</td>
                  <td className="border border-black px-1.5 py-1">
                    {formatCheckInTime(row.check_in_time, dateLocale)}
                  </td>
                  <td className="border border-black px-1.5 py-1">{shift}</td>
                  <td className="border border-black px-1.5 py-1">
                    {row.wing || "—"}
                  </td>
                  <td className="border border-black px-1.5 py-1">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);
