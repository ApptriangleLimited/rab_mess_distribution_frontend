"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  IconCalendarEvent,
  IconChartBar,
  IconClipboardList,
  IconFileReport,
  IconLayoutDashboard,
  IconSend,
  IconSettings,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
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

const STATE_REPORTS_TAB: Tab = {
  href: "/admin/state-reports",
  labelKey: "nav.stateReports",
  icon: IconClipboardList,
  match: (path) => path.startsWith("/admin/state-reports"),
};

const BASE_TABS: Tab[] = [
  {
    href: "/ration/monthly",
    labelKey: "nav.rationDashboard",
    icon: IconTags,
    match: (path) =>
      path.startsWith("/ration/monthly") || path.startsWith("/ration/report"),
  },
  {
    href: "/ration/requests",
    labelKey: "nav.requests",
    icon: IconSend,
    match: (path) => path.startsWith("/ration/requests"),
  },
  {
    href: "/consume/monthly",
    labelKey: "nav.monthlyConsume",
    icon: IconChartBar,
    match: (path) =>
      path === "/consume/monthly" ||
      path.startsWith("/consume/monthly/tag") ||
      path.startsWith("/consume/monthly/print"),
  },
  {
    href: "/consume/monthly/summary",
    labelKey: "nav.consumeSummary",
    icon: IconFileReport,
    match: (path) => path.startsWith("/consume/monthly/summary"),
  },
  {
    href: "/ration/members",
    labelKey: "nav.rationMembers",
    icon: IconUsers,
    match: (path) => path.startsWith("/ration/members"),
  },
];

const ADMIN_MEAL_TABS: Tab[] = [
  {
    href: "/mess/planning",
    labelKey: "nav.mealPlanning",
    icon: IconCalendarEvent,
    match: (path) => path.startsWith("/mess/planning"),
  },
  {
    href: "/mess/reports",
    labelKey: "nav.mealReports",
    icon: IconFileReport,
    match: (path) => path.startsWith("/mess/reports"),
  },
];

const SETTINGS_TAB: Tab = {
  href: "/settings",
  labelKey: "nav.settings",
  icon: IconSettings,
  match: (path) => path.startsWith("/settings"),
};

/** Ration strip. Admin auto-gets Dashboard + State Reports + meal planning/reports. */
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
  const requestBadge = useRequestMenuBadge("/ration/requests");
  const showDashboard = withDashboard ?? session?.role === "admin";
  const tabs = showDashboard
    ? [
        DASHBOARD_TAB,
        STATE_REPORTS_TAB,
        ...BASE_TABS,
        ...ADMIN_MEAL_TABS,
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
        badge: tab.href === "/ration/requests" ? requestBadge : undefined,
      }))}
    />
  );
}

export function AdminTabs({ className }: { className?: string }) {
  return <RationTabs className={className} withDashboard />;
}
