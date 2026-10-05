"use client";

import { usePathname } from "next/navigation";
import { IconChartBar, IconFileReport, IconSend, IconTags } from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
import { useT } from "@/i18n/provider";

const TABS = [
  {
    href: "/consume/monthly/ledger",
    labelKey: "nav.consumeLedger" as const,
    icon: IconTags,
    match: (path: string) => path.startsWith("/consume/monthly/ledger"),
  },
  {
    href: "/consume/monthly/summary",
    labelKey: "nav.consumeSummary" as const,
    icon: IconFileReport,
    match: (path: string) => path.startsWith("/consume/monthly/summary"),
  },
  {
    href: "/consume/monthly",
    labelKey: "nav.monthlyConsume" as const,
    icon: IconChartBar,
    match: (path: string) =>
      path === "/consume/monthly" || path.startsWith("/consume/monthly/tag"),
  },
  {
    href: "/consume/requests",
    labelKey: "nav.requests" as const,
    icon: IconSend,
    match: (path: string) => path.startsWith("/consume/requests"),
  },
] as const;

/** Consume tabs — page header between title + actions. */
export function ConsumeTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();
  const requestBadge = useRequestMenuBadge("/consume/requests");

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={t("nav.consumeTabs")}
      layoutId="consume-role-tabs-pill"
      tabs={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
        badge: tab.href === "/consume/requests" ? requestBadge : undefined,
      }))}
    />
  );
}
