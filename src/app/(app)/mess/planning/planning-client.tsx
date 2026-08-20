"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconCalendarEvent, IconSoup } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { MessPageTabs } from "@/components/layout/mess-tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { eachISODate, formatDateLong, monthDateBounds, todayISO } from "@/lib/date";
import { getMessEaters } from "@/lib/store/mess";
import { listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import type { MealShiftId } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

function defaultRange() {
  const { from } = monthDateBounds();
  return { from, to: todayISO() };
}

export default function MessPlanningClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  const [q, setQ] = useState("");
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rangeBounds = useMemo(() => {
    const today = todayISO();
    const lo = dateFrom <= dateTo ? dateFrom : dateTo;
    const hi = dateFrom <= dateTo ? dateTo : dateFrom;
    const to = hi > today ? today : hi;
    const from = lo > today ? today : lo;
    return { from, to };
  }, [dateFrom, dateTo]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const today = todayISO();
    return eachISODate(rangeBounds.from, rangeBounds.to)
      .map((date) => ({
        date,
        eaters: getMessEaters(date).length,
      }))
      .filter((row) => {
        if (shift !== "all" && row.eaters <= 0) return false;
        if (!query) return true;
        return row.date.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (a.date === today && b.date !== today) return -1;
        if (b.date === today && a.date !== today) return 1;
        return b.date.localeCompare(a.date);
      });
  }, [
    q,
    rangeBounds,
    shift,
    state.users,
    state.assignments,
    state.boro_khana_dates,
    state.approved_dates,
    state.suppressed_carries,
  ]);

  const eaterTotal = rows.reduce((sum, row) => sum + row.eaters, 0);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function resetPage() {
    setPage(1);
  }

  const filtersActive =
    shift !== "all" ||
    dateFrom !== initial.from ||
    dateTo !== initial.to;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-amber-50/50 to-emerald-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messPlanning.title")}
              subtitle={t("pages.messPlanning.subtitle", {
                count: rows.length,
              })}
              center={<MessPageTabs />}
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={(v) => {
            setQ(v);
            resetPage();
          }}
          searchPlaceholder={t("mess.planning.searchPlaceholder")}
          tiles={
            <StatChip
              icon={<IconSoup className="h-3.5 w-3.5" stroke={2.25} />}
              label={t("mess.planning.planned")}
              value={String(eaterTotal)}
              accent
            />
          }
        >
          <DateRangePicker
            from={rangeBounds.from}
            to={rangeBounds.to}
            max={todayISO()}
            maxSpanDays={31}
            onChange={({ from, to }) => {
              const today = todayISO();
              if (!from && !to) {
                const next = defaultRange();
                setDateFrom(next.from);
                setDateTo(next.to);
              } else {
                const start = from && from > today ? today : from;
                let end = to || from;
                if (end > today) end = today;
                setDateFrom(start);
                setDateTo(end);
              }
              resetPage();
            }}
            label={t("common.dateRange")}
            triggerClassName="min-w-[10rem] w-[10rem] px-2 text-xs"
          />
          <div className="w-[10rem] shrink-0">
            <Select
              value={shift}
              onValueChange={(v) => {
                setShift(v as MealShiftId | "all");
                resetPage();
              }}
            >
              <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allShift")}</SelectItem>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {mealShiftLabel(s.id, s.name, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ClearFiltersButton
            disabled={!filtersActive && !q.trim()}
            onClick={() => {
              const next = defaultRange();
              setQ("");
              setShift("all");
              setDateFrom(next.from);
              setDateTo(next.to);
              resetPage();
            }}
          />
        </SearchFilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={t("mess.planning.empty")}
            description={t("mess.planning.emptyHint")}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconCalendarEvent className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("pages.messPlanning.title")}
              </h2>
              <span className="ml-auto text-xs tabular-nums text-neutral-500">
                {pageRows.length}/{rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("mess.planning.date")}</th>
                    {shifts.map((s) => (
                      <th key={s.id} className="px-4 py-3">
                        {mealShiftLabel(s.id, s.name, t)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const isToday = row.date === todayISO();
                    return (
                    <tr
                      key={row.date}
                      className={cn(
                        "border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                        isToday && "bg-emerald-50/70 dark:bg-emerald-950/30",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {formatDateLong(row.date, dateLocale)}
                          </p>
                          {isToday ? (
                            <Badge className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                              {t("mess.planning.today")}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-neutral-500">
                          {row.date}
                        </p>
                      </td>
                      {shifts.map((s) => (
                        <td
                          key={s.id}
                          className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300"
                        >
                          {row.eaters || "—"}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              className="no-print"
              page={safePage}
              totalPages={totalPages}
              total={rows.length}
              from={(safePage - 1) * pageSize + 1}
              to={Math.min(safePage * pageSize, rows.length)}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}

function StatChip({
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
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span
        className={cn(
          "opacity-80",
          accent ? "text-primary" : "text-neutral-500",
        )}
        aria-hidden
      >
        {icon}
      </span>
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
