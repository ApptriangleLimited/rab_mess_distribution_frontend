"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ListPagination } from "@/components/shared/list-pagination";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterCompactFieldClass,
} from "@/components/shared/search-filter-bar";
import { LeaveMedBillPrint } from "@/components/consume/leave-med-bill-print";
import { WingSummaryButton } from "@/components/consume/wing-summary-button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { LEAVE_MED_BILL_TAGS } from "@/lib/consume-filters";
import {
  buildLeaveMedBill,
  withReportSource,
  type ReportSource,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  onMonthChange: (month: string) => void;
  tiles?: ReactNode;
  source?: ReportSource;
};

export function LeaveMedBillPanel({
  month,
  onMonthChange,
  tiles,
  source,
}: Props) {
  const t = useT();
  const state = useStore();
  const { ranks, wings } = state;
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const bill = useMemo(
    () =>
      withReportSource(source, () =>
        buildLeaveMedBill(month, LEAVE_MED_BILL_TAGS),
      ),
    [state.assignments, state.users, state.rates, month, source],
  );

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [
        row.user.name,
        row.user.personal_id,
        row.user.rab_id,
        row.user.wing,
        row.user.rank,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bill.rows, q, rank, wing]);

  const filteredDays = useMemo(
    () => members.reduce((s, r) => s + r.totalDays, 0),
    [members],
  );
  const filteredAmount = useMemo(
    () => members.reduce((s, r) => s + r.amount, 0),
    [members],
  );
  const filteredTagTotals = useMemo(() => {
    const next: Record<string, number> = {};
    for (const code of LEAVE_MED_BILL_TAGS) {
      next[code] = members.reduce((s, r) => s + (r.tagDays[code] ?? 0), 0);
    }
    return next;
  }, [members]);

  const resetKey = useMemo(
    () =>
      `${month}|leave-med|${q}|${rank}|${wing}|${members.map((m) => m.user.id).join(",")}`,
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
    <div className="flex flex-col gap-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4"
      >
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
          <div className="w-[6.75rem] shrink">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger
                className={cn(fieldClass, "w-full")}
                aria-label={t("cc.filterRank")}
              >
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allRank")}</SelectItem>
                {ranks.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[6.5rem] shrink">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger
                className={cn(fieldClass, "w-full")}
                aria-label={t("cc.filterWing")}
              >
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allWing")}</SelectItem>
                {wings.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <WingSummaryButton
            month={month}
            wing={wing}
            back={`/consume/monthly?month=${month}&tag=leave-med`}
          />
        </SearchFilterBar>

        {bill.rows.length === 0 ? (
          <EmptyState title={t("consume.tagEmpty")} />
        ) : members.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <section className="flex flex-col gap-3">
            <LeaveMedBillPrint
              month={month}
              tags={LEAVE_MED_BILL_TAGS}
              rows={pageItems}
              tagTotals={filteredTagTotals}
              totalDays={filteredDays}
              totalAmount={filteredAmount}
              rate={bill.rate}
              preview
            />
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
