"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  IconCircleCheck,
  IconClockHour4,
  IconPlus,
  IconUsers,
  IconUserCheck,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { UserFiltersBar } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { useStore } from "@/hooks/use-store";
import { filterUsers, type UserFilters } from "@/lib/store/users";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export default function CcUsersPage() {
  const t = useT();
  const state = useStore();
  const [filters, setFilters] = useState<UserFilters>({
    q: "",
    status: "all",
    approval: "all",
    wing: "all",
    rank: "all",
    date_from: "",
    date_to: "",
  });

  const users = useMemo(
    () => filterUsers(state.users, filters),
    [state.users, filters],
  );

  const rosterStats = useMemo(() => {
    const all = state.users;
    return {
      total: all.length,
      active: all.filter((u) => u.status === "1").length,
      pending: all.filter((u) => u.approval_status === "pending").length,
      accepted: all.filter((u) => u.approval_status === "approved").length,
    };
  }, [state.users]);

  function toggleStatus(status: "1" | "all") {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === status ? "all" : status,
    }));
  }

  function toggleApproval(approval: "pending" | "approved" | "all") {
    setFilters((prev) => ({
      ...prev,
      approval: prev.approval === approval ? "all" : approval,
    }));
  }

  const tiles = (
    <>
      <StatChip
        label={t("consume.statMembers")}
        value={rosterStats.total}
        icon={<IconUsers className="h-3.5 w-3.5" />}
        tone="teal"
        active={
          filters.status === "all" &&
          filters.approval === "all" &&
          !filters.q
        }
        onClick={() =>
          setFilters({
            q: "",
            status: "all",
            approval: "all",
            wing: "all",
            rank: "all",
            date_from: "",
            date_to: "",
          })
        }
      />
      <StatChip
        label={t("cc.statusActive")}
        value={rosterStats.active}
        icon={<IconUserCheck className="h-3.5 w-3.5" />}
        tone="emerald"
        active={filters.status === "1"}
        onClick={() => toggleStatus("1")}
      />
      <StatChip
        label={t("cc.approvalPending")}
        value={rosterStats.pending}
        icon={<IconClockHour4 className="h-3.5 w-3.5" />}
        tone="amber"
        active={filters.approval === "pending"}
        onClick={() => toggleApproval("pending")}
      />
      <StatChip
        label={t("cc.approvalApproved")}
        value={rosterStats.accepted}
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
              subtitle={t("pages.ccUsers.subtitle", { count: users.length })}
              actions={
                <Button
                  asChild
                  variant="cta"
                  size="sm"
                  className="rounded-xl shadow-sm shadow-primary/20"
                >
                  <Link href="/cc/users/new">
                    <IconPlus className="h-3.5 w-3.5" />
                    {t("cc.newUser")}
                  </Link>
                </Button>
              }
            />
          </div>
        </div>

        <UserFiltersBar
          value={filters}
          onChange={setFilters}
          tiles={tiles}
          wrapTiles={false}
        />
        <UserTable users={users} />
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
  value: number;
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
