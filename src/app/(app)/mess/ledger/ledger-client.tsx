"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { IconCalendar, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { MESS_LEDGER_TAGS, RANKS, WINGS } from "@/lib/constants";
import { dateInMonth, daysInMonth, monthKey, todayISO } from "@/lib/date";
import { buildMonthLedger, type LedgerRow } from "@/lib/reports";
import { countTaggedToday } from "@/lib/store/mess";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

function narrowRowsToDays(rows: LedgerRow[], days: number[]): LedgerRow[] {
  if (!days.length) return rows;
  const daySet = new Set(days);
  return rows
    .map((row) => {
      const counts: Partial<Record<DailyTag, number>> = {};
      let totalDays = 0;
      for (const d of daySet) {
        const tag = row.days[d - 1];
        if (!tag) continue;
        counts[tag] = (counts[tag] ?? 0) + 1;
        totalDays += 1;
      }
      return { ...row, tagCounts: counts, totalDays };
    })
    .filter((row) => row.totalDays > 0);
}

export default function MessLedgerClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rawMonth = searchParams.get("month");
  const defaultMonth = monthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;
  const dayCount = daysInMonth(month);

  useEffect(() => {
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", defaultMonth);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, pathname, router, searchParams]);

  useEffect(() => {
    setDateFrom("");
    setDateTo("");
  }, [month]);

  const ledger = useMemo(
    () => buildMonthLedger(month, MESS_LEDGER_TAGS),
    [state.assignments, state.users, month],
  );

  const visibleDays = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (!from && !to) return undefined;
    const out: number[] = [];
    for (let d = 1; d <= dayCount; d++) {
      const date = dateInMonth(month, d);
      if (from && !to && date !== from) continue;
      if (!from && to && date !== to) continue;
      if (from && to) {
        const a = from <= to ? from : to;
        const b = from <= to ? to : from;
        if (date < a || date > b) continue;
      }
      out.push(d);
    }
    return out;
  }, [month, dayCount, dateFrom, dateTo]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    if (visibleDays?.length) {
      list = narrowRowsToDays(list, visibleDays);
    }
    return list;
  }, [ledger.rows, q, rank, wing, visibleDays]);

  const totals = useMemo(() => {
    const today = todayISO();
    return {
      ms: countTaggedToday("MS", today),
      cd: countTaggedToday("CD", today),
    };
  }, [state.assignments, state.users]);

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return `/mess/ledger/print?${params.toString()}`;
  }, [month, q, rank, wing, dateFrom, dateTo]);

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const fieldClass =
    "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div>
          <PageHeader
            title={t("pages.messLedger.title")}
            subtitle={t("pages.messLedger.subtitle", { month })}
            actions={
              <div className="flex flex-wrap items-center gap-2.5">
                <MiniStat
                  label={t("daily.rosterStatAll")}
                  value={String(rows.length)}
                  accent
                />
                <MiniStat
                  label={t("daily.todayMs")}
                  value={String(totals.ms)}
                  accent
                />
                <MiniStat
                  label={t("daily.todayCd")}
                  value={String(totals.cd)}
                />
                {rows.length > 0 ? (
                  <Button
                    asChild
                    variant="cta"
                    size="sm"
                    className="h-auto rounded-lg px-2.5 py-1.5"
                  >
                    <Link
                      href={printHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconPrinter className="h-4 w-4" />
                      {t("mess.print")}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="cta"
                    size="sm"
                    className="h-auto rounded-lg px-2.5 py-1.5"
                    disabled
                  >
                    <IconPrinter className="h-4 w-4" />
                    {t("mess.print")}
                  </Button>
                )}
              </div>
            }
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div className="min-w-[14rem] flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cc.searchPlaceholder")}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div className="w-44 shrink-0">
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={cn(fieldClass, "w-full pl-8")}
              />
            </div>
          </div>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            min={`${month}-01`}
            max={`${month}-${String(dayCount).padStart(2, "0")}`}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
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
            disabled={
              !q.trim() &&
              rank === "all" &&
              wing === "all" &&
              !dateFrom &&
              !dateTo
            }
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              setDateFrom("");
              setDateTo("");
            }}
          />
        </div>

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
            visibleDays={visibleDays}
            showAllColumn
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
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
