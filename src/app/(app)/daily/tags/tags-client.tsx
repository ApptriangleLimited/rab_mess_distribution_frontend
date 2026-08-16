"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconPrinter,
  IconShield,
  IconSoup,
  IconTags,
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
  tagCellClass,
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
import { listAllTags } from "@/lib/store/rates";
import { compareUsers } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

export default function TagsPageClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const today = todayISO();
  const initial = defaultRange();
  /** MS + CD first in tiles, then remaining tags. */
  const allTags = useMemo(() => {
    const tags = listAllTags();
    const priority = ["MS", "CD"] as const;
    const head = priority.filter((t) =>
      tags.some((x) => x.toUpperCase() === t),
    ) as DailyTag[];
    const headKeys = new Set(head.map((t) => t.toUpperCase()));
    const rest = tags.filter((t) => !headKeys.has(t.toUpperCase()));
    return [...head, ...rest];
  }, [state.rates]);

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [tagFilter, setTagFilter] = useState<DailyTag | "all">("all");
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
        return [u.name, u.personal_id, u.rab_id, u.wing, u.rank]
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

  /** Person-days per tag across selected date range (filtered users). */
  const tagCounts = useMemo(() => {
    const allowed = new Set(users.map((u) => u.id));
    const counts: Record<string, number> = {};
    for (const tag of allTags) counts[tag] = 0;

    for (const date of visibleDates) {
      for (const tag of allTags) {
        counts[tag] += getProjectedTagMembers(tag, date).members.filter((u) =>
          allowed.has(u.id),
        ).length;
      }
    }
    return counts;
  }, [
    allTags,
    visibleDates,
    users,
    state.assignments,
    state.users,
    state.suppressed_carries,
    state.rates,
  ]);

  const allTaggedCount = useMemo(
    () => allTags.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0),
    [allTags, tagCounts],
  );

  /** User ids that hold each tag at least once in the date range. */
  const tagMemberIds = useMemo(() => {
    const allowed = new Set(users.map((u) => u.id));
    const map = new Map<string, Set<string>>();
    for (const tag of allTags) {
      const ids = new Set<string>();
      for (const date of visibleDates) {
        for (const u of getProjectedTagMembers(tag, date).members) {
          if (allowed.has(u.id)) ids.add(u.id);
        }
      }
      map.set(tag, ids);
    }
    return map;
  }, [
    allTags,
    visibleDates,
    users,
    state.assignments,
    state.users,
    state.suppressed_carries,
  ]);

  const boardUsers = useMemo(() => {
    if (tagFilter === "all") return users;
    const ids = tagMemberIds.get(tagFilter);
    if (!ids) return [];
    return users.filter((u) => ids.has(u.id));
  }, [users, tagFilter, tagMemberIds]);

  const priorByUserFiltered = useMemo(() => {
    const map = new Map<string, DailyTag>();
    for (const u of boardUsers) {
      const prior = priorByUser.get(u.id);
      if (prior) map.set(u.id, prior);
    }
    return map;
  }, [boardUsers, priorByUser]);

  function selectTagFilter(next: DailyTag | "all") {
    setTagFilter((cur) => (cur === next ? "all" : next));
  }

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
    rank !== "all" ||
    wing !== "all" ||
    !datesAreDefault ||
    tagFilter !== "all";

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
              title={t("pages.dailyTags.title")}
              subtitle={t("pages.dailyTags.subtitle", { month })}
              center={<DailyTabs />}
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
          wrapTiles={false}
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={
            <>
              <MiniStat
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatAll")}
                value={String(allTaggedCount)}
                toneClass="border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100"
                selected={tagFilter === "all"}
                onClick={() => setTagFilter("all")}
              />
              {allTags.map((tag) => (
                <MiniStat
                  key={tag}
                  icon={tagTileIcon(tag)}
                  label={tag}
                  value={String(tagCounts[tag] ?? 0)}
                  title={`${tag} — ${tagLabel(tag, locale)}`}
                  toneClass={tagCellClass(tag)}
                  selected={tagFilter === tag}
                  onClick={() => selectTagFilter(tag)}
                />
              ))}
            </>
          }
        >
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
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => applyDateRange(from, to)}
            label={t("common.dateRange")}
            triggerClassName="min-w-[10rem] w-[10rem] px-2 text-xs"
          />
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
        ) : visibleDates.length === 0 || boardUsers.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <RegisterBoard
            users={boardUsers}
            month={month}
            dayCount={dayCount}
            assignments={assignments}
            todayISO={today}
            paintTag={paintTag}
            onPaintTagChange={setPaintTag}
            onTagChange={onTagChange}
            onPaintRange={onPaintRange}
            priorByUser={priorByUserFiltered}
            suppressedCarries={state.suppressed_carries ?? []}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}
      </motion.div>
    </PagePane>
  );
}

function tagTileIcon(tag: DailyTag) {
  if (tag === "MS") return <IconSoup className="h-3.5 w-3.5" />;
  if (tag === "CD") return <IconShield className="h-3.5 w-3.5" />;
  return <IconTags className="h-3.5 w-3.5" />;
}

function MiniStat({
  icon,
  label,
  value,
  toneClass,
  selected,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  toneClass?: string;
  selected?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
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
