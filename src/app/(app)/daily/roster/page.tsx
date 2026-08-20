"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCircleCheck,
  IconClockHour4,
  IconPlus,
  IconUserOff,
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
import { ApprovalRow } from "@/components/daily/approval-card";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RosterRow } from "@/components/daily/status-toggle";
import { MemberDateFilter } from "@/components/users/user-filters";
import { usePagination } from "@/hooks/use-pagination";
import { useStore } from "@/hooks/use-store";
import { getAssignment } from "@/lib/store/assignments";
import {
  compareUsers,
  matchesMemberDateFilter,
} from "@/lib/store/users";
import { listAllTags } from "@/lib/store/rates";
import { RANKS, WINGS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

type RosterView = "all" | "pending" | "active" | "inactive";

export default function RosterPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const state = useStore();
  const tags = listAllTags();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [tag, setTagFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<RosterView>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const today = todayISO();

  const approved = useMemo(
    () => state.users.filter((u) => u.approval_status === "approved"),
    [state.users],
  );

  const pendingAll = useMemo(
    () => state.users.filter((u) => u.approval_status === "pending"),
    [state.users],
  );

  const activeCount = useMemo(
    () => approved.filter((u) => u.status === "1").length,
    [approved],
  );

  const inactiveCount = useMemo(
    () => approved.filter((u) => u.status === "0").length,
    [approved],
  );

  const allCount = pendingAll.length + approved.length;

  const effectiveStatus =
    view === "active" ? "1" : view === "inactive" ? "0" : status;

  const pending = useMemo(() => {
    if (view === "active" || view === "inactive") return [];
    if (view !== "pending" && (effectiveStatus !== "all" || tag !== "all")) {
      return [];
    }
    const query = q.trim().toLowerCase();
    return pendingAll
      .filter((u) => {
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!matchesMemberDateFilter(u, dateFrom, dateTo)) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank, u.phone]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [
    pendingAll,
    q,
    rank,
    wing,
    effectiveStatus,
    tag,
    dateFrom,
    dateTo,
    view,
  ]);

  const roster = useMemo(() => {
    if (view === "pending") return [];
    const query = q.trim().toLowerCase();
    return approved
      .filter((u) => {
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (effectiveStatus !== "all" && u.status !== effectiveStatus) {
          return false;
        }
        if (!matchesMemberDateFilter(u, dateFrom, dateTo)) return false;
        if (tag !== "all") {
          const todayTag = getAssignment(u.id, today)?.tag ?? null;
          if (tag === "none") {
            if (todayTag) return false;
          } else if (todayTag !== tag) {
            return false;
          }
        }
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank, u.phone]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [
    approved,
    q,
    rank,
    wing,
    tag,
    effectiveStatus,
    today,
    state.assignments,
    dateFrom,
    dateTo,
    view,
  ]);

  const boardEmpty = pending.length === 0 && roster.length === 0;
  const showing = pending.length + roster.length;

  type BoardRow =
    | { kind: "pending"; user: User }
    | { kind: "roster"; user: User };

  const boardRows = useMemo<BoardRow[]>(
    () => [
      ...pending.map((user) => ({ kind: "pending" as const, user })),
      ...roster.map((user) => ({ kind: "roster" as const, user })),
    ],
    [pending, roster],
  );

  const resetKey = useMemo(
    () => boardRows.map((r) => `${r.kind}:${r.user.id}`).join("|"),
    [boardRows],
  );
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    pageItems,
    total,
    from,
    to,
  } = usePagination(boardRows, resetKey);

  const fieldClass = searchFilterFieldClass;
  const filtersActive =
    rank !== "all" ||
    wing !== "all" ||
    tag !== "all" ||
    status !== "all" ||
    view !== "all" ||
    Boolean(dateFrom.trim()) ||
    Boolean(dateTo.trim());

  function selectView(next: RosterView) {
    setView((cur) => (cur === next ? "all" : next));
    if (next === "active" || next === "inactive" || next === "pending") {
      setStatus("all");
    }
  }

  return (
    <PagePane className="gap-5">
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
              title={t("pages.roster.title")}
              subtitle={t("pages.roster.subtitle", { count: showing })}
              center={<DailyTabs />}
              actions={
                <Button
                  asChild
                  variant="cta"
                  size="sm"
                  className="h-9 shrink-0 rounded-xl px-3 shadow-sm shadow-primary/20"
                >
                  <Link href="/daily/users/new">
                    <IconPlus className="h-3.5 w-3.5" />
                    {t("cc.newUser")}
                  </Link>
                </Button>
              }
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          filtersActive={filtersActive}
          wrapTiles={false}
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={
            <>
              <StatChip
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatAll")}
                value={String(allCount)}
                tone="teal"
                selected={view === "all"}
                onClick={() => setView("all")}
              />
              <StatChip
                icon={<IconClockHour4 className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatPending")}
                value={String(pendingAll.length)}
                tone="amber"
                selected={view === "pending"}
                onClick={() => selectView("pending")}
              />
              <StatChip
                icon={<IconCircleCheck className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatActive")}
                value={String(activeCount)}
                tone="emerald"
                selected={view === "active"}
                onClick={() => selectView("active")}
              />
              <StatChip
                icon={<IconUserOff className="h-3.5 w-3.5" />}
                label={t("daily.rosterStatInactive")}
                value={String(inactiveCount)}
                tone="neutral"
                selected={view === "inactive"}
                onClick={() => selectView("inactive")}
              />
            </>
          }
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
          <div className="w-[10rem] shrink-0">
            <Select value={tag} onValueChange={setTagFilter}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allTag")}</SelectItem>
                <SelectItem value="none">{t("daily.noTag")}</SelectItem>
                {tags.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} — {tagLabel(code, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[9.5rem] shrink-0">
            <Select
              value={view === "active" || view === "inactive" ? "all" : status}
              onValueChange={(v) => {
                setView("all");
                setStatus(v);
              }}
            >
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatus")}</SelectItem>
                <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
                <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MemberDateFilter
            from={dateFrom}
            to={dateTo}
            onFrom={setDateFrom}
            onTo={setDateTo}
          />
          <ClearFiltersButton
            disabled={!filtersActive && !q.trim()}
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              setTagFilter("all");
              setStatus("all");
              setView("all");
              setDateFrom("");
              setDateTo("");
            }}
          />
        </SearchFilterBar>

        {boardEmpty ? (
          <EmptyState
            title={t("daily.emptyRoster")}
            description={t("daily.rosterEmptyHint")}
            action={
              <Button asChild variant="cta" size="sm" className="rounded-xl">
                <Link href="/daily/users/new">
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("cc.newUser")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(6,121,87,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-none">
            <div className="flex items-center gap-2 border-b border-neutral-100 bg-gradient-to-r from-primary/[0.06] via-sky-50/50 to-transparent px-4 py-2.5 dark:border-neutral-800 dark:from-primary/10 dark:via-neutral-900 dark:to-neutral-900">
              <IconUsers className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {t("daily.rosterBoard")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gradient-to-r from-primary/[0.07] via-sky-50/70 to-teal-50/50 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600 dark:from-primary/15 dark:via-neutral-900 dark:to-neutral-900 dark:text-neutral-400">
                  <tr>
                    <th className="px-4 py-3.5">{t("cc.fields.rabId")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.rank")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.wing")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.joiningDate")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.outDate")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) =>
                    row.kind === "pending" ? (
                      <ApprovalRow key={row.user.id} user={row.user} />
                    ) : (
                      <RosterRow
                        key={row.user.id}
                        user={row.user}
                        showDates
                        onOpen={() =>
                          router.push(`/daily/users/${row.user.id}`)
                        }
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={page}
              totalPages={totalPages}
              total={total}
              from={from}
              to={to}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              className="bg-gradient-to-r from-neutral-50/80 to-teal-50/30 dark:from-neutral-900 dark:to-neutral-900"
            />
          </div>
        )}
      </motion.div>
    </PagePane>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "teal" | "amber" | "emerald" | "neutral";
  selected?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    teal: "border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100",
    amber:
      "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    neutral:
      "border-neutral-200/90 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 shadow-sm transition",
        tones,
        selected
          ? "border-black ring-1 ring-black brightness-95 dark:border-white dark:ring-white dark:brightness-110"
          : "hover:brightness-[0.97] dark:hover:brightness-110",
      )}
    >
      <span className="shrink-0 opacity-90" aria-hidden>
        {icon}
      </span>
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-xs font-extrabold tabular-nums dark:bg-white/10">
        {value}
      </span>
    </button>
  );
}
