"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconEye,
  IconUserOff,
  IconUsers,
  IconUserCheck,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { RosterRow } from "@/components/daily/status-toggle";
import { RationTabs } from "@/components/layout/ration-tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { useStore } from "@/hooks/use-store";
import { isCcApiEnabled } from "@/lib/api/mode";
import { listMembers, memberToUser } from "@/lib/api/members";
import { compareUsersNewestFirst } from "@/lib/store/users";

import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

function hasBank(user: User) {
  return Boolean(
    (user.account_number ?? "").trim() || (user.bank_name ?? "").trim(),
  );
}

export default function RationMembersPage() {
  const t = useT();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [status, setStatus] = useState("all");
  const [viewUser, setViewUser] = useState<User | null>(null);

  const [apiUsers, setApiUsers] = useState<User[] | null>(null);

  useEffect(() => {
    if (!isCcApiEnabled()) {
      setApiUsers(null);
      return;
    }
    let cancelled = false;
    listMembers({ approval: "approved", page: 1, page_size: 500 })
      .then((res) => {
        if (!cancelled) setApiUsers(res.items.map(memberToUser));
      })
      .catch(() => {
        if (!cancelled) setApiUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const approved = useMemo(
    () =>
      (isCcApiEnabled() ? (apiUsers ?? []) : state.users).filter(
        (u) => u.approval_status === "approved",
      ),
    [apiUsers, state.users],
  );

  const activeCount = useMemo(
    () => approved.filter((u) => u.status === "1").length,
    [approved],
  );

  const inactiveCount = useMemo(
    () => approved.filter((u) => u.status === "0").length,
    [approved],
  );

  const roster = useMemo(() => {
    const query = q.trim().toLowerCase();
    return approved
      .filter((u) => {
        if (status !== "all" && u.status !== status) return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.rank, u.wing, u.account_number, u.bank_name]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsersNewestFirst);
  }, [approved, q, rank, wing, status]);

  const liveViewUser = viewUser
    ? (state.users.find((u) => u.id === viewUser.id) ?? viewUser)
    : null;

  const resetKey = useMemo(
    () => `${q}|${rank}|${wing}|${status}|${roster.map((u) => u.id).join(",")}`,
    [q, rank, wing, status, roster],
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
  } = usePagination(roster, resetKey);

  const fieldClass = searchFilterFieldClass;

  function toggleStatus(next: "1" | "0" | "all") {
    setStatus((prev) => (prev === next ? "all" : next));
  }

  function clearAll() {
    setQ("");
    setRank("all");
    setWing("all");
    setStatus("all");
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
              title={t("pages.rationMembers.title")}
              subtitle={t("pages.rationMembers.subtitle", {
                count: roster.length,
              })}
              center={<RationTabs />}
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={
            <>
              <StatChip
                label={t("daily.rosterStatAll")}
                value={approved.length}
                icon={<IconUsers className="h-3.5 w-3.5" />}
                tone="teal"
                active={status === "all" && !q.trim()}
                onClick={clearAll}
              />
              <StatChip
                label={t("daily.rosterStatActive")}
                value={activeCount}
                icon={<IconUserCheck className="h-3.5 w-3.5" />}
                tone="emerald"
                active={status === "1"}
                onClick={() => toggleStatus("1")}
              />
              <StatChip
                label={t("daily.rosterStatInactive")}
                value={inactiveCount}
                icon={<IconUserOff className="h-3.5 w-3.5" />}
                tone="amber"
                active={status === "0"}
                onClick={() => toggleStatus("0")}
              />
            </>
          }
        >
          <SettingsRankFilter
            value={rank}
            onChange={setRank}
            className="w-[9.5rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <SettingsWingFilter
            value={wing}
            onChange={setWing}
            className="w-[9rem] shrink-0"
            triggerClassName={cn(fieldClass, "w-full")}
          />
          <div className="w-[9.5rem] shrink-0">
            <Select value={status} onValueChange={setStatus}>
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
        </SearchFilterBar>

        {approved.length === 0 ? (
          <EmptyState title={t("daily.emptyRoster")} />
        ) : roster.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
              <IconUsers className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("daily.rosterBoard")}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
                {roster.length}/{approved.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="w-12 px-3 py-3">{t("cc.fields.sl")}</th>
                    <th className="px-4 py-3">{t("cc.fields.personalId")}</th>
                    <th className="px-4 py-3">{t("cc.fields.rabId")}</th>
                    <th className="px-4 py-3">{t("cc.fields.rank")}</th>
                    <th className="px-4 py-3">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3">{t("cc.fields.wing")}</th>
                    <th className="px-4 py-3">{t("cc.fields.joiningDate")}</th>
                    <th className="px-4 py-3">{t("cc.fields.outDate")}</th>
                    <th className="px-4 py-3">{t("cc.fields.status")}</th>
                    <th className="px-4 py-3 text-right">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((user, index) => (
                    <RosterRow
                      key={user.id}
                      user={user}
                      sl={from + index}
                      showDates
                      actions={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl px-2.5"
                          onClick={() => setViewUser(user)}
                        >
                          <IconEye className="h-3.5 w-3.5" />
                          {t("common.view")}
                        </Button>
                      }
                    />
                  ))}
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
            />
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={!!liveViewUser}
        tone="default"
        title={t("ration.viewMember")}
        body={t("ration.viewMemberHint")}
        confirmLabel={t("common.done")}
        panelClassName="max-w-[33.6rem]"
        onCancel={() => setViewUser(null)}
        onConfirm={() => setViewUser(null)}
      >
        {liveViewUser ? (
          <div className="space-y-4">
            <UserConfirmCard user={liveViewUser} />
            <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/30 p-3.5 dark:border-neutral-700 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
              <p className="mb-2.5 text-sm font-semibold text-neutral-900 dark:text-white">
                {t("ration.editMemberBank")}
              </p>
              {hasBank(liveViewUser) ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["bank_name", t("cc.fields.bankName")],
                      ["account_name", t("cc.fields.accountName")],
                      ["account_number", t("cc.fields.accountNumber")],
                      ["routing", t("cc.fields.routing")],
                      ["branch", t("cc.fields.branch")],
                      ["branch_location", t("cc.fields.branchLocation")],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {label}
                      </dt>
                      <dd className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {liveViewUser[key] || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-neutral-500">{t("ration.noBankYet")}</p>
              )}
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </PagePane>
  );
}

function StatChip({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "teal" | "emerald" | "amber";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    teal: "border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100",
    emerald:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 shadow-sm transition",
        tones,
        active
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
