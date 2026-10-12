"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MonthNav } from "@/components/shared/month-nav";
import {
  SearchFilterBar,
  searchFilterCompactFieldClass,
} from "@/components/shared/search-filter-bar";
import { TagBillPrint } from "@/components/consume/tag-bill-print";
import { WingSummaryButton } from "@/components/consume/wing-summary-button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { ConsumeMemberTypeSelect } from "@/components/consume/consume-member-type-select";
import {
  memberMatchesTypeFilter,
  type ConsumeMemberTypeFilter,
} from "@/lib/consume-filters";
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import {
  buildTagBill,
  withReportSource,
  type ReportSource,
} from "@/lib/reports";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  tag: DailyTag | readonly DailyTag[];
  displayTag?: string;
  onMonthChange: (month: string) => void;
  tiles?: ReactNode;
  source?: ReportSource;
  memberType?: ConsumeMemberTypeFilter;
  onMemberTypeChange?: (value: ConsumeMemberTypeFilter) => void;
  /** Fuel (FR+MFR) bill: no allowance column, grand total is the fuel. */
  fuelOnly?: boolean;
};

/** Tag bill body — filters + member table (inline under consume filters). */
export function TagBillPanel({
  month,
  tag,
  displayTag,
  onMonthChange,
  tiles,
  source,
  memberType = "all",
  onMemberTypeChange,
  fuelOnly = false,
}: Props) {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const bill = useMemo(
    () => withReportSource(source, () => buildTagBill(month, tag)),
    [state.assignments, state.users, state.rates, month, tag, source],
  );

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
      if (!memberMatchesTypeFilter(row.user.member_type, memberType)) return false;
      if (!query) return true;
      return [row.user.name, row.user.personal_id, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bill.rows, q, rank, wing, memberType]);

  const tagKey = typeof tag === "string" ? tag : tag.join("+");
  const dayHeader = displayTag || tagKey;
  const showFuel = bill.tags.includes("FR") || bill.fuelRate > 0;
  const wingBills = useMemo(
    () =>
      groupRowsByOfficialWing(members).map((group) => ({
        ...group,
        rows: group.rows.map((row, i) => ({ ...row, sl: i + 1 })),
        totalDays: group.rows.reduce((s, r) => s + r.days, 0),
        totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
        totalFuel: group.rows.reduce((s, r) => s + r.fuelAmount, 0),
        grandTotal: group.rows.reduce((s, r) => s + r.grandTotal, 0),
      })),
    [members],
  );

  const fieldClass = searchFilterCompactFieldClass;

  return (
    <div className="flex flex-col gap-0">
      <motion.div
        key={tagKey}
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
          <ConsumeMemberTypeSelect
            value={memberType}
            onChange={onMemberTypeChange ?? (() => {})}
            className="w-[9.5rem] shrink"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <WingSummaryButton
            month={month}
            wing={wing}
            back={`/consume/monthly?month=${month}`}
          />
        </SearchFilterBar>

        {bill.rows.length === 0 ? (
          <EmptyState title={t("consume.tagEmpty")} />
        ) : members.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <section className="flex flex-col gap-8">
            {wingBills.map((group, index) => (
              <TagBillPrint
                key={group.id}
                month={month}
                tag={dayHeader}
                tagLabel={dayHeader}
                rows={group.rows}
                totalDays={group.totalDays}
                totalAmount={group.totalAmount}
                totalFuel={group.totalFuel}
                grandTotal={fuelOnly ? group.totalFuel : group.grandTotal}
                allowanceRate={bill.rate}
                fuelRate={bill.fuelRate}
                showFuel={showFuel}
                fuelOnly={fuelOnly}
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
