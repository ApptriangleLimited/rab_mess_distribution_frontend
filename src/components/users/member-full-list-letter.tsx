"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META, wingOfficialName } from "@/lib/constants";
import { formatDateDisplay, todayISO } from "@/lib/date";
import { memberListFilterChips } from "@/lib/member-list-report";
import {
  fullMemberListHeaders,
  fullMemberListRows,
  orderMemberListColumns,
} from "@/lib/member-full-list-report";
import type { UserFilters } from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  users: User[];
  filters: UserFilters;
  wingLabels?: Record<string, string>;
  title?: string;
  /** Daily list only. CC keeps the original column order. */
  columnOrder?: readonly number[];
};

export const MemberFullListLetter = forwardRef<HTMLDivElement, Props>(
  function MemberFullListLetter(
    { users, filters, wingLabels = {}, title, columnOrder },
    ref,
  ) {
    const t = useT();
    const { locale } = useI18n();
    const useBn = locale === "bn";
    const printedOn = formatDateDisplay(todayISO());
    const wingLabel = (wing: string) =>
      wing ? wingOfficialName(wing, wingLabels) : "—";
    const chips = memberListFilterChips(filters, t, wingLabel);
    const headers = columnOrder
      ? orderMemberListColumns(fullMemberListHeaders(t), columnOrder)
      : fullMemberListHeaders(t);
    const rows = fullMemberListRows(users, t).map((row) =>
      columnOrder ? orderMemberListColumns(row, columnOrder) : row,
    );
    const monoCols = columnOrder
      ? new Set([0, 1, 2, 7])
      : new Set([0, 3, 12]);

    return (
      <div
        ref={ref}
        className="member-full-list-letter mx-auto w-full max-w-[297mm] overflow-x-auto bg-white p-4 text-neutral-900 shadow-sm print:max-w-none print:overflow-visible print:p-0 print:shadow-none"
      >
        <header className="mb-4 border-b border-neutral-800 pb-2 text-center">
          <h1 className="text-base font-bold tracking-wide">
            {title ?? t("cc.fullMemberListReportTitle")}
          </h1>
          <p className="mt-0.5 text-[9px] font-normal text-neutral-400">
            {useBn ? CONSUME_REPORT_META.orgNameBn : CONSUME_REPORT_META.orgName}
          </p>
          <p className="mt-1 text-xs font-medium">
            {t("cc.memberListReportCount", { count: users.length })} ·{" "}
            {printedOn}
          </p>
          {chips.length > 0 ? (
            <p className="mt-1 text-[10px] text-neutral-600">
              {chips.join(" · ")}
            </p>
          ) : null}
        </header>

        <table className="w-max min-w-full border-collapse text-[9px] print:w-full">
          <thead>
            <tr className="bg-neutral-100">
              {headers.map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap border border-neutral-800 px-1.5 py-1 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${users[i]?.id ?? i}`} className={cn(i % 2 === 1 && "bg-neutral-50")}>
                {row.map((value, col) => (
                  <td
                    key={`${i}-${col}`}
                    className={cn(
                      "border border-neutral-800 px-1.5 py-1 align-top",
                      (columnOrder ? col <= 7 : col <= 4)
                        ? "whitespace-nowrap"
                        : "min-w-[4.5rem]",
                      monoCols.has(col) && "font-mono tabular-nums",
                    )}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
