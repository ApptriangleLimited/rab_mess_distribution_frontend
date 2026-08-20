"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconUsers } from "@tabler/icons-react";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ListPagination } from "@/components/shared/list-pagination";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { buildTagBill, formatBdt } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tag: DailyTag;
  onMonthChange: (month: string) => void;
  tiles?: ReactNode;
};

/** Tag bill body — filters + member table (inline under by-tag tabs). */
export function TagBillPanel({
  month,
  tag,
  onMonthChange,
  tiles,
}: Props) {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const defaultMonth = monthKey();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const bill = useMemo(
    () => buildTagBill(month, tag),
    [state.assignments, state.users, state.rates, month, tag],
  );

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bill.rows, q, rank, wing]);

  const filteredDays = useMemo(
    () => members.reduce((s, r) => s + r.days, 0),
    [members],
  );

  const filteredFresh = useMemo(
    () => members.reduce((sum, row) => sum + row.amount, 0),
    [members],
  );

  const filteredFuel = useMemo(
    () => members.reduce((sum, row) => sum + row.fuelAmount, 0),
    [members],
  );

  const filteredTotal = useMemo(
    () => members.reduce((sum, row) => sum + row.grandTotal, 0),
    [members],
  );

  const showFuel = tag === "FR" || bill.fuelRate > 0;

  const resetKey = useMemo(
    () =>
      `${month}|${tag}|${q}|${rank}|${wing}|${members.map((m) => m.user.id).join(",")}`,
    [month, tag, q, rank, wing, members],
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

  const fieldClass = searchFilterFieldClass;
  const filtersActive =
    rank !== "all" || wing !== "all" || month !== defaultMonth;

  return (
    <div className="flex flex-col gap-0">
      <motion.div
        key={tag}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4"
      >
        <SearchFilterBar
          flat
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("consume.searchPlaceholder")}
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={tiles}
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

        {bill.rows.length === 0 ? (
          <EmptyState title={t("consume.tagEmpty")} />
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
                {members.length}/{bill.rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">
                      {t("consume.colSl")}
                    </th>
                    <th className="min-w-[12rem] px-4 py-3">
                      {t("consume.colName")}
                    </th>
                    <th className="px-4 py-3">{t("consume.colRank")}</th>
                    <th className="px-4 py-3 text-center font-mono">{tag}</th>
                    <th className="px-4 py-3 text-right">
                      {t("consume.colFreshAmount")}
                    </th>
                    {showFuel ? (
                      <th className="px-4 py-3 text-right">
                        {t("consume.colFuelAmount")}
                      </th>
                    ) : null}
                    <th className="px-4 py-3 text-right">
                      {t("consume.colGrandTotal")}
                    </th>
                    <th className="min-w-[6rem] px-4 py-3">
                      {t("consume.colRemarks")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => (
                    <tr
                      key={row.user.id}
                      className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <td className="px-4 py-3 text-center tabular-nums text-neutral-400">
                        {row.sl}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar name={row.user.name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                              {row.user.name}
                            </p>
                            <p className="font-mono text-xs text-neutral-500">
                              {row.user.rab_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                        {row.user.rank || "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                        {row.days}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                        {formatBdt(row.amount)}
                      </td>
                      {showFuel ? (
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                          {formatBdt(row.fuelAmount)}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-primary">
                        {formatBdt(row.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-400">
                        {row.remarks || "—"}
                      </td>
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
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {formatBdt(filteredFresh)}
                    </td>
                    {showFuel ? (
                      <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                        {formatBdt(filteredFuel)}
                      </td>
                    ) : null}
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
      </motion.div>
    </div>
  );
}
