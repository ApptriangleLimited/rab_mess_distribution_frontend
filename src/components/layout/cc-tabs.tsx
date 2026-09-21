"use client";

import { usePathname } from "next/navigation";
import { IconSend, IconUsers } from "@tabler/icons-react";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { RoleNavTabs } from "@/components/layout/role-nav-tabs";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n/provider";

const TABS = [
  {
    href: "/cc/users",
    labelKey: "nav.users" as const,
    icon: IconUsers,
    match: (path: string) =>
      path === "/cc/users" ||
      path.startsWith("/cc/users/") ||
      path === "/cc",
  },
  {
    href: "/cc/requested",
    labelKey: "nav.requested" as const,
    icon: IconSend,
    match: (path: string) =>
      path === "/cc/requested" || path.startsWith("/cc/requested/"),
  },
] as const;

/** Members / Requested — sit in page header between title + actions. */
export function CcTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useT();
  const { session } = useSession();
  const requestBadge = useRequestMenuBadge("/cc/requested");

  if (session?.role === "admin") {
    return <AdminTabs className={className} />;
  }

  return (
    <RoleNavTabs
      className={className}
      ariaLabel={t("nav.ccTabs")}
      layoutId="cc-role-tabs-pill"
      tabs={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.labelKey),
        icon: tab.icon,
        active: tab.match(pathname),
        badge: tab.href === "/cc/requested" ? requestBadge : undefined,
      }))}
    />
  );
}
