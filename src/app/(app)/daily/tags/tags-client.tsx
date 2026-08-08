"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconPrinter,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RegisterBoard,
  PaintTagSelect,
} from "@/components/daily/register-board";
import { useStore } from "@/hooks/use-store";
import { RANKS, WINGS } from "@/lib/constants";
import {
  daysInMonth,
  monthKey,
  nextISODate,
  parseMonthInput,
  todayISO,
  dateInMonth,
} from "@/lib/date";
import {
  clearTag,
  findPriorTag,
  listByMonth,
  setTag,
  setTagRange,
} from "@/lib/store/assignments";
import { countTaggedToday, getProjectedTagMembers } from "@/lib/store/mess";
import { compareUsers } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export default function TagsPageClient() {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = parseMonthInput(monthParam ?? monthKey());
  const today = todayISO();
  const dayCount = daysInMonth(month);

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const setMonth = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", next);
      params.delete("date");
      router.replace(`${pathname}?${params.toString()}`);
      setDateFrom("");
      setDateTo("");
    },
    [pathname, router, searchParams],
  );

  const users = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (u.approval_status !== "approved") return false;
        if (u.status !== "1") return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, q, rank, wing]);

  const assignments = useMemo(
    () => listByMonth(month),
    [state.assignments, month],
  );

  const priorByUser = useMemo(() => {
    const map = new Map<string, DailyTag>();
    const first = dateInMonth(month, 1);
    for (const u of users) {
      const prior = findPriorTag(u.id, first);
      if (prior) map.set(u.id, prior);
    }
    return map;
  }, [users, month, state.assignments]);

  const visibleDates = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    const out: string[] = [];
    for (let d = 1; d <= dayCount; d++) {
      const date = dateInMonth(month, d);
      if (from && date < from) continue;
      if (to && date > to) continue;
      out.push(date);
    }
    return out;
  }, [month, dayCount, dateFrom, dateTo]);

  const todayMsCount = useMemo(
    () => countTaggedToday("MS", today),
    [today, state.assignments, state.users],
  );

  const todayCdCount = useMemo(
    () => countTaggedToday("CD", today),
    [today, state.assignments, state.users],
  );

  const tomorrow = nextISODate(today);

  const tomorrowMsCount = useMemo(
    () => getProjectedTagMembers("MS", tomorrow).members.length,
    [tomorrow, state.assignments, state.users, state.suppressed_carries],
  );

  const tomorrowCdCount = useMemo(
    () => getProjectedTagMembers("CD", tomorrow).members.length,
    [tomorrow, state.assignments, state.users, state.suppressed_carries],
  );

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    return `/daily/tags/print?${params.toString()}`;
  }, [month, dateFrom, dateTo, q, rank, wing]);

  function onTagChange(userId: string, date: string, tag: DailyTag | "") {
    if (!tag) clearTag(userId, date);
    else setTag(userId, date, tag);
  }

  function onPaintRange(userId: string, dates: string[], tag: DailyTag | "") {
    setTagRange(userId, dates, tag);
  }

  const fieldClass =
    "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.dailyTags.title")}
          subtitle={t("pages.dailyTags.subtitle", { month })}
          center={<DailyTabs />}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <MiniStat
                label={t("daily.rosterStatAll")}
                value={String(users.length)}
                accent
              />
              <MiniStat
                label={t("daily.todayMs")}
                value={String(todayMsCount)}
                accent
              />
              <MiniStat
                label={t("daily.todayCd")}
                value={String(todayCdCount)}
              />
              <MiniStat
                label={t("daily.tomorrowMess")}
                value={String(tomorrowMsCount)}
                accent
              />
              <MiniStat
                label={t("daily.tomorrowCd")}
                value={String(tomorrowCdCount)}
              />
              {users.length > 0 && visibleDates.length > 0 ? (
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
          <div className="hidden w-[9rem]" aria-hidden>
            <PaintTagSelect
              paintTag={paintTag}
              onPaintTagChange={setPaintTag}
              triggerClassName={cn(fieldClass, "w-full font-mono font-bold")}
            />
          </div>
        </div>

        {users.length === 0 ? (
          <EmptyState title={t("daily.emptyTags")} />
        ) : visibleDates.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <RegisterBoard
            users={users}
            month={month}
            dayCount={dayCount}
            assignments={assignments}
            todayISO={today}
            paintTag={paintTag}
            onPaintTagChange={setPaintTag}
            onTagChange={onTagChange}
            onPaintRange={onPaintRange}
            priorByUser={priorByUser}
            suppressedCarries={state.suppressed_carries ?? []}
            dateFrom={dateFrom}
            dateTo={dateTo}
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
