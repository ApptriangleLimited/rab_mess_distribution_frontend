"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuilding,
  IconFlame,
  IconPrinter,
  IconShield,
  IconSoup,
  IconStar,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { tagCellClass } from "@/components/daily/register-board";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { MessTabs } from "@/components/layout/mess-tabs";
import { Button } from "@/components/ui/button";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { useStore } from "@/hooks/use-store";
import { ApiClientError } from "@/lib/api/client";
import {
  ledgerRowApiToLedgerRow,
  listMessLedger,
} from "@/lib/api/mess";
import { isApiEnabled } from "@/lib/api/mode";
import { canonicalRankName, MESS_LEDGER_TAGS } from "@/lib/constants";
import { formatDateLong, monthDateBounds } from "@/lib/date";
import { buildRangeLedger, type LedgerRow } from "@/lib/reports";
import { useToast } from "@/components/shared/toast-provider";
import { listBoroKhanaDates } from "@/lib/store/boro-khana";
import { getMessEaters } from "@/lib/store/mess";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import { isCivilianMember } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type MessChipFilter = "all" | "DAD" | "FR" | "MFR" | "CIVIL" | "MS" | "CD";

function isDadRank(rank: string) {
  return canonicalRankName(rank) === "DAD";
}

function rowHasTag(row: LedgerRow, tag: DailyTag) {
  return row.days.some((day) => day === tag);
}

function defaultRange() {
  return monthDateBounds();
}

