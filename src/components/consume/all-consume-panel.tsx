"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IconUsers } from "@tabler/icons-react";
import { ListPagination } from "@/components/shared/list-pagination";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterCompactFieldClass,
} from "@/components/shared/search-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { usePagination } from "@/hooks/use-pagination";

import { formatBdt } from "@/lib/reports";
import { consumeRankShort } from "@/lib/consume-rank-short";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type AllConsumeRow = {
  user: User;
  totalDays: number;
  allowanceDays: number;
  amount: number;
};

type Props = {
  rows: AllConsumeRow[];
  month: string;
  onMonthChange: (month: string) => void;
  tiles?: ReactNode;
};

/** Month rollup — all tags combined. */
export function AllConsumePanel({
  rows,
  month,
  onMonthChange,
  tiles,
}: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, q, rank, wing]);

  const filteredTotal = useMemo(
    () => members.reduce((sum, row) => sum + row.amount, 0),
    [members],
  );

  const filteredDays = useMemo(
    () => members.reduce((sum, row) => sum + row.totalDays, 0),
    [members],
  );

  const filteredAllowance = useMemo(
    () => members.reduce((s, r) => s + r.allowanceDays, 0),
    [members],
  );

  const resetKey = useMemo(
    () => `${month}|${q}|${rank}|${wing}|${members.map((m) => m.user.id).join(",")}`,
    [month, q, rank, wing, members],
  );
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    pageItems,
    total,
    from,
    to,
  } = usePagination(members, resetKey);

  const fieldClass = searchFilterCompactFieldClass;

  return (
    <div className="flex flex-col gap-4 no-print">
      <SearchFilterBar
        flat
        singleLine
        compact
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("consume.searchPlaceholder")}
        className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
        tiles={tiles}
      >
        <MonthNav compact month={month} onChange={onMonthChange} />
        <SettingsRankFilter
          value={rank}
          onChange={setRank}
          className="w-[7.25rem] shrink"
          triggerClassName={cn(fieldClass, "w-full")}
        />
        <SettingsWingFilter
          value={wing}
          onChange={setWing}
          rootsOnly
          className="w-[7.25rem] shrink"
          triggerClassName={cn(fieldClass, "w-full")}
        />
      </SearchFilterBar>

      {rows.length === 0 ? (
        <EmptyState
          title={t("consume.empty")}
          description={t("consume.emptyHint")}
        />
      ) : members.length === 0 ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
            <IconUsers className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t("consume.perUser")}
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
              {members.length}/{rows.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="consume-col-titles bg-neutral-50 text-[11px] uppercase tracking-wide dark:bg-neutral-900">
                <tr>
                  <th className="w-12 px-4 py-3">
                    {t("consume.colSl")}
                  </th>
                  <th className="min-w-[12rem] px-4 py-3">
                    {t("consume.colName")}
                  </th>
                  <th className="px-4 py-3">{t("consume.colRank")}</th>
                  <th className="px-4 py-3">
                    {t("consume.totalDays")}
                  </th>
                  <th className="px-4 py-3">
                    {t("consume.allowanceDays")}
                  </th>
                  <th className="px-4 py-3">
                    {t("consume.colGrandTotal")}
                  </th>
                  <th className="min-w-[6rem] px-4 py-3">
                    {t("consume.colRemarks")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row, i) => (
                  <tr
                    key={row.user.id}
                    className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                  >
                    <td className="px-4 py-3 text-center tabular-nums text-neutral-400">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={row.user.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                            {row.user.name}
                          </p>
                          <p className="font-mono text-xs text-neutral-500">
                            {row.user.personal_id || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {consumeRankShort(row.user.rank) || "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.totalDays}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.allowanceDays}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-primary">
                      {formatBdt(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-primary/15 bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/50 dark:border-primary/25 dark:from-primary/10 dark:via-neutral-950 dark:to-neutral-950">
                  <td
                    colSpan={3}
                    className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
                  >
                    {t("consume.billTotal")}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {filteredDays}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {filteredAllowance}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-lg font-bold tabular-nums text-primary">
                    {formatBdt(filteredTotal)}
                  </td>
                  <td className="px-4 py-3.5" />
                </tr>
              </tfoot>
            </table>
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </section>
      )}
    </div>
  );
}
