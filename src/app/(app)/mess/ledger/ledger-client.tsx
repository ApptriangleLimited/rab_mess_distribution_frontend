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
import { tagCellClass } from "@/components/daily/register-board";
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
import { monthDateBounds } from "@/lib/date";
import { buildRangeLedger } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type MessTagFilter = "all" | "MS" | "CD";

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
  const [tagFilter, setTagFilter] = useState<MessTagFilter>("all");
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

  /** Person-days across selected date range (filtered rows). */
  const totals = useMemo(() => {
    let ms = 0;
    let cd = 0;
    for (const row of rows) {
      for (const tag of row.days) {
        if (tag === "MS") ms += 1;
        else if (tag === "CD") cd += 1;
      }
    }
    return { ms, cd, all: ms + cd };
  }, [rows]);

  const boardRows = useMemo(() => {
    if (tagFilter === "all") return rows;
    return rows.filter((row) => row.days.some((d) => d === tagFilter));
  }, [rows, tagFilter]);

  const boardTagCodes = useMemo((): DailyTag[] => {
    if (tagFilter === "all") return ledger.tagCodes;
    return [tagFilter];
  }, [tagFilter, ledger.tagCodes]);

  function selectTagFilter(next: MessTagFilter) {
    setTagFilter((cur) => (cur === next && next !== "all" ? "all" : next));
  }

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
    rank !== "all" ||
    wing !== "all" ||
    !datesAreDefault ||
    tagFilter !== "all";

  const printBtn =
    boardRows.length > 0 ? (
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
          actions={printBtn}
        />

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          searchClassName="w-44 sm:w-48"
          tiles={
            <>
              <MiniStat
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatAll")}
                value={String(totals.all)}
                toneClass="bg-primary/15 text-primary dark:bg-primary/30 dark:text-emerald-100"
                selected={tagFilter === "all"}
                onClick={() => setTagFilter("all")}
              />
              <MiniStat
                icon={<IconSoup className="h-3.5 w-3.5" />}
                label="MS"
                value={String(totals.ms)}
                toneClass={tagCellClass("MS")}
                selected={tagFilter === "MS"}
                onClick={() => selectTagFilter("MS")}
              />
              <MiniStat
                icon={<IconShield className="h-3.5 w-3.5" />}
                label="CD"
                value={String(totals.cd)}
                toneClass={tagCellClass("CD")}
                selected={tagFilter === "CD"}
                onClick={() => selectTagFilter("CD")}
              />
            </>
          }
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => applyDateRange(from, to)}
            label={t("common.dateRange")}
            triggerClassName="min-w-[10rem] w-[10rem] px-2 text-xs"
          />
          <div className="w-[7.5rem] shrink-0">
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
          <div className="w-[7rem] shrink-0">
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
              setTagFilter("all");
              applyDateRange("", "");
            }}
          />
        </SearchFilterBar>

        {ledger.rows.length === 0 ? (
          <EmptyState title={t("mess.ledgerEmpty")} />
        ) : boardRows.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <MonthLedgerBoard
            month={month}
            dayCount={ledger.dayCount}
            tagCodes={boardTagCodes}
            rows={boardRows}
            columnDates={ledger.columnDates}
            showAllColumn={tagFilter === "all"}
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
  toneClass,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  toneClass?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 transition",
        toneClass ??
          "border-neutral-200/90 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        selected
          ? "ring-2 ring-inset ring-neutral-900/25 dark:ring-white/35"
          : "border-transparent hover:brightness-[0.97] dark:hover:brightness-110",
      )}
    >
      <span className="shrink-0 opacity-90" aria-hidden>
        {icon}
      </span>
      <span className="truncate text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="shrink-0 text-xs font-extrabold tabular-nums">
        {value}
      </span>
    </button>
  );
}
