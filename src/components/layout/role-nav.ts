import type { Role } from "@/lib/types";
import type { MessageKey } from "@/i18n";
import {
  IconUserCheck,
  IconTags,
  IconSend,
  IconChartBar,
  IconCashBanknote,
  IconFileReport,
  IconUsersGroup,
  IconClockHour4,
  IconCake,
  IconSettings,
  type Icon,
} from "@tabler/icons-react";

export type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: Icon;
  chip: string;
};

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  cc: [
    {
      href: "/cc/users",
      labelKey: "nav.users",
      icon: IconUsersGroup,
      chip: "teal",
    },
    {
      href: "/cc/requested",
      labelKey: "nav.requested",
      icon: IconSend,
      chip: "amber",
    },
  ],
  daily: [
    {
      href: "/daily/tags",
      labelKey: "nav.dailyCockpit",
      icon: IconTags,
      chip: "teal",
    },
    {
      href: "/daily/requests",
      labelKey: "nav.requests",
      icon: IconSend,
      chip: "amber",
    },
    {
      href: "/daily/manpower",
      labelKey: "nav.manpower",
      icon: IconUsersGroup,
      chip: "sky",
    },
    {
      href: "/daily/roster",
      labelKey: "nav.roster",
      icon: IconUserCheck,
      chip: "indigo",
    },
  ],
  mess: [
    {
      href: "/mess/ledger",
      labelKey: "nav.messLedger",
      icon: IconTags,
      chip: "teal",
    },
    {
      href: "/mess/shifts",
      labelKey: "nav.shifts",
      icon: IconClockHour4,
      chip: "purple",
    },
    {
      href: "/mess/pritibhoj",
      labelKey: "nav.pritibhoj",
      icon: IconCake,
      chip: "amber",
    },
  ],
  consume: [
    {
      href: "/consume/monthly/ledger",
      labelKey: "nav.consumeLedger",
      icon: IconTags,
      chip: "teal",
    },
    {
      href: "/consume/requests",
      labelKey: "nav.requests",
      icon: IconSend,
      chip: "amber",
    },
    {
      href: "/consume/monthly",
      labelKey: "nav.monthlyConsume",
      icon: IconChartBar,
      chip: "purple",
    },
    {
      href: "/consume/monthly/summary",
      labelKey: "nav.consumeSummary",
      icon: IconFileReport,
      chip: "indigo",
    },
  ],
  ration: [
    {
      href: "/ration/monthly",
      labelKey: "nav.monthlyRation",
      icon: IconCashBanknote,
      chip: "cyan",
    },
    {
      href: "/ration/requests",
      labelKey: "nav.requests",
      icon: IconSend,
      chip: "amber",
    },
    {
      href: "/ration/report",
      labelKey: "nav.generateReport",
      icon: IconFileReport,
      chip: "emerald",
    },
    {
      href: "/consume/monthly",
      labelKey: "nav.monthlyConsume",
      icon: IconChartBar,
      chip: "purple",
    },
    {
      href: "/consume/monthly/summary",
      labelKey: "nav.consumeSummary",
      icon: IconFileReport,
      chip: "indigo",
    },
  ],
  /** Sidebar unused (tabs UI) — keep for completeness. */
  admin: [
    {
      href: "/admin",
      labelKey: "nav.adminDashboard",
      icon: IconFileReport,
      chip: "teal",
    },
    {
      href: "/admin/report-requests",
      labelKey: "nav.reportRequests",
      icon: IconSend,
      chip: "amber",
    },
    {
      href: "/ration/monthly",
      labelKey: "nav.monthlyRation",
      icon: IconCashBanknote,
      chip: "cyan",
    },
    {
      href: "/consume/monthly",
      labelKey: "nav.monthlyConsume",
      icon: IconChartBar,
      chip: "purple",
    },
    {
      href: "/consume/monthly/summary",
      labelKey: "nav.consumeSummary",
      icon: IconFileReport,
      chip: "indigo",
    },
  ],
};

export const SHARED_NAV: NavItem[] = [
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: IconSettings,
    chip: "neutral",
  },
];

export const CHIP_CLASS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

/** Longest matching href wins — avoids `/consume/monthly` stealing summary/ledger. */
export function isNavActive(
  pathname: string,
  href: string,
  candidates: string[],
) {
  const matches = candidates.filter(
    (h) => pathname === h || pathname.startsWith(`${h}/`),
  );
  if (matches.length === 0) return false;
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return best === href;
}
