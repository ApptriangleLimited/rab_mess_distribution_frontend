"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
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
  eachISODate,
  monthDateBounds,
  monthsCoveringRange,
  todayISO,
} from "@/lib/date";
import {
  autoApplyCarryForward,
  clearTag,
  findPriorTag,
  listByMonth,
  setTag,
  setTagRange,
} from "@/lib/store/assignments";
import { getProjectedTagMembers } from "@/lib/store/mess";
import { compareUsers } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

export default function TagsPageClient() {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const today = todayISO();
  const initial = defaultRange();

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const month = dateFrom.slice(0, 7) || initial.from.slice(0, 7);
  const dayCount = daysInMonth(month);

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

  /** Empty today cells inherit prior tag unless Daily cleared them. */
  useEffect(() => {
    const ids = state.users
      .filter((u) => u.approval_status === "approved" && u.status === "1")
      .map((u) => u.id);
    if (!ids.length) return;
    autoApplyCarryForward(ids, today);
  }, [today, state.users, state.assignments, state.suppressed_carries]);

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

  const assignmentMonths = useMemo(
    () => monthsCoveringRange(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const assignments = useMemo(
    () => assignmentMonths.flatMap((m) => listByMonth(m)),
    [state.assignments, assignmentMonths],
  );

  const rangeStart = useMemo(() => {
    return dateFrom <= dateTo ? dateFrom : dateTo;
  }, [dateFrom, dateTo]);

  const priorByUser = useMemo(() => {
    const map = new Map<string, DailyTag>();
    for (const u of users) {
      const prior = findPriorTag(u.id, rangeStart);
      if (prior) map.set(u.id, prior);
    }
    return map;
  }, [users, rangeStart, state.assignments]);

  const visibleDates = useMemo(
    () => eachISODate(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const defaultDates = defaultRange();
  const datesAreDefault =
    dateFrom === defaultDates.from && dateTo === defaultDates.to;

  /**
   * Default date range → today headcount (filtered).
   * Custom date filter → MS/CD person-days across that range.
   */
  const { msCount, cdCount } = useMemo(() => {
    const allowed = new Set(users.map((u) => u.id));
    const countTag = (tag: "MS" | "CD", date: string) =>
      getProjectedTagMembers(tag, date).members.filter((u) =>
        allowed.has(u.id),
      ).length;

    if (datesAreDefault) {
      return {
        msCount: countTag("MS", today),
        cdCount: countTag("CD", today),
      };
    }

    let ms = 0;
    let cd = 0;
    for (const date of visibleDates) {
      ms += countTag("MS", date);
      cd += countTag("CD", date);
    }
    return { msCount: ms, cdCount: cd };
  }, [
    datesAreDefault,
    today,
    visibleDates,
    users,
    state.assignments,
    state.users,
    state.suppressed_carries,
  ]);

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

  const fieldClass = searchFilterFieldClass;
  const filtersActive =
    rank !== "all" || wing !== "all" || !datesAreDefault;

  const printBtn =
    users.length > 0 && visibleDates.length > 0 ? (
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
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.dailyTags.title")}
          subtitle={t("pages.dailyTags.subtitle", { month })}
          center={<DailyTabs />}
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
                value={String(msCount + cdCount)}
                accent
              />
              <MiniStat
                icon={<IconSoup className="h-4 w-4" />}
                label={
                  datesAreDefault ? t("daily.todayMs") : t("mess.totalMs")
                }
                value={String(msCount)}
                accent
              />
              <MiniStat
                icon={<IconShield className="h-4 w-4" />}
                label={
                  datesAreDefault ? t("daily.todayCd") : t("mess.totalCd")
                }
                value={String(cdCount)}
              />
            </>
          }
          trailing={printBtn}
        >
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
            maxSpanDays={31}
            onChange={({ from, to }) => applyDateRange(from, to)}
            label={t("common.dateRange")}
          />
          <ClearFiltersButton
            disabled={!filtersActive && !q.trim()}
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              applyDateRange("", "");
            }}
          />
          <div className="hidden w-[9rem]" aria-hidden>
            <PaintTagSelect
              paintTag={paintTag}
              onPaintTagChange={setPaintTag}
              triggerClassName={cn(fieldClass, "w-full font-mono font-bold")}
            />
          </div>
        </SearchFilterBar>

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
        "inline-flex h-11 min-w-[7.5rem] shrink-0 items-center gap-2.5 rounded-xl border px-4",
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
          "ml-auto text-lg font-extrabold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
