"use client";

import {
  Children,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { searchFilterFieldClass } from "@/components/shared/search-filter-bar";
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
  tagCellClass,
} from "@/components/daily/register-board";
import { useDailyCockpit } from "@/hooks/use-daily-cockpit";
import { useStore } from "@/hooks/use-store";
import { isApiEnabled } from "@/lib/api/mode";
import { DAILY_TAGS } from "@/lib/constants";
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
  listByMonth,
  setTag,
  setTagRange,
} from "@/lib/store/assignments";
import { listAllTags } from "@/lib/store/rates";
import { canAssignOnDate, isMfrLocked, MFR_TAG } from "@/lib/store/daily";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function defaultRange() {
  return monthDateBounds();
}

function orderTags(tags: DailyTag[]) {
  const priority = ["MS", "CD"] as const;
  const head = priority.filter((t) =>
    tags.some((x) => x.toUpperCase() === t),
  ) as DailyTag[];
  const headKeys = new Set(head.map((t) => t.toUpperCase()));
  const rest = tags.filter((t) => !headKeys.has(t.toUpperCase()));
  return [...head, ...rest];
}

export default function TagsPageClient() {
  const t = useT();
  const { locale } = useI18n();
  const apiOn = isApiEnabled();
  const state = useStore();
  const { ranks, wings } = state;
  const reduceMotion = useReducedMotion();
  const today = todayISO();
  const initial = defaultRange();

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [tagFilter, setTagFilter] = useState<DailyTag | "all">("all");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  /** Default: active members only. */
  const [memberStatus, setMemberStatus] = useState<"all" | "0" | "1">("1");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const cockpit = useDailyCockpit({
    dateFrom,
    dateTo,
    q,
    rank,
    wing,
    status: memberStatus,
  });

  const demoAllTags = useMemo(
    () => orderTags(listAllTags()),
    [state.rates],
  );
  const allTags = apiOn
    ? orderTags(DAILY_TAGS.map((tag) => tag.code))
    : demoAllTags;

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

  /** Demo only — API computes carry on read. Active members only. */
  useEffect(() => {
    if (apiOn) return;
    const ids = state.users
      .filter(
        (u) =>
          u.approval_status === "approved" &&
          u.status === "1" &&
          isCockpitMember(u),
      )
      .map((u) => u.id);
    if (!ids.length) return;
    autoApplyCarryForward(ids, today);
  }, [apiOn, today, state.users]);

  /** Approved roster — filter by Active / Inactive / All (default Active). */
  const demoUsers = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (!isCockpitMember(u)) return false;
        if (u.approval_status !== "approved") return false;
        if (memberStatus !== "all" && u.status !== memberStatus) return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.personal_id, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, q, rank, wing, memberStatus]);

  const users = apiOn ? cockpit.users : demoUsers;

  const assignmentMonths = useMemo(
    () => monthsCoveringRange(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const demoAssignments = useMemo(
    () => assignmentMonths.flatMap((m) => listByMonth(m)),
    [state.assignments, assignmentMonths],
  );
  const assignments = apiOn ? cockpit.assignments : demoAssignments;

  const demoPriorByUser = useMemo(() => {
    const map = new Map<string, DailyTag>();
    for (const u of users) {
      if (u.status === "1" && u.default_tag) map.set(u.id, u.default_tag);
    }
    return map;
  }, [users]);

  const priorByUser = apiOn ? cockpit.priorByUser : demoPriorByUser;

  const visibleDates = useMemo(
    () => eachISODate(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const { demoTagCounts, demoTagMemberIds } = useMemo(() => {
    const allowed = new Set(users.map((u) => u.id));
    const counts: Record<string, number> = {};
    const memberIds = new Map<string, Set<string>>();
    for (const tag of allTags) {
      counts[tag] = 0;
      memberIds.set(tag, new Set());
    }

    const byUserDate = new Map<string, DailyTag>();
    for (const a of state.assignments) {
      byUserDate.set(`${a.user_id}|${a.date}`, a.tag);
    }
    const suppressedSet = new Set(state.suppressed_carries ?? []);

    for (const user of users) {
      if (
        !allowed.has(user.id) ||
        user.approval_status !== "approved" ||
        user.status !== "1" ||
        !isCockpitMember(user)
      ) {
        continue;
      }
      const isMfr = isMfrLocked(user);
      const defaultTag = user.default_tag;

      for (const date of visibleDates) {
        if (!canAssignOnDate(user, date)) continue;

        let tag: DailyTag | undefined;
        if (isMfr) {
          tag = MFR_TAG;
        } else {
          const direct = byUserDate.get(`${user.id}|${date}`);
          if (direct) {
            tag = direct;
          } else if (!suppressedSet.has(`${user.id}|${date}`)) {
            tag = defaultTag;
          }
        }

        if (tag && counts[tag] !== undefined) {
          counts[tag] += 1;
          memberIds.get(tag)?.add(user.id);
        }
      }
    }

    return { demoTagCounts: counts, demoTagMemberIds: memberIds };
  }, [
    allTags,
    visibleDates,
    users,
    state.assignments,
    state.suppressed_carries,
  ]);

  const tagCounts = apiOn ? cockpit.tagCounts : demoTagCounts;

  const allTaggedCount = useMemo(
    () => allTags.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0),
    [allTags, tagCounts],
  );

  const apiTagMemberIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const tag of allTags) {
      const ids = new Set<string>();
      for (const date of visibleDates) {
        for (const user of cockpit.projectedTagMembers(tag, date)) {
          ids.add(user.id);
        }
      }
      map.set(tag, ids);
    }
    return map;
  }, [allTags, visibleDates, cockpit]);

  const tagMemberIds = apiOn ? apiTagMemberIds : demoTagMemberIds;

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
    if (memberStatus !== "all") params.set("status", memberStatus);
    return `/daily/tags/print?${params.toString()}`;
  }, [month, dateFrom, dateTo, q, rank, wing, memberStatus]);

  function onTagChange(userId: string, date: string, tag: DailyTag | "") {
    const user = users.find((u) => u.id === userId);
    if (user && !canAssignOnDate(user, date)) return;
    if (apiOn) void cockpit.onTagChange(userId, date, tag);
    else if (!tag) clearTag(userId, date);
    else setTag(userId, date, tag);
  }

  function onPaintRange(userId: string, dates: string[], tag: DailyTag | "") {
    const user = users.find((u) => u.id === userId);
    if (user && dates.every((d) => !canAssignOnDate(user, d))) return;
    if (apiOn) void cockpit.onPaintRange(userId, dates, tag);
    else setTagRange(userId, dates, tag);
  }

  const loading = apiOn && cockpit.loading;

  const fieldClass = searchFilterFieldClass;

  const printBtn =
    users.length > 0 && visibleDates.length > 0 ? (
      <Button
        asChild
        variant="cta"
        size="sm"
        className="h-9 shrink-0 rounded-xl px-3"
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
        className="h-9 shrink-0 rounded-xl px-3"
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
              actions={
                <div className="flex flex-nowrap items-center justify-end gap-1.5">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("cc.searchPlaceholder")}
                    className={cn(
                      fieldClass,
                      "h-9 w-32 shrink-0 rounded-xl sm:w-40",
                    )}
                    aria-label={t("common.search")}
                  />
                  <div className="w-[7.25rem] shrink-0">
                    <Select
                      value={memberStatus}
                      onValueChange={(v) =>
                        setMemberStatus(v as "all" | "0" | "1")
                      }
                    >
                      <SelectTrigger
                        className={cn(fieldClass, "h-9 w-full rounded-xl")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">
                          {t("cc.statusActive")}
                        </SelectItem>
                        <SelectItem value="0">
                          {t("cc.statusInactive")}
                        </SelectItem>
                        <SelectItem value="all">
                          {t("common.allStatus")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[6.5rem] shrink-0">
                    <Select value={rank} onValueChange={setRank}>
                      <SelectTrigger
                        className={cn(fieldClass, "h-9 w-full rounded-xl")}
                      >
                        <SelectValue placeholder={t("cc.selectRank")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("common.allRank")}
                        </SelectItem>
                        {ranks.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 shrink-0">
                    <Select value={wing} onValueChange={setWing}>
                      <SelectTrigger
                        className={cn(fieldClass, "h-9 w-full rounded-xl")}
                      >
                        <SelectValue placeholder={t("cc.selectWing")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("common.allWing")}
                        </SelectItem>
                        {wings.map((w) => (
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
                    triggerClassName="h-9 w-40 min-w-0 shrink-0 rounded-xl px-2 text-xs"
                  />
                  {printBtn}
                </div>
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 p-2.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
          <EqualTagRows>
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
          </EqualTagRows>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </p>
        ) : users.length === 0 ? (
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
            suppressedCarries={
              apiOn ? cockpit.suppressedCarries : (state.suppressed_carries ?? [])
            }
            boroKhanaDates={apiOn ? cockpit.boroKhanaDates : undefined}
            onBoroKhanaToggle={apiOn ? cockpit.onBoroKhanaToggle : undefined}
            projectedTagMembers={
              apiOn ? cockpit.projectedTagMembers : undefined
            }
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}
      </motion.div>
    </PagePane>
  );
}

/** Two even rows: first half on top, second half on bottom, same column count. */
function EqualTagRows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const cols = Math.max(1, Math.ceil(items.length / 2));
  const top = items.slice(0, cols);
  const bottom = items.slice(cols);
  const rowClass = "grid w-full min-w-0 gap-1.5";
  const rowStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className={rowClass} style={rowStyle}>
        {top}
      </div>
      {bottom.length > 0 ? (
        <div className={rowClass} style={rowStyle}>
          {bottom}
        </div>
      ) : null}
    </div>
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
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? selected : undefined}
      className={cn(
        "flex h-9 w-full min-w-0 items-center justify-center gap-1 rounded-xl px-2 transition",
        toneClass ??
          "border border-neutral-200/80 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        toneClass && "border border-transparent",
        interactive
          ? selected
            ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950"
            : "hover:brightness-[0.97] dark:hover:brightness-110"
          : "cursor-default disabled:opacity-100",
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
