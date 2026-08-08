"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconPrinter,
  IconShield,
  IconSoup,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { MESS_LEDGER_TAGS, RANKS, WINGS } from "@/lib/constants";
import { monthDateBounds, todayISO } from "@/lib/date";
import { buildRangeLedger } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

export default function MessLedgerClient() {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
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

  const ledger = useMemo(() => {
    const range = buildRangeLedger(
      rangeBounds.from,
      rangeBounds.to,
      MESS_LEDGER_TAGS,
      { carry: true, previewFuture: true },
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

  const defaultDates = defaultRange();
  const datesAreDefault =
    dateFrom === defaultDates.from && dateTo === defaultDates.to;

  /**
   * Default date range → today headcount (filtered).
   * Custom date filter → MS/CD person-days across that range.
   */
  const totals = useMemo(() => {
    let ms = 0;
    let cd = 0;

    if (datesAreDefault) {
      const today = todayISO();
      const col = ledger.columnDates.indexOf(today);
      if (col < 0) return { ms: 0, cd: 0, all: 0 };
      for (const row of rows) {
        const tag = row.days[col];
        if (tag === "MS") ms += 1;
        else if (tag === "CD") cd += 1;
      }
    } else {
      for (const row of rows) {
        for (const tag of row.days) {
          if (tag === "MS") ms += 1;
          else if (tag === "CD") cd += 1;
        }
      }
    }

    return { ms, cd, all: ms + cd };
  }, [datesAreDefault, ledger.columnDates, rows]);

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    params.set("from", dateFrom);
    params.set("to", dateTo);
    return `/mess/ledger/print?${params.toString()}`;
  }, [month, q, rank, wing, dateFrom, dateTo]);

  const fieldClass = searchFilterFieldClass;
  const filtersActive =
    rank !== "all" || wing !== "all" || !datesAreDefault;

  const printBtn =
    rows.length > 0 ? (
      <Button
        asChild
        variant="cta"
        size="sm"
        className="h-10 shrink-0 rounded-xl px-3"
      >
        <Link href={printHref} target="_blank" rel="noopener noreferrer">
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
          title={t("pages.messLedger.title")}
          subtitle={t("pages.messLedger.subtitle", { month })}
        />

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          tiles={
            <>
              <MiniStat
                icon={<IconUsers className="h-4 w-4" />}
                label={t("daily.rosterStatAll")}
                value={String(totals.all)}
                accent
              />
              <MiniStat
                icon={<IconSoup className="h-4 w-4" />}
                label={
                  datesAreDefault ? t("daily.todayMs") : t("mess.totalMs")
                }
                value={String(totals.ms)}
                accent
              />
              <MiniStat
                icon={<IconShield className="h-4 w-4" />}
                label={
                  datesAreDefault ? t("daily.todayCd") : t("mess.totalCd")
                }
                value={String(totals.cd)}
              />
            </>
          }
          trailing={printBtn}
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => applyDateRange(from, to)}
            label={t("common.dateRange")}
          />
          <div className="w-[9.5rem] shrink-0">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
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
              <SelectTrigger className={cn(fieldClass, "w-full")}>
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
              applyDateRange("", "");
            }}
          />
        </SearchFilterBar>

        {ledger.rows.length === 0 ? (
          <EmptyState title={t("mess.ledgerEmpty")} />
        ) : rows.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <MonthLedgerBoard
            month={month}
            dayCount={ledger.dayCount}
            tagCodes={ledger.tagCodes}
            rows={rows}
            columnDates={ledger.columnDates}
            showAllColumn
            previewFuture
          />
        )}
      </motion.div>
    </PagePane>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2.5 rounded-xl border px-3.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span
        className={cn(
          "shrink-0",
          accent ? "text-primary" : "text-neutral-500",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.08em] text-neutral-700 dark:text-neutral-200">
        {label}
      </span>
      <span
        className={cn(
          "text-lg font-extrabold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
