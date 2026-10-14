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
import { isDailyApiEnabled } from "@/lib/api/mode";
import { MEMBER_TYPES } from "@/lib/constants";
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
import {
  applyDueJlInactivations,
  canAssignOnDate,
  canWriteMfrLockedTag,
  isMfrLocked,
} from "@/lib/store/daily";
import { countRegisterTags } from "@/lib/store/register-totals";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import type { DailyTag, MemberType, TrgTone, UserStatus } from "@/lib/types";
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
  const apiOn = isDailyApiEnabled();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const today = todayISO();
  const initial = defaultRange();

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [tagFilter, setTagFilter] = useState<DailyTag | "all">("all");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [memberType, setMemberType] = useState<MemberType | "all">("all");
  /** Default Active; toggle the right-side switch for Inactive. */
  const [memberStatus, setMemberStatus] = useState<UserStatus>("1");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const cockpit = useDailyCockpit({
    dateFrom,
    dateTo,
    q,
    rank,
    wing,
    memberType,
    status: memberStatus,
  });

  const allTags = useMemo(
    () => orderTags(listAllTags()),
    [state.rates],
  );

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
    applyDueJlInactivations(today);
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

  /** Approved roster — member type + Active / Inactive toggle (default Active). */
  const demoUsers = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (u.approval_status !== "approved") return false;
        if (!isCockpitMember(u)) return false;
        if (u.status !== memberStatus) return false;
        if (memberType !== "all" && u.member_type !== memberType) return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.personal_id, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, q, rank, wing, memberType, memberStatus]);

  const users = apiOn ? cockpit.users : demoUsers;

  const assignmentMonths = useMemo(
    () => monthsCoveringRange(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  const demoAssignments = useMemo(
    () => assignmentMonths.flatMap((m) => listByMonth(m)),
    [state.assignments, assignmentMonths],
  );
  const assignments = apiOn ? cockpit.displayAssignments : demoAssignments;

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

  const suppressedCarries = apiOn
    ? cockpit.suppressedCarries
    : (state.suppressed_carries ?? []);

  const { memberIds: tagMemberIds } = useMemo(
    () =>
      countRegisterTags(
        users,
        visibleDates,
        assignments,
        suppressedCarries,
        today,
      ),
    [users, visibleDates, assignments, suppressedCarries, today],
  );

  const tagMemberCounts = useMemo(
    () =>
      Object.fromEntries(
        allTags.map((tag) => [tag, tagMemberIds.get(tag)?.size ?? 0]),
      ) as Record<string, number>,
    [allTags, tagMemberIds],
  );
  const allTagMemberCount = useMemo(
    () =>
      allTags.reduce((sum, tag) => sum + (tagMemberCounts[tag] ?? 0), 0),
    [allTags, tagMemberCounts],
  );

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
    if (memberType !== "all") params.set("member_type", memberType);
    params.set("status", memberStatus);
    return `/daily/tags/print?${params.toString()}`;
  }, [month, dateFrom, dateTo, q, rank, wing, memberType, memberStatus]);

  function onTagChange(
    userId: string,
    date: string,
    tag: DailyTag | "",
    trgTone?: TrgTone,
  ) {
    const user = users.find((u) => u.id === userId);
    if (user && !canAssignOnDate(user, date)) return;
    if (user && isMfrLocked(user) && tag && !canWriteMfrLockedTag(tag)) return;
    if (user && isMfrLocked(user) && !tag) return;
    if (apiOn) void cockpit.onTagChange(userId, date, tag, trgTone);
    else if (!tag) clearTag(userId, date);
    else setTag(userId, date, tag, "daily", trgTone ? { trg_tone: trgTone } : undefined);
  }

  function onPaintRange(
    userId: string,
    dates: string[],
    tag: DailyTag | "",
    trgTone?: TrgTone,
  ) {
    const user = users.find((u) => u.id === userId);
    if (user && dates.every((d) => !canAssignOnDate(user, d))) return;
    if (user && isMfrLocked(user) && tag && !canWriteMfrLockedTag(tag)) return;
    if (user && isMfrLocked(user) && !tag) return;
    if (apiOn) void cockpit.onPaintRange(userId, dates, tag, trgTone);
    else setTagRange(userId, dates, tag, "daily", trgTone ? { trg_tone: trgTone } : undefined);
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
        <Link href={printHref}>
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
                  <div className="w-[5.75rem] shrink-0">
                    <Select
                      value={memberType}
                      onValueChange={(v) =>
                        setMemberType(v as MemberType | "all")
                      }
                    >
                      <SelectTrigger
                        className={cn(fieldClass, "h-9 w-full rounded-xl")}
                        aria-label={t("cc.fields.memberType")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-[14rem]">
                        <SelectItem value="all" className="whitespace-nowrap">
                          {t("common.allMemberType")}
                        </SelectItem>
                        {MEMBER_TYPES.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            className="whitespace-nowrap"
                          >
                            {t(item.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SettingsRankFilter
                    value={rank}
                    onChange={setRank}
                    className="w-[7.25rem] shrink-0"
                    triggerClassName={cn(fieldClass, "h-9 w-full rounded-xl")}
                  />
                  <SettingsWingFilter
                    value={wing}
                    onChange={setWing}
                    rootsOnly
                    className="w-[7.25rem] shrink-0"
                    triggerClassName={cn(fieldClass, "h-9 w-full rounded-xl")}
                  />
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
              value={String(allTagMemberCount)}
              toneClass="border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100"
              selected={tagFilter === "all"}
              onClick={() => setTagFilter("all")}
            />
            {allTags.map((tag) => (
              <MiniStat
                key={tag}
                icon={tagTileIcon(tag)}
                label={tag}
                value={String(tagMemberCounts[tag] ?? 0)}
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
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <ActiveInactiveToggle
                value={memberStatus}
                onChange={setMemberStatus}
              />
            </div>
            <EmptyState title={t("daily.emptyTags")} />
          </div>
        ) : visibleDates.length === 0 || boardUsers.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <ActiveInactiveToggle
                value={memberStatus}
                onChange={setMemberStatus}
              />
            </div>
            <EmptyState title={t("common.noResults")} />
          </div>
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
            suppressedCarries={suppressedCarries}
            boroKhanaDates={apiOn ? cockpit.boroKhanaDates : undefined}
            onBoroKhanaToggle={apiOn ? cockpit.onBoroKhanaToggle : undefined}
            projectedTagMembers={
              apiOn ? cockpit.projectedTagMembers : undefined
            }
            dateFrom={dateFrom}
            dateTo={dateTo}
            toolbarEnd={
              <ActiveInactiveToggle
                value={memberStatus}
                onChange={setMemberStatus}
              />
            }
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

function ActiveInactiveToggle({
  value,
  onChange,
}: {
  value: UserStatus;
  onChange: (next: UserStatus) => void;
}) {
  const t = useT();
  const active = value === "1";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? t("cc.statusActive") : t("cc.statusInactive")}
      onClick={() => onChange(active ? "0" : "1")}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 dark:border-neutral-600 dark:bg-neutral-900"
    >
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-neutral-400" : "text-neutral-700 dark:text-neutral-200",
        )}
      >
        {t("cc.statusInactive")}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          active ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
            active ? "left-4" : "left-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-primary" : "text-neutral-400",
        )}
      >
        {t("cc.statusActive")}
      </span>
    </button>
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
