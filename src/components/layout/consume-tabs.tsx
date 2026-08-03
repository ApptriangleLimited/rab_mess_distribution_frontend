"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChartBar, IconFileReport, IconTags } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/consume/monthly/ledger",
    labelKey: "nav.consumeLedger" as const,
    icon: IconTags,
    match: (path: string) => path.startsWith("/consume/monthly/ledger"),
  },
  {
    href: "/consume/monthly",
    labelKey: "nav.monthlyConsume" as const,
    icon: IconChartBar,
    match: (path: string) =>
      path === "/consume/monthly" || path.startsWith("/consume/monthly/tag"),
  },
  {
    href: "/consume/monthly/summary",
    labelKey: "nav.consumeSummary" as const,
    icon: IconFileReport,
    match: (path: string) => path.startsWith("/consume/monthly/summary"),
  },
] as const;

/** Consume tabs — page header between title + actions. */
export function ConsumeTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
      aria-label={t("nav.consumeTabs")}
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
