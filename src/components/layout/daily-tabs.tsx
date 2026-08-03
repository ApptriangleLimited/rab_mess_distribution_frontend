"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTags, IconUserCheck } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/daily/tags",
    labelKey: "nav.dailyCockpit" as const,
    icon: IconTags,
    match: (path: string) =>
      path === "/daily/tags" || path.startsWith("/daily/tags/"),
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
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
      aria-label={t("nav.dailyTabs")}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
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
