"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconDownload, IconFileAnalytics } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { GenerateReportDialog } from "@/components/ration/generate-report-dialog";
import { Button } from "@/components/ui/button";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";

import { monthDateBounds } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildRangeLedger, withReportSource } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

export default function RationMonthlyClient() {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const month = dateFrom.slice(0, 7) || initial.from.slice(0, 7);

  function applyDateRange(from: string, to: string) {
    if (!from && !to) {
      const next = defaultRange();
      setDateFrom(next.from);
      setDateTo(next.to);
      return;
    }
    setDateFrom(from);
    setDateTo(to || from);
  }

  const rangeBounds = useMemo(() => {
    return dateFrom <= dateTo
      ? { from: dateFrom, to: dateTo }
      : { from: dateTo, to: dateFrom };
  }, [dateFrom, dateTo]);

  const { source } = useReportSource({
    from: rangeBounds.from,
    to: rangeBounds.to,
  });

  const ledger = useMemo(() => {
    const range = withReportSource(source, () =>
      buildRangeLedger(rangeBounds.from, rangeBounds.to, undefined, {
        carry: true,
      }),
    );
    return {
      month,
      dayCount: range.dates.length,
      tagCodes: range.tagCodes,
      rows: range.rows,
      columnDates: range.dates,
    };
  }, [
    state.assignments,
    state.users,
    state.suppressed_carries,
    month,
    rangeBounds,
    source,
  ]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing]);

  function onExport() {
    const header = [
      t("consume.colSl"),
      t("consume.colId"),
      t("consume.colRank"),
      t("consume.colName"),
      ...ledger.tagCodes,
    ];
    const data = [
      header,
      ...rows.map((r, i) => [
        String(i + 1),
        r.user.rab_id,
        r.user.rank,
        r.user.name,
        ...ledger.tagCodes.map((code) => String(r.tagCounts[code] ?? "")),
      ]),
    ];
    downloadCsv(
      `ration-ledger-${rangeBounds.from}_${rangeBounds.to}.csv`,
      data,
    );
  }

  const fieldClass = searchFilterFieldClass;
  return (
    <PagePane className="gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.rationMonthly.title")}
          subtitle={t("pages.rationMonthly.subtitle", { month })}
          center={<RationTabs />}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={onExport}
                disabled={!rows.length}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("ration.exportCsv")}
              </Button>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setReportOpen(true)}
              >
                <IconFileAnalytics className="h-3.5 w-3.5" />
                {t("ration.openReport")}
              </Button>
            </>
          }
        />

        <GenerateReportDialog
          open={reportOpen}
          defaultMonth={month}
          onClose={() => setReportOpen(false)}
        />

        <SearchFilterBar
          flat
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => applyDateRange(from, to)}
            label={t("common.dateRange")}
          />
          <SettingsRankFilter
            value={rank}
            onChange={setRank}
            className="w-[9.5rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <SettingsWingFilter
            value={wing}
            onChange={setWing}
            className="w-[9rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
        </SearchFilterBar>

        {ledger.rows.length === 0 ? (
          <EmptyState title={t("consume.ledgerEmpty")} />
        ) : rows.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <MonthLedgerBoard
            month={month}
            dayCount={ledger.dayCount}
            tagCodes={ledger.tagCodes}
            rows={rows}
            columnDates={ledger.columnDates}
          />
        )}
      </motion.div>
    </PagePane>
  );
}
