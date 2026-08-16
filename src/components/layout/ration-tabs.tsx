"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconClipboardList,
  IconFileReport,
  IconLayoutDashboard,
  IconSettings,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
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
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: IconSettings,
    match: (path) => path.startsWith("/settings"),
  },
];

/** Ration strip. Admin auto-gets Dashboard + State Reports tabs first. */
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
  const showDashboard = withDashboard ?? session?.role === "admin";
  const tabs = showDashboard
    ? [DASHBOARD_TAB, STATE_REPORTS_TAB, ...BASE_TABS]
    : BASE_TABS;

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
      }))}
    />
  );
}

export function AdminTabs({ className }: { className?: string }) {
  return <RationTabs className={className} withDashboard />;
}
