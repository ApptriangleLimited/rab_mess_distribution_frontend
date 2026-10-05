"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterCompactFieldClass,
} from "@/components/shared/search-filter-bar";
import { LeaveMedBillPrint } from "@/components/consume/leave-med-bill-print";
import { WingSummaryButton } from "@/components/consume/wing-summary-button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { LEAVE_MED_BILL_TAGS } from "@/lib/consume-filters";
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import type { DailyTag } from "@/lib/types";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
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
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
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

  const wingBills = useMemo(
    () =>
      groupRowsByOfficialWing(members).map((group) => {
        const tagTotals: Partial<Record<DailyTag, number>> = {};
        for (const code of LEAVE_MED_BILL_TAGS) {
          tagTotals[code] = group.rows.reduce(
            (s, r) => s + (r.tagDays[code] ?? 0),
            0,
          );
        }
        return {
          ...group,
          rows: group.rows.map((row, i) => ({ ...row, sl: i + 1 })),
          tagTotals,
          totalDays: group.rows.reduce((s, r) => s + r.totalDays, 0),
          totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
        };
      }),
    [members],
  );

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
          <section className="flex flex-col gap-8">
            {wingBills.map((group, index) => (
              <LeaveMedBillPrint
                key={group.id}
                month={month}
                tags={LEAVE_MED_BILL_TAGS}
                rows={group.rows}
                tagTotals={group.tagTotals}
                totalDays={group.totalDays}
                totalAmount={group.totalAmount}
                rate={bill.rate}
                wingLabel={group.label}
                pageBreak={index > 0}
                preview
              />
            ))}
          </section>
        )}
      </motion.div>
    </div>
  );
}
