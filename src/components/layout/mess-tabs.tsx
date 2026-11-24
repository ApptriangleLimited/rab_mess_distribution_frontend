"use client";

import { usePathname } from "next/navigation";
import {
  IconCake,
  IconClockHour4,
  IconLayoutDashboard,
  IconSend,
  IconListDetails,
  IconScan,
  IconSettings,
  IconTags,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n/provider";

const CHECKER_TABS = [
  {
    href: "/mess/check",
    labelKey: "nav.mealCheckIn" as const,
    icon: IconScan,
    match: (path: string) => path === "/mess/check" || path.startsWith("/mess/check/"),
  },
  {
    href: "/mess/guest-list",
    labelKey: "nav.guestList" as const,
    icon: IconListDetails,
    match: (path: string) =>
      path === "/mess/guest-list" || path.startsWith("/mess/guest-list/"),
  },
] as const;

const TABS = [
  {
    href: "/mess",
    labelKey: "nav.messDashboard" as const,
    icon: IconLayoutDashboard,
    match: (path: string) => path === "/mess",
  },
  {
    href: "/mess/ledger",
    labelKey: "nav.messLedger" as const,
    icon: IconTags,
    match: (path: string) =>
      path === "/mess/ledger" || path.startsWith("/mess/ledger/"),
  },
  {
    href: "/mess/guest-list",
    labelKey: "nav.guestList" as const,
    icon: IconListDetails,
    match: (path: string) =>
      path === "/mess/guest-list" || path.startsWith("/mess/guest-list/"),
  },
  {
    href: "/mess/requests",
    labelKey: "nav.requests" as const,
    icon: IconSend,
    match: (path: string) =>
      path === "/mess/requests" || path.startsWith("/mess/requests/"),
  },
  {
    href: "/mess/pritibhoj",
    labelKey: "nav.pritibhoj" as const,
    icon: IconCake,
    match: (path: string) =>
      path === "/mess/pritibhoj" || path.startsWith("/mess/pritibhoj/"),
  },
  {
    href: "/mess/shifts",
    labelKey: "nav.shifts" as const,
    icon: IconClockHour4,
    match: (path: string) =>
      path === "/mess/shifts" || path.startsWith("/mess/shifts/"),
  },
  {
    href: "/settings",
    labelKey: "nav.settings" as const,
    icon: IconSettings,
    match: (path: string) => path === "/settings" || path.startsWith("/settings/"),
  },
] as const;

/** Ledger / Pritibhoj / Shifts — header strip. */
export function MessTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();
  const { session } = useSession();
  const requestBadge = useRequestMenuBadge("/mess/requests");
  const tabs = session?.role === "mess_checker" ? CHECKER_TABS : TABS;

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={t("nav.messTabs")}
      layoutId="mess-role-tabs-pill"
      tabs={tabs.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
        badge: tab.href === "/mess/requests" ? requestBadge : undefined,
      }))}
    />
  );
}

/** Admin → admin strip; mess → mess strip. */
export function MessPageTabs({ className }: { className?: string }) {
  const { session } = useSession();
  if (session?.role === "admin") return <AdminTabs className={className} />;
  return <MessTabs className={className} />;
}
