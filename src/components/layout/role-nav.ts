import type { Role } from "@/lib/types";
import type { MessageKey } from "@/i18n";
import {
  IconUsers,
  IconChecklist,
  IconUserCheck,
  IconTags,
  IconSoup,
  IconChartBar,
  IconCashBanknote,
  IconBuildingBank,
  IconFileReport,
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
    { href: "/cc/users", labelKey: "nav.users", icon: IconUsers, chip: "blue" },
  ],
  daily: [
    {
      href: "/daily/approvals",
      labelKey: "nav.approvals",
      icon: IconChecklist,
      chip: "orange",
    },
    {
      href: "/daily/roster",
      labelKey: "nav.roster",
      icon: IconUserCheck,
      chip: "indigo",
    },
    {
      href: "/daily/tags",
      labelKey: "nav.dailyTags",
      icon: IconTags,
      chip: "teal",
    },
  ],
  mess: [
    {
      href: "/mess/today",
      labelKey: "nav.todaysMess",
      icon: IconSoup,
      chip: "red",
    },
  ],
  consume: [
    {
      href: "/consume/monthly",
      labelKey: "nav.monthlyConsume",
      icon: IconChartBar,
      chip: "purple",
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
      href: "/ration/senders",
      labelKey: "nav.senderAccounts",
      icon: IconBuildingBank,
      chip: "blue",
    },
    {
      href: "/ration/report",
      labelKey: "nav.generateReport",
      icon: IconFileReport,
      chip: "emerald",
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
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300",
  neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};
