"use client";

import { usePathname } from "next/navigation";
import {
  IconClockHour4,
  IconCake,
  IconTags,
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
    href: "/mess/shifts",
    labelKey: "nav.shifts" as const,
    icon: IconClockHour4,
    match: (path: string) =>
      path === "/mess/shifts" || path.startsWith("/mess/shifts/"),
  },
  {
    href: "/mess/pritibhoj",
    labelKey: "nav.pritibhoj" as const,
    icon: IconCake,
    match: (path: string) =>
      path === "/mess/pritibhoj" || path.startsWith("/mess/pritibhoj/"),
  },
] as const;

/** Ledger / Shifts / Pritibhoj — header strip. Meal reports stay on admin. */
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

/** Admin → admin strip; mess → mess strip. */
export function MessPageTabs({ className }: { className?: string }) {
  const { session } = useSession();
  if (session?.role === "admin") return <AdminTabs className={className} />;
  return <MessTabs className={className} />;
}
