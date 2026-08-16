"use client";

import { usePathname } from "next/navigation";
import { IconSoup, IconTags } from "@tabler/icons-react";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useT } from "@/i18n/provider";

const TABS = [
  {
    href: "/mess/today",
    labelKey: "nav.todaysMess" as const,
    icon: IconSoup,
    match: (path: string) =>
      path === "/mess/today" || path.startsWith("/mess/today/"),
  },
  {
    href: "/mess/ledger",
    labelKey: "nav.messLedger" as const,
    icon: IconTags,
    match: (path: string) =>
      path === "/mess/ledger" || path.startsWith("/mess/ledger/"),
  },
] as const;

/** Today's Mess / Ledger — header strip. */
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
