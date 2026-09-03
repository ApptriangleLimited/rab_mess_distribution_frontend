"use client";

import { usePathname } from "next/navigation";
import {
  IconSend,
  IconTags,
  IconUserCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useT } from "@/i18n/provider";

const TABS = [
  {
    href: "/daily/tags",
    labelKey: "nav.dailyCockpit" as const,
    icon: IconTags,
    match: (path: string) =>
      path === "/daily/tags" || path.startsWith("/daily/tags/"),
  },
  {
    href: "/daily/requests",
    labelKey: "nav.requests" as const,
    icon: IconSend,
    match: (path: string) =>
      path === "/daily/requests" || path.startsWith("/daily/requests/"),
  },
  {
    href: "/daily/manpower",
    labelKey: "nav.manpower" as const,
    icon: IconUsersGroup,
    match: (path: string) =>
      path === "/daily/manpower" || path.startsWith("/daily/manpower/"),
  },
  {
    href: "/daily/roster",
    labelKey: "nav.roster" as const,
    icon: IconUserCheck,
    match: (path: string) =>
      path === "/daily/roster" ||
      path.startsWith("/daily/roster/") ||
      path.startsWith("/daily/users"),
  },
] as const;

/** Daily Cockpit / Members — sit in page header between title + actions. */
export function DailyTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={t("nav.dailyTabs")}
      layoutId="daily-role-tabs-pill"
      tabs={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
      }))}
    />
  );
}
