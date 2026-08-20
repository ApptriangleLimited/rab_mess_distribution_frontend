"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconDownload,
  IconFlame,
  IconPrinter,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { MessTabs } from "@/components/layout/mess-tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessTodayList } from "@/components/mess/mess-today-list";
import { useStore } from "@/hooks/use-store";
import { RANKS, WINGS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { getMessEaters } from "@/lib/store/mess";
import { isBoroKhana } from "@/lib/store/boro-khana";
import { useT } from "@/i18n/provider";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function MessTodayClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const dateParam = searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : todayISO();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [date]);

  const isBk = isBoroKhana(date);

  const eaters = useMemo(
    () => getMessEaters(date),
    [state.users, state.assignments, state.boro_khana_dates, date],
  );

  const guestCount = useMemo(
    () => eaters.filter((e) => e.mess_reason !== "MS").length,
    [eaters],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return eaters.filter((u) => {
      if (rank !== "all" && u.rank !== rank) return false;
      if (wing !== "all" && u.wing !== wing) return false;
      if (!query) return true;
      return [u.name, u.rab_id, u.wing, u.rank, u.phone]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [eaters, q, rank, wing]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function resetPage() {
    setPage(1);
  }

  function onExport() {
    const rows = [
      [
        "#",
        t("mess.colName"),
        t("mess.colRabId"),
        t("mess.colRank"),
        t("mess.colWing"),
        t("mess.colPhone"),
      ],
      ...eaters.map((u, i) => [
        String(i + 1),
        u.name,
        u.rab_id,
        u.rank,
        u.wing,
        u.phone,
      ]),
    ];
    downloadCsv(`mess-${date}.csv`, rows);
  }

  const fieldClass = searchFilterFieldClass;
  const filtersActive = rank !== "all" || wing !== "all";

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
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
              title={t("pages.messToday.title")}
              subtitle={t("pages.messToday.subtitle", {
                count: eaters.length,
                date,
              })}
              center={<MessTabs />}
              actions={
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={onExport}
                    disabled={!eaters.length}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    {t("mess.exportCsv")}
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    className="h-9 rounded-xl shadow-sm shadow-primary/20"
                    onClick={() => window.print()}
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
          searchPlaceholder={t("mess.searchPlaceholder")}
          tiles={
            <>
              <StatChip
                label={t("mess.total")}
                value={String(eaters.length)}
                accent
              />
              {isBk ? (
                <div
                  className="inline-flex h-10 max-w-full shrink-0 items-center gap-2 rounded-xl border border-orange-200/90 bg-orange-50 px-3.5 text-orange-950 shadow-sm dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-100"
                  title={t("mess.boroKhanaBannerHint", {
                    total: eaters.length,
                    guests: guestCount,
                  })}
                >
                  <IconFlame className="h-3.5 w-3.5 shrink-0" stroke={2.25} />
                  <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em]">
                    {t("mess.boroKhanaBanner")}
                  </span>
                </div>
              ) : null}
            </>
          }
        >
          <div className="w-[10rem] shrink-0">
            <Select
              value={rank}
              onValueChange={(v) => {
                setRank(v);
                resetPage();
              }}
            >
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
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
          <div className="w-[10rem] shrink-0">
            <Select
              value={wing}
              onValueChange={(v) => {
                setWing(v);
                resetPage();
              }}
            >
              <SelectTrigger className={cn(fieldClass, "w-full")}>
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
          <ClearFiltersButton
            disabled={!filtersActive && !q.trim()}
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              resetPage();
            }}
          />
        </SearchFilterBar>

        {eaters.length === 0 ? (
          <EmptyState
            title={t("mess.empty")}
            description={t("mess.emptyHint")}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm print:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 no-print dark:border-neutral-800">
              <IconUsers className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("mess.board")}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
                {pageRows.length}/{filtered.length}
              </span>
            </div>
            <MessTodayList eaters={pageRows} />
            <ListPagination
              className="no-print"
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              from={(safePage - 1) * pageSize + 1}
              to={Math.min(safePage * pageSize, filtered.length)}
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
