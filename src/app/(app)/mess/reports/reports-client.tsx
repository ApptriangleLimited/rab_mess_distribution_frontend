"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCircleCheck,
  IconCopy,
  IconDownload,
  IconFileReport,
  IconPrinter,
  IconSum,
} from "@tabler/icons-react";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { MessPageTabs } from "@/components/layout/mess-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { WINGS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { formatDateLong, monthDateBounds } from "@/lib/date";
import {
  isMealAssignStatus,
  listMealAssigns,
} from "@/lib/store/meal-assigns";
import { getMealShift, listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import type { MealAssignStatus, MealShiftId, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | MealAssignStatus;

function defaultRange() {
  return monthDateBounds();
}

function shiftLabel(
  t: ReturnType<typeof useT>,
  shiftId: MealShiftId,
) {
  const shift = getMealShift(shiftId);
  return mealShiftLabel(shiftId, shift?.name ?? shiftId, t);
}

function formatCheckInTime(iso: string, locale: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessReportsClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const initial = defaultRange();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const statusParam = searchParams.get("status");

  const [q, setQ] = useState("");
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [wing, setWing] = useState("all");
  const [status, setStatus] = useState<StatusFilter>(
    statusParam && isMealAssignStatus(statusParam)
      ? Number(statusParam) as MealAssignStatus
      : "all",
  );
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    if (statusParam && isMealAssignStatus(statusParam)) {
      setStatus(Number(statusParam) as MealAssignStatus);
    } else {
      setStatus("all");
    }
    setPage(1);
  }, [statusParam]);

  const rangeBounds = useMemo(() => {
    return dateFrom <= dateTo
      ? { from: dateFrom, to: dateTo }
      : { from: dateTo, to: dateFrom };
  }, [dateFrom, dateTo]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of state.users) map.set(u.id, u);
    return map;
  }, [state.users]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return listMealAssigns().filter((row) => {
      if (row.date < rangeBounds.from || row.date > rangeBounds.to) {
        return false;
      }
      if (shift !== "all" && row.shift_id !== shift) return false;
      if (status !== "all" && row.status !== status) return false;
      const member = usersById.get(row.member_id);
      if (wing !== "all" && member?.wing !== wing) return false;
      if (!query) return true;
      return [member?.name, member?.rab_id, member?.rank, member?.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [state.meal_assigns, q, rangeBounds, shift, status, wing, usersById]);

  const uniqueCount = rows.filter((r) => r.status === 1).length;
  const dupCount = rows.filter((r) => r.status === 2).length;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const filtersActive =
    shift !== "all" ||
    wing !== "all" ||
    status !== "all" ||
    dateFrom !== initial.from ||
    dateTo !== initial.to;

  function resetPage() {
    setPage(1);
  }

  function onExport() {
    const header = [
      t("mess.planning.date"),
      t("mess.reports.colTime"),
      t("mess.colName"),
      t("mess.colRabId"),
      t("mess.colRank"),
      t("mess.colWing"),
      t("mess.reports.colShift"),
      t("mess.reports.colStatus"),
    ];
    const body = rows.map((row) => {
      const member = usersById.get(row.member_id);
      return [
        row.date,
        formatCheckInTime(row.check_in_time, dateLocale),
        member?.name ?? "",
        member?.rab_id ?? "",
        member?.rank ?? "",
        member?.wing ?? "",
        shiftLabel(t, row.shift_id),
        row.status === 1
          ? t("mess.reports.unique")
          : t("mess.reports.duplicate"),
      ];
    });
    downloadCsv(
      `meal-assigns-${rangeBounds.from}_${rangeBounds.to}.csv`,
      [header, ...body],
    );
  }

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-sky-50/50 to-emerald-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messReports.title")}
              subtitle={t("pages.messReports.subtitle", {
                count: rows.length,
              })}
              center={<MessPageTabs />}
              actions={
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={onExport}
                    disabled={!rows.length}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    {t("mess.exportCsv")}
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    className="h-9 rounded-xl shadow-sm shadow-primary/20"
                    onClick={() => window.print()}
                    disabled={!rows.length}
                  >
                    <IconPrinter className="h-3.5 w-3.5" />
                    {t("mess.print")}
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <SearchFilterBar
          className="no-print"
          search={q}
          onSearchChange={(v) => {
            setQ(v);
            resetPage();
          }}
          searchPlaceholder={t("mess.reports.searchPlaceholder")}
          tiles={
            <>
              <StatChip
                icon={<IconSum className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("mess.reports.checkIns")}
                value={String(rows.length)}
                accent
                selected={status === "all"}
                onClick={() => {
                  setStatus("all");
                  resetPage();
                }}
              />
              <StatChip
                icon={<IconCircleCheck className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("mess.reports.unique")}
                value={String(uniqueCount)}
                selected={status === 1}
                onClick={() => {
                  setStatus(1);
                  resetPage();
                }}
              />
              <StatChip
                icon={<IconCopy className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("mess.reports.duplicate")}
                value={String(dupCount)}
                selected={status === 2}
                onClick={() => {
                  setStatus(2);
                  resetPage();
                }}
              />
            </>
          }
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => {
              if (!from && !to) {
                const next = defaultRange();
                setDateFrom(next.from);
                setDateTo(next.to);
              } else {
                setDateFrom(from);
                setDateTo(to || from);
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
          <div className="w-[10rem] shrink-0">
            <Select
              value={wing}
              onValueChange={(v) => {
                setWing(v);
                resetPage();
              }}
            >
              <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                <SelectValue />
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
          <div className="w-[10rem] shrink-0">
            <Select
              value={String(status)}
              onValueChange={(v) => {
                setStatus(
                  isMealAssignStatus(v) ? (Number(v) as MealAssignStatus) : "all",
                );
                resetPage();
              }}
            >
              <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("mess.reports.allStatus")}
                </SelectItem>
                <SelectItem value="1">{t("mess.reports.unique")}</SelectItem>
                <SelectItem value="2">{t("mess.reports.duplicate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ClearFiltersButton
            disabled={!filtersActive && !q.trim()}
            onClick={() => {
              const next = defaultRange();
              setQ("");
              setShift("all");
              setWing("all");
              setStatus("all");
              setDateFrom(next.from);
              setDateTo(next.to);
              resetPage();
            }}
          />
        </SearchFilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={t("mess.reports.empty")}
            description={t("mess.reports.emptyHint")}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconFileReport className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("pages.messReports.title")}
              </h2>
              <span className="ml-auto text-xs tabular-nums text-neutral-500">
                {pageRows.length}/{rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 print:bg-white">
                  <tr>
                    <th className="px-4 py-3">{t("mess.colName")}</th>
                    <th className="px-4 py-3">{t("mess.planning.date")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colTime")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colShift")}</th>
                    <th className="px-4 py-3">{t("mess.colWing")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const member = usersById.get(row.member_id);
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar name={member?.name ?? "?"} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                                {member?.name ?? "—"}
                              </p>
                              <p className="font-mono text-xs text-neutral-500">
                                {member?.rab_id ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-neutral-800 dark:text-neutral-200">
                            {formatDateLong(row.date, dateLocale)}
                          </p>
                          <p className="font-mono text-xs text-neutral-500">
                            {row.date}
                          </p>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                          {formatCheckInTime(row.check_in_time, dateLocale)}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                          {shiftLabel(t, row.shift_id)}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                          {member?.wing || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 1 ? (
                            <Badge className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                              {t("mess.reports.unique")}
                            </Badge>
                          ) : (
                            <Badge className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-950 dark:bg-rose-900/50 dark:text-rose-100">
                              {t("mess.reports.duplicate")}
                            </Badge>
                          )}
                        </td>
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
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5",
        selected
          ? "border-primary/40 bg-primary/[0.12] ring-1 ring-primary/20"
          : accent
            ? "border-primary/20 bg-primary/[0.08]"
            : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span
        className={cn(
          "opacity-80",
          selected || accent ? "text-primary" : "text-neutral-500",
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
          selected || accent
            ? "text-primary"
            : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </button>
  );
}
