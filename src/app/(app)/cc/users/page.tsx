"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  IconCircleCheck,
  IconClockHour4,
  IconPlus,
  IconPrinter,
  IconUsers,
  IconUserCheck,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { IconTip } from "@/components/shared/icon-tip";
import { CcTabs } from "@/components/layout/cc-tabs";
import { Button } from "@/components/ui/button";
import { UserFiltersBar } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { onCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { listMembers, memberToUser } from "@/lib/api/members";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  filterUsers,
  userFiltersToSearchParams,
  type UserFilters,
} from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const emptyFilters: UserFilters = {
  q: "",
  status: "all",
  approval: "all",
  wing: "all",
  rank: "all",
  date_from: "",
  date_to: "",
};

export default function CcUsersPage() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const apiOn = isCcApiEnabled();
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [loading, setLoading] = useState(apiOn);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => onCcDataChange(() => setReloadTick((n) => n + 1)), []);

  // One list call — BE pages by page_size from FE (default 25).
  useEffect(() => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listMembers({
      q: filters.q || undefined,
      status: filters.status,
      approval: filters.approval,
      wing: filters.wing,
      rank: filters.rank,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      page,
      page_size: pageSize,
    })
      .then((data) => {
        if (cancelled) return;
        setApiUsers(data.items.map(memberToUser));
        setApiTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setApiUsers([]);
        setApiTotal(0);
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load members from API.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, filters, page, pageSize, reloadTick, toast]);

  const demoUsers = useMemo(
    () => filterUsers(state.users, filters),
    [state.users, filters],
  );

  const users = apiOn ? apiUsers : demoUsers;

  const demoStats = useMemo(() => {
    const all = state.users;
    return {
      total: all.length,
      active: all.filter((u) => u.status === "1").length,
      pending: all.filter((u) => u.approval_status === "pending").length,
      accepted: all.filter((u) => u.approval_status === "approved").length,
    };
  }, [state.users]);

  // API: only filtered `total` from list res. No extra page_size=1 spam.
  // Demo: local counts for each chip.
  const stats = apiOn
    ? {
        total:
          filters.status === "all" && filters.approval === "all"
            ? apiTotal
            : undefined,
        active: filters.status === "1" ? apiTotal : undefined,
        pending: filters.approval === "pending" ? apiTotal : undefined,
        accepted: filters.approval === "approved" ? apiTotal : undefined,
      }
    : demoStats;
  const subtitleCount = apiOn ? apiTotal : demoUsers.length;
  const printHref = `/cc/users/print?${userFiltersToSearchParams(filters).toString()}`;
  const canPrint = apiOn ? apiTotal > 0 : demoUsers.length > 0;

  function setFiltersAndResetPage(next: UserFilters) {
    setFilters(next);
    setPage(1);
  }

  function toggleStatus(status: "1" | "all") {
    setFiltersAndResetPage({
      ...filters,
      status: filters.status === status ? "all" : status,
    });
  }

  function toggleApproval(approval: "pending" | "approved" | "all") {
    setFiltersAndResetPage({
      ...filters,
      approval: filters.approval === approval ? "all" : approval,
    });
  }

  const tiles = (
    <>
      <StatChip
        label={t("consume.statMembers")}
        value={stats.total}
        icon={<IconUsers className="h-3.5 w-3.5" />}
        tone="teal"
        active={
          filters.status === "all" &&
          filters.approval === "all" &&
          !filters.q
        }
        onClick={() => setFiltersAndResetPage(emptyFilters)}
      />
      <StatChip
        label={t("cc.statusActive")}
        value={stats.active}
        icon={<IconUserCheck className="h-3.5 w-3.5" />}
        tone="emerald"
        active={filters.status === "1"}
        onClick={() => toggleStatus("1")}
      />
      <StatChip
        label={t("cc.approvalPending")}
        value={stats.pending}
        icon={<IconClockHour4 className="h-3.5 w-3.5" />}
        tone="amber"
        active={filters.approval === "pending"}
        onClick={() => toggleApproval("pending")}
      />
      <StatChip
        label={t("cc.approvalApproved")}
        value={stats.accepted}
        icon={<IconCircleCheck className="h-3.5 w-3.5" />}
        tone="sky"
        active={filters.approval === "approved"}
        onClick={() => toggleApproval("approved")}
      />
    </>
  );

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
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
              title={t("pages.ccUsers.title")}
              subtitle={
                loading
                  ? t("common.loading")
                  : t("pages.ccUsers.subtitle", { count: subtitleCount })
              }
              center={<CcTabs />}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {canPrint ? (
                    <IconTip label={t("mess.print")}>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <Link href={printHref} title={t("mess.print")}>
                          <IconPrinter className="h-3.5 w-3.5" />
                          {t("mess.print")}
                        </Link>
                      </Button>
                    </IconTip>
                  ) : (
                    <IconTip label={t("mess.print")}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled
                        title={t("mess.print")}
                      >
                        <IconPrinter className="h-3.5 w-3.5" />
                        {t("mess.print")}
                      </Button>
                    </IconTip>
                  )}
                  <IconTip label={t("cc.newUser")}>
                    <Button
                      asChild
                      variant="cta"
                      size="sm"
                      className="rounded-xl shadow-sm shadow-primary/20"
                    >
                      <Link href="/cc/users/new" title={t("cc.newUser")}>
                        <IconPlus className="h-3.5 w-3.5" />
                        {t("cc.newUser")}
                      </Link>
                    </Button>
                  </IconTip>
                </div>
              }
            />
          </div>
        </div>

        <UserFiltersBar
          value={filters}
          onChange={setFiltersAndResetPage}
          tiles={tiles}
        />
        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </p>
        ) : (
          <UserTable
            users={users}
            onEmptyCreateHref="/cc/users/new"
            pagination={
              apiOn
                ? {
                    page,
                    pageSize,
                    total: apiTotal,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        )}
      </motion.div>
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
  value?: number;
  icon: ReactNode;
  tone: "teal" | "emerald" | "amber" | "sky";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    teal: "border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100",
    emerald:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
    sky: "border-sky-200/90 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 shadow-sm transition",
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
      {value != null ? (
        <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-xs font-extrabold tabular-nums dark:bg-white/10">
          {value}
        </span>
      ) : null}
    </button>
  );
}
