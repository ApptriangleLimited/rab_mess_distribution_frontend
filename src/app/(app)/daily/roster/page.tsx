"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { IconClipboardList, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { IconTip } from "@/components/shared/icon-tip";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
import { UserFiltersBar } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { onCcDataChange } from "@/lib/api/cc-events";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { listMembers, memberToUser } from "@/lib/api/members";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  filterUsers,
  userFiltersToSearchParams,
  type UserFilters,
} from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";

const emptyFilters: UserFilters = {
  q: "",
  status: "all",
  approval: "all",
  member_type: "all",
  wing: "all",
  rank: "all",
  date_from: "",
  date_to: "",
};

export default function RosterPage() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const apiOn = isDailyApiEnabled();
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [loading, setLoading] = useState(apiOn);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => onCcDataChange(() => setReloadTick((n) => n + 1)), []);

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
      member_type: filters.member_type,
      wing: filters.wing,
      wing_family: filters.wing && filters.wing !== "all" ? "1" : undefined,
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

  const subtitleCount = apiOn ? apiTotal : demoUsers.length;
  const filterQuery = userFiltersToSearchParams(filters).toString();
  const printHref = `/daily/roster/print?${filterQuery}`;
  const listReportHref = `/daily/roster/list-report?${filterQuery}`;
  const canPrint = apiOn ? apiTotal > 0 : demoUsers.length > 0;

  function setFiltersAndResetPage(next: UserFilters) {
    setFilters(next);
    setPage(1);
  }

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
              title={t("pages.roster.title")}
              subtitle={
                loading
                  ? t("common.loading")
                  : t("pages.roster.subtitle", { count: subtitleCount })
              }
              center={<DailyTabs />}
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
                  {canPrint ? (
                    <IconTip label={t("cc.fullMemberListReportTitle")}>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <Link
                          href={listReportHref}
                          title={t("cc.fullMemberListReportTitle")}
                        >
                          <IconClipboardList className="h-3.5 w-3.5" />
                          {t("cc.fullMemberListReportTitle")}
                        </Link>
                      </Button>
                    </IconTip>
                  ) : (
                    <IconTip label={t("cc.fullMemberListReportTitle")}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled
                        title={t("cc.fullMemberListReportTitle")}
                      >
                        <IconClipboardList className="h-3.5 w-3.5" />
                        {t("cc.fullMemberListReportTitle")}
                      </Button>
                    </IconTip>
                  )}
                </div>
              }
            />
          </div>
        </div>

        <UserFiltersBar
          value={filters}
          onChange={setFiltersAndResetPage}
        />
        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </p>
        ) : (
          <UserTable
            users={users}
            showRequestAction={false}
            showAcceptActions
            detailHref={(id) => `/daily/users/${id}`}
            editHref={(id) => `/daily/users/${id}/edit`}
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
