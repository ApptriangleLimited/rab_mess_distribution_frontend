"use client";

import { usePathname } from "next/navigation";
import {
  IconCalendarEvent,
  IconClockHour4,
  IconFileReport,
  IconSoup,
  IconTags,
  IconUserPlus,
} from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n/provider";

const TABS = [
  {
    href: "/mess/ledger",
    labelKey: "nav.messLedger" as const,
    icon: IconTags,
    match: (path: string) =>
      path === "/mess/ledger" || path.startsWith("/mess/ledger/"),
  },
  {
    href: "/mess/today",
    labelKey: "nav.todaysMess" as const,
    icon: IconSoup,
    match: (path: string) =>
      path === "/mess/today" || path.startsWith("/mess/today/"),
  },
  {
    href: "/mess/shifts",
    labelKey: "nav.shifts" as const,
    icon: IconClockHour4,
    match: (path: string) =>
      path === "/mess/shifts" || path.startsWith("/mess/shifts/"),
  },
  {
    href: "/mess/planning",
    labelKey: "nav.mealPlanning" as const,
    icon: IconCalendarEvent,
    match: (path: string) =>
      path === "/mess/planning" || path.startsWith("/mess/planning/"),
  },
  {
    href: "/mess/reports",
    labelKey: "nav.mealReports" as const,
    icon: IconFileReport,
    match: (path: string) =>
      path === "/mess/reports" || path.startsWith("/mess/reports/"),
  },
  {
    href: "/mess/guests",
    labelKey: "nav.guestMeals" as const,
    icon: IconUserPlus,
    match: (path: string) =>
      path === "/mess/guests" || path.startsWith("/mess/guests/"),
  },
] as const;

/** Ledger / Today / Shifts / Planning / Reports / Guests — header strip. */
export function MessTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={t("nav.messTabs")}
      layoutId="mess-role-tabs-pill"
      tabs={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
      }))}
    />
  );
}

/** Planning / reports / guests — admin sees admin strip, mess sees mess strip. */
export function MessPageTabs({ className }: { className?: string }) {
  const { session } = useSession();
  if (session?.role === "admin") return <AdminTabs className={className} />;
  return <MessTabs className={className} />;
}
