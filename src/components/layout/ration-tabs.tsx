"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconFileReport,
  IconLayoutDashboard,
  IconSettings,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import type { Icon } from "@tabler/icons-react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

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
  match: (path) => path === "/admin" || path.startsWith("/admin/"),
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

/** Ration strip. Admin auto-gets Dashboard tab first. */
export function RationTabs({
  className,
  withDashboard,
}: {
  className?: string;
  /** Force dashboard tab; default = admin session. */
  withDashboard?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const { session } = useSession();
  const showDashboard = withDashboard ?? session?.role === "admin";
  const tabs = showDashboard ? [DASHBOARD_TAB, ...BASE_TABS] : BASE_TABS;

  return (
    <nav
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
      aria-label={
        showDashboard ? t("nav.adminTabs") : t("nav.rationTabs")
      }
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:text-white dark:ring-white/10"
                : "text-neutral-500 hover:bg-white/70 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminTabs({ className }: { className?: string }) {
  return <RationTabs className={className} withDashboard />;
}