export default function MessLedgerClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const apiOn = isApiEnabled();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [tagFilter, setTagFilter] = useState<MessChipFilter>("all");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [apiLedger, setApiLedger] = useState<{
    rows: LedgerRow[];
    dates: string[];
    tagCodes: DailyTag[];
    bkDays: { date: string; eaters: number }[];
  }>({ rows: [], dates: [], tagCodes: [...MESS_LEDGER_TAGS], bkDays: [] });

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

  useEffect(() => {
    if (!apiOn) return;
    let cancelled = false;
    setLoading(true);
    void listMessLedger(rangeBounds.from, rangeBounds.to)
      .then((res) => {
        if (cancelled) return;
        setApiLedger({
          rows: res.rows.map(ledgerRowApiToLedgerRow),
          dates: res.dates,
          tagCodes: [...MESS_LEDGER_TAGS],
          bkDays: res.boro_khana_days.map((row) => ({
            date: row.date,
            eaters: row.eater_count,
          })),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setApiLedger({
          rows: [],
          dates: [],
          tagCodes: [...MESS_LEDGER_TAGS],
          bkDays: [],
        });
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load mess ledger from API.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, rangeBounds, toast]);

  const demoLedger = useMemo(() => {
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

  const ledger = apiOn
    ? {
        month,
        dayCount: apiLedger.dates.length,
        tagCodes: apiLedger.tagCodes,
        rows: apiLedger.rows,
        columnDates: apiLedger.dates,
      }
    : demoLedger;

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
    let dad = 0;
    let fr = 0;
    let mfr = 0;
    const query = q.trim().toLowerCase();
    const civilFromUsers = state.users.filter((user) => {
      if (user.approval_status !== "approved") return false;
      if (!isCivilianMember(user)) return false;
      if (rank !== "all" && user.rank !== rank) return false;
      if (!memberMatchesWingFilter(user.wing, wing)) return false;
      if (!query) return true;
      return [user.name, user.rab_id, user.rank, user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).length;
    for (const row of rows) {
      if (isDadRank(row.user.rank)) {
        dad += 1;
        if (rowHasTag(row, "FR")) fr += 1;
        if (rowHasTag(row, "MFR")) mfr += 1;
      }
      for (const tag of row.days) {
        if (tag === "MS") ms += 1;
        else if (tag === "CD") cd += 1;
      }
    }
    const civilFromRows = rows.filter((row) => isCivilianMember(row.user)).length;
    return {
      ms,
      cd,
      all: ms + cd,
      dad,
      fr,
      mfr,
      civil: civilFromUsers || civilFromRows,
    };
  }, [rows, state.users, q, rank, wing, state.wing_parent]);

  const boardRows = useMemo(() => {
    if (tagFilter === "all") return rows;
    if (tagFilter === "DAD") return rows.filter((row) => isDadRank(row.user.rank));
    if (tagFilter === "FR") {
      return rows.filter(
        (row) => isDadRank(row.user.rank) && rowHasTag(row, "FR"),
      );
    }
    if (tagFilter === "MFR") {
      return rows.filter(
        (row) => isDadRank(row.user.rank) && rowHasTag(row, "MFR"),
      );
    }
    if (tagFilter === "CIVIL") {
      return rows.filter((row) => isCivilianMember(row.user));
    }
    return rows.filter((row) => row.days.some((d) => d === tagFilter));
  }, [rows, tagFilter]);

  const boardTagCodes = useMemo((): DailyTag[] => {
    if (tagFilter === "FR" || tagFilter === "MFR" || tagFilter === "MS" || tagFilter === "CD") {
      return [tagFilter];
    }
    return ledger.tagCodes;
  }, [tagFilter, ledger.tagCodes]);

  const demoBkDaysInRange = useMemo(() => {
    return listBoroKhanaDates()
      .filter((d) => d >= rangeBounds.from && d <= rangeBounds.to)
      .map((d) => ({
        date: d,
        eaters: getMessEaters(d).length,
      }));
  }, [
    rangeBounds,
    state.boro_khana_dates,
    state.users,
    state.assignments,
  ]);

  const bkDaysInRange = apiOn ? apiLedger.bkDays : demoBkDaysInRange;

  function selectTagFilter(next: MessChipFilter) {
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
        className="h-10 shrink-0 rounded-xl px-3 shadow-sm shadow-primary/20"
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
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-nav-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messLedger.title")}
              subtitle={t("pages.messLedger.subtitle", { month })}
              center={<MessTabs />}
              actions={printBtn}
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          searchClassName="w-44 sm:w-48"
          filtersActive={filtersActive}
          wrapTiles
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={
            <>
              <MiniStat
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatAll")}
                value={String(totals.all)}
                toneClass="border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100"
                selected={tagFilter === "all"}
                onClick={() => setTagFilter("all")}
              />
              <MiniStat
                icon={<IconStar className="h-3.5 w-3.5" />}
                label="DAD"
                value={String(totals.dad)}
                toneClass="border-sky-200 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-900/55 dark:text-sky-100"
                selected={tagFilter === "DAD"}
                onClick={() => selectTagFilter("DAD")}
              />
              <MiniStat
                icon={<IconStar className="h-3.5 w-3.5" />}
                label="FR"
                value={String(totals.fr)}
                toneClass={tagCellClass("FR")}
                selected={tagFilter === "FR"}
                onClick={() => selectTagFilter("FR")}
              />
              <MiniStat
                icon={<IconStar className="h-3.5 w-3.5" />}
                label="MFR"
                value={String(totals.mfr)}
                toneClass={tagCellClass("MFR")}
                selected={tagFilter === "MFR"}
                onClick={() => selectTagFilter("MFR")}
              />
              <MiniStat
                icon={<IconBuilding className="h-3.5 w-3.5" />}
                label="CIVIL"
                value={String(totals.civil)}
                toneClass="border-stone-200 bg-stone-100 text-stone-900 dark:border-stone-700 dark:bg-stone-800/70 dark:text-stone-100"
                selected={tagFilter === "CIVIL"}
                onClick={() => selectTagFilter("CIVIL")}
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
              {bkDaysInRange.map((row) => (
                <Link
                  key={row.date}
                  href={`/mess/reports?from=${row.date}&to=${row.date}`}
                  title={`${t("mess.bkDaysInRange")}: ${formatDateLong(row.date, locale === "bn" ? "bn-BD" : "en-GB")} · ${t("mess.openBkList")}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-orange-200/90 bg-orange-50 px-3 text-orange-900 shadow-sm transition hover:brightness-[0.97] dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200 dark:hover:brightness-110"
                >
                  <IconFlame className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide">
                    BK
                  </span>
                  <span className="max-w-[7rem] truncate text-[10px] font-semibold tabular-nums sm:max-w-none">
                    {row.date.slice(8)}/{row.date.slice(5, 7)}
                  </span>
                  <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-xs font-extrabold tabular-nums dark:bg-white/10">
                    {row.eaters}
                  </span>
                </Link>
              ))}
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
          <SettingsRankFilter
            value={rank}
            onChange={setRank}
            className="w-[7.5rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <SettingsWingFilter
            value={wing}
            onChange={setWing}
            className="w-[7rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
        </SearchFilterBar>

        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </p>
        ) : ledger.rows.length === 0 ? (
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
        "inline-flex h-9 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 shadow-sm transition",
        toneClass ??
          "border-neutral-200/90 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        selected
          ? "border-black ring-1 ring-black brightness-95 dark:border-white dark:ring-white dark:brightness-110"
          : "hover:brightness-[0.97] dark:hover:brightness-110",
      )}
    >
      <span className="shrink-0 opacity-90" aria-hidden>
        {icon}
      </span>
      <span className="truncate text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-xs font-extrabold tabular-nums dark:bg-white/10">
        {value}
      </span>
    </button>
  );
}
