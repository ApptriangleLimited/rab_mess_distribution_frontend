"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconFileReport,
  IconLayoutDashboard,
  IconSend,
  IconSettings,
  IconTags,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
import { useStore } from "@/hooks/use-store";
import { pendingPaperReportCount } from "@/lib/store/paper-reports";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import type { Icon } from "@tabler/icons-react";
import { useSession } from "@/hooks/use-session";

type Tab = {
  href: string;
  labelKey: MessageKey;
  icon: Icon;
  match: (path: string) => boolean;
};

const DASHBOARD_TAB: Tab = {
  href: "/admin",
  labelKey: "nav.adminDashboard",
  icon: IconLayoutDashboard,
  match: (path) => path === "/admin",
};

const REPORT_REQUESTS_TAB: Tab = {
  href: "/admin/report-requests",
  labelKey: "nav.reportRequests",
  icon: IconFileReport,
  match: (path) => path.startsWith("/admin/report-requests"),
};

const USERS_TAB: Tab = {
  href: "/admin/users",
  labelKey: "nav.adminUsers",
  icon: IconUserPlus,
  match: (path) => path.startsWith("/admin/users"),
};

const LEDGER_TAB: Tab = {
  href: "/ration/monthly",
  labelKey: "nav.consumeLedger",
  icon: IconTags,
  match: (path) =>
    path.startsWith("/ration/monthly") ||
    path.startsWith("/ration/report") ||
    path.startsWith("/consume/monthly/ledger"),
};

const RATION_REQUESTS_TAB: Tab = {
  href: "/ration/requests",
  labelKey: "nav.requests",
  icon: IconSend,
  match: (path) => path.startsWith("/ration/requests"),
};

const ADMIN_REQUESTS_TAB: Tab = {
  href: "/admin/requests",
  labelKey: "nav.requests",
  icon: IconSend,
  match: (path) => path.startsWith("/admin/requests"),
};

const MONTHLY_CONSUME_TAB: Tab = {
  href: "/consume/monthly",
  labelKey: "nav.monthlyConsume",
  icon: IconChartBar,
  match: (path) =>
    path === "/consume/monthly" ||
    path.startsWith("/consume/monthly/tag") ||
    path.startsWith("/consume/monthly/print"),
};

const SUMMARY_TAB: Tab = {
  href: "/consume/monthly/summary",
  labelKey: "nav.consumeSummary",
  icon: IconFileReport,
  match: (path) => path.startsWith("/consume/monthly/summary"),
};

const RATION_MEMBERS_TAB: Tab = {
  href: "/ration/members",
  labelKey: "nav.rationMembers",
  icon: IconUsers,
  match: (path) => path.startsWith("/ration/members"),
};

const ADMIN_MEMBERS_TAB: Tab = {
  href: "/admin/members",
  labelKey: "nav.rationMembers",
  icon: IconUsers,
  match: (path) =>
    path.startsWith("/admin/members") || path.startsWith("/cc/users"),
};

const BASE_TABS: Tab[] = [
  LEDGER_TAB,
  RATION_REQUESTS_TAB,
  MONTHLY_CONSUME_TAB,
  SUMMARY_TAB,
  RATION_MEMBERS_TAB,
];

const ADMIN_WORK_TABS: Tab[] = [
  LEDGER_TAB,
  ADMIN_REQUESTS_TAB,
  MONTHLY_CONSUME_TAB,
  SUMMARY_TAB,
  ADMIN_MEMBERS_TAB,
];

const SETTINGS_TAB: Tab = {
  href: "/settings",
  labelKey: "nav.settings",
  icon: IconSettings,
  match: (path) => path.startsWith("/settings"),
};

/** Ration strip. Admin auto-gets Dashboard. */
export function RationTabs({
  className,
  withDashboard,
  after,
}: {
  className?: string;
  /** Force dashboard tab; default = admin session. */
  withDashboard?: boolean;
  /** Extra controls after main tabs (Settings section tabs). */
  after?: ReactNode;
}) {
  const pathname = usePathname();
  const t = useT();
  const { session } = useSession();
  const rationBadge = useRequestMenuBadge("/ration/requests");
  const adminBadge = useRequestMenuBadge("/admin/requests");
  const store = useStore();
  const paperBadge = useMemo(
    () => pendingPaperReportCount(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.paper_report_requests],
  );
  const showDashboard = withDashboard ?? session?.role === "admin";
  const tabs = showDashboard
    ? [
        DASHBOARD_TAB,
        REPORT_REQUESTS_TAB,
        USERS_TAB,
        ...ADMIN_WORK_TABS,
        SETTINGS_TAB,
      ]
    : [...BASE_TABS, SETTINGS_TAB];

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={showDashboard ? t("nav.adminTabs") : t("nav.rationTabs")}
      layoutId="ration-role-tabs-pill"
      after={after}
      tabs={tabs.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
        badge:
          tab.href === "/admin/requests"
            ? adminBadge
            : tab.href === "/ration/requests"
              ? rationBadge
              : tab.href === "/admin/report-requests"
                ? paperBadge
                : undefined,
      }))}
    />
  );
}

export function AdminTabs({ className }: { className?: string }) {
  return <RationTabs className={className} withDashboard />;
}
