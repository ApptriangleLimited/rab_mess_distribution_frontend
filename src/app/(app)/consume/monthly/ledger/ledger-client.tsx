"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconDownload, IconFileAnalytics, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { WingSummaryButton } from "@/components/consume/wing-summary-button";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { GenerateReportDialog } from "@/components/ration/generate-report-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { useReportSource } from "@/hooks/use-report-source";
import { useSession } from "@/hooks/use-session";
import { useStore } from "@/hooks/use-store";

import {
  CONSUME_REPORT_LEDGER_SOURCE_TAGS,
  CONSUME_REPORT_LEDGER_TAGS,
} from "@/lib/constants";
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import { downloadConsumeLedgerPdf } from "@/lib/download-consume-ledger-pdf";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import { monthDateBounds } from "@/lib/date";
import {
  buildRangeLedger,
  presentConsumeLedger,
  withReportSource,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

export default function ConsumeLedgerClient() {
  const t = useT();
  const state = useStore();
  const { session } = useSession();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();
  const canGenerateReport =
    session?.role === "ration" || session?.role === "admin";

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [memberType, setMemberType] = useState("all");
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
      presentConsumeLedger(
        buildRangeLedger(
          rangeBounds.from,
          rangeBounds.to,
          CONSUME_REPORT_LEDGER_SOURCE_TAGS,
          { carry: true },
        ),
        CONSUME_REPORT_LEDGER_TAGS,
      ),
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
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
      if (memberType !== "all" && row.user.member_type !== memberType) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing, memberType, state.wing_parent]);

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    params.set("from", dateFrom);
    params.set("to", dateTo);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    if (memberType !== "all") params.set("member_type", memberType);
    return `/consume/monthly/ledger/print?${params.toString()}`;
  }, [month, q, rank, wing, memberType, dateFrom, dateTo]);

  const fieldClass = searchFilterFieldClass;
  function onDownload() {
    if (rows.length === 0) return;
    downloadConsumeLedgerPdf({
      month,
      dayCount: ledger.dayCount,
      tagCodes: ledger.tagCodes,
      rows,
      columnDates: ledger.columnDates,
      sections: groupRowsByOfficialWing(rows).map((group) => ({
        wingLabel: group.label,
        rows: group.rows,
      })),
      filename: `consume-ledger-${month}.pdf`,
      signEveryPage: true,
      totalEveryPage: true,
    });
  }

  const printBtn =
    rows.length > 0 ? (
      <Button
        asChild
        variant="cta"
        size="sm"
        className="h-10 shrink-0 rounded-xl px-3"
      >
        <Link href={printHref}>
          <IconPrinter className="h-4 w-4" />
          {t("mess.print")}
        </Link>
      </Button>
    ) : (
      <Button
        variant="cta"
        size="sm"
        className="h-10 shrink-0 rounded-xl px-3"
        disabled
      >
        <IconPrinter className="h-4 w-4" />
        {t("mess.print")}
      </Button>
    );

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.consumeLedger.title")}
          subtitle={t("pages.consumeLedger.subtitle", { month })}
          center={<ConsumePanelTabs />}
        />

        {canGenerateReport ? (
          <GenerateReportDialog
            open={reportOpen}
            defaultMonth={month}
            onClose={() => setReportOpen(false)}
          />
        ) : null}

        <SearchFilterBar
          flat
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          tiles={
            <MiniStat
              label={t("daily.rosterStatAll")}
              value={String(rows.length)}
              accent
            />
          }
          trailing={
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 rounded-xl px-3"
                disabled={rows.length === 0}
                onClick={onDownload}
              >
                <IconDownload className="h-4 w-4" />
                {t("consume.exportPdf")}
              </Button>
              {printBtn}
              {canGenerateReport ? (
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  className="h-10 shrink-0 rounded-xl px-3"
                  onClick={() => setReportOpen(true)}
                >
                  <IconFileAnalytics className="h-4 w-4" />
                  {t("ration.openReport")}
                </Button>
              ) : null}
            </div>
          }
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
            rootsOnly
            className="w-[9rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <Select value={memberType} onValueChange={setMemberType}>
            <SelectTrigger
              className={cn(fieldClass, "w-[11rem] shrink-0")}
              aria-label={t("cc.fields.memberType")}
            >
              <SelectValue placeholder={t("common.allMemberType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allMemberType")}</SelectItem>
              <SelectItem value="attached">{t("cc.memberTypes.attached")}</SelectItem>
              <SelectItem value="new">{t("cc.memberTypes.new")}</SelectItem>
            </SelectContent>
          </Select>
          <WingSummaryButton
            month={month}
            wing={wing}
            back={`/consume/monthly/ledger`}
            className="h-10 shrink-0 rounded-xl px-3"
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
            showSrbNo
            centerColumnTitles
          />
        )}
      </motion.div>
    </PagePane>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-bold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
