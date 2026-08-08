"use client";

import { useMemo, useState } from "react";
import { IconUsers } from "@tabler/icons-react";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ListPagination } from "@/components/shared/list-pagination";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { RANKS, WINGS } from "@/lib/constants";
import { monthKey } from "@/lib/date";
import { formatBdt } from "@/lib/reports";
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
};

/** Month rollup — all tags combined. */
export function AllConsumePanel({ rows, month, onMonthChange }: Props) {
  const t = useT();
  const defaultMonth = monthKey();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
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

  const resetKey = useMemo(
    () => `${month}|${q}|${rank}|${wing}|${members.map((m) => m.user.id).join(",")}`,
    [month, q, rank, wing, members],
  );
  const {
    page,
    setPage,
    totalPages,
    pageItems,
    total,
    from,
    to,
    pageSize,
  } = usePagination(members, resetKey);

  const fieldClass = searchFilterFieldClass;
  const filtersActive =
    rank !== "all" || wing !== "all" || month !== defaultMonth;

  return (
    <div className="flex flex-col gap-4 no-print">
      <SearchFilterBar
        flat
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("consume.searchPlaceholder")}
      >
        <MonthNav month={month} onChange={onMonthChange} />
        <div className="w-[9.5rem] shrink-0">
          <Select value={rank} onValueChange={setRank}>
            <SelectTrigger
              className={cn(fieldClass, "w-full")}
              aria-label={t("cc.filterRank")}
            >
              <SelectValue placeholder={t("cc.selectRank")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allRank")}</SelectItem>
              {RANKS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[9rem] shrink-0">
          <Select value={wing} onValueChange={setWing}>
            <SelectTrigger
              className={cn(fieldClass, "w-full")}
              aria-label={t("cc.filterWing")}
            >
              <SelectValue placeholder={t("cc.selectWing")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allWing")}</SelectItem>
              {WINGS.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ClearFiltersButton
          disabled={!filtersActive && !q.trim()}
          onClick={() => {
            setQ("");
            setRank("all");
            setWing("all");
            if (month !== defaultMonth) onMonthChange(defaultMonth);
          }}
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
        <section className="overflow-hidden rounded-xl border border-neutral-200/90 dark:border-neutral-700">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <IconUsers className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
              {t("consume.perUser")}
            </span>
            <span className="ml-auto font-mono text-xs tabular-nums text-neutral-400">
              {members.length}/{rows.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:border-neutral-800">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">
                    {t("consume.colSl")}
                  </th>
                  <th className="px-3 py-3">{t("consume.colId")}</th>
                  <th className="px-3 py-3">{t("consume.colRank")}</th>
                  <th className="min-w-[9.5rem] px-3 py-3">
                    {t("consume.colName")}
                  </th>
                  <th className="px-3 py-3 text-center">
                    {t("consume.totalDays")}
                  </th>
                  <th className="px-3 py-3 text-center">
                    {t("consume.allowanceDays")}
                  </th>
                  <th className="px-3 py-3 text-right">
                    {t("consume.colGrandTotal")}
                  </th>
                  <th className="min-w-[6rem] px-3 py-3">
                    {t("consume.colRemarks")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row, i) => (
                  <tr
                    key={row.user.id}
                    className="border-t border-neutral-100/90 transition-colors hover:bg-primary/[0.03] dark:border-neutral-800/80 dark:hover:bg-primary/5"
                  >
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-neutral-400">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                      {row.user.rab_id}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                      {row.user.rank || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-neutral-900 dark:text-white">
                      {row.user.name}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.totalDays}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.allowanceDays}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-primary">
                      {formatBdt(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-500">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50/90 dark:border-neutral-700 dark:bg-neutral-900/70">
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400"
                  >
                    {t("consume.billTotal")}
                  </td>
                  <td className="px-3 py-3 text-center font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    {filteredDays}
                  </td>
                  <td className="px-3 py-3 text-center font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    {members.reduce((s, r) => s + r.allowanceDays, 0)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-lg font-semibold tabular-nums text-primary">
                    {formatBdt(filteredTotal)}
                  </td>
                  <td className="px-3 py-3" />
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
          />
        </section>
      )}
    </div>
  );
}
