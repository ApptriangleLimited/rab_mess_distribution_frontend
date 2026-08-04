"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPrinter,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { nextISODate, previousISODate, todayISO } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { countByField, getMessEaters } from "@/lib/store/mess";
import { getServedIds, toggleServed } from "@/lib/served";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function MessTodayClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const dateParam = searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : todayISO();

  const [servedTick, setServedTick] = useState(0);
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [serveFilter, setServeFilter] = useState("all");

  const servedIds = useMemo(() => {
    void servedTick;
    return getServedIds(date);
  }, [date, servedTick]);

  const eaters = useMemo(
    () => getMessEaters(date),
    [state.users, state.assignments, date],
  );

  const servedCount = useMemo(
    () => eaters.filter((e) => servedIds.has(e.id)).length,
    [eaters, servedIds],
  );
  const remaining = eaters.length - servedCount;
  const progress =
    eaters.length === 0 ? 0 : Math.round((servedCount / eaters.length) * 100);

  const byWing = useMemo(() => countByField(eaters, "wing"), [eaters]);
  const byRank = useMemo(() => countByField(eaters, "rank"), [eaters]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return eaters.filter((u) => {
      if (rank !== "all" && u.rank !== rank) return false;
      if (wing !== "all" && u.wing !== wing) return false;
      const served = servedIds.has(u.id);
      if (serveFilter === "served" && !served) return false;
      if (serveFilter === "pending" && served) return false;
      if (!query) return true;
      return [u.name, u.rab_id, u.wing, u.rank, u.phone]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [eaters, q, rank, wing, serveFilter, servedIds]);

  const setDate = useCallback(
    (next: string) => {
      if (!isValidDate(next)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", next);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  function onExport() {
    const rows = [
      [
        "#",
        t("mess.colName"),
        t("mess.colRabId"),
        t("mess.colRank"),
        t("mess.colWing"),
        t("mess.colPhone"),
        t("mess.colServed"),
      ],
      ...eaters.map((u, i) => [
        String(i + 1),
        u.name,
        u.rab_id,
        u.rank,
        u.wing,
        u.phone,
        servedIds.has(u.id) ? "yes" : "no",
      ]),
    ];
    downloadCsv(`mess-${date}.csv`, rows);
  }

  const fieldClass =
    "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.messToday.title")}
          subtitle={t("pages.messToday.subtitle", {
            count: eaters.length,
            date,
          })}
          actions={
            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={t("mess.prevDay")}
                  onClick={() => setDate(previousISODate(date))}
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <div className="relative w-[11.5rem] shrink-0">
                  <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label={t("mess.date")}
                    className={cn(fieldClass, "h-9 w-[11.5rem] pl-8")}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={t("mess.nextDay")}
                  onClick={() => setDate(nextISODate(date))}
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
                className="h-9 rounded-xl"
                onClick={() => window.print()}
              >
                <IconPrinter className="h-3.5 w-3.5" />
                {t("mess.print")}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip
            label={t("mess.total")}
            value={String(eaters.length)}
            accent
          />
          <StatChip
            label={t("mess.served")}
            value={String(servedCount)}
            icon={<IconCheck className="h-3.5 w-3.5 text-primary" />}
          />
          <StatChip label={t("mess.remaining")} value={String(remaining)} />
          <StatChip
            label={t("mess.progress")}
            value={`${progress}%`}
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {eaters.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("mess.progress")}
              </p>
              <p className="text-xs tabular-nums text-neutral-500">
                {servedCount}/{eaters.length}
              </p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/80 to-white p-3.5 shadow-sm no-print dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
          <div className="min-w-[12rem] flex-1 sm:min-w-[14rem]">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("mess.searchPlaceholder")}
                aria-label={t("common.search")}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </div>
          <div className="w-[10rem]">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={fieldClass}>
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
          <div className="w-[10rem]">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={fieldClass}>
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
          <div className="w-[10rem]">
            <Select value={serveFilter} onValueChange={setServeFilter}>
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.servedAll")}</SelectItem>
                <SelectItem value="served">{t("mess.servedOnly")}</SelectItem>
                <SelectItem value="pending">{t("mess.pendingOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ClearFiltersButton
            disabled={
              !q.trim() &&
              rank === "all" &&
              wing === "all" &&
              serveFilter === "all"
            }
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              setServeFilter("all");
            }}
          />
        </div>

        {eaters.length > 0 ? (
          <div className="grid gap-3 no-print sm:grid-cols-2">
            <Breakdown
              title={t("mess.byWing")}
              items={byWing}
              tone="wing"
            />
            <Breakdown
              title={t("mess.byRank")}
              items={byRank}
              tone="rank"
            />
          </div>
        ) : null}

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
                {filtered.length}/{eaters.length}
              </span>
            </div>
            <MessTodayList
              eaters={filtered}
              servedIds={servedIds}
              onToggleServed={(userId) => {
                toggleServed(date, userId);
                setServedTick((n) => n + 1);
              }}
            />
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}

function Breakdown({
  title,
  items,
  tone,
}: {
  title: string;
  items: [string, number][];
  tone: "wing" | "rank";
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(([label, n]) => (
            <span
              key={label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
                tone === "wing"
                  ? "border-nav-accent/20 bg-nav-accent/10 text-nav-accent"
                  : "border-primary/20 bg-primary/10 text-primary",
              )}
            >
              <span className="font-medium">{label}</span>
              <span className="tabular-nums opacity-80">{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
  icon,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
