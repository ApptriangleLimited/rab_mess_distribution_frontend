"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { cn } from "@/lib/utils";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import {
  CHIP_CLASS,
  NAV_BY_ROLE,
  SHARED_NAV,
  isNavActive,
  type NavItem,
} from "@/components/layout/role-nav";
import { useRequestMenuBadge } from "@/hooks/use-pending-request-counts";
import type { Role } from "@/lib/types";

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const t = useT();
  const Icon = item.icon;
  const label = t(item.labelKey);
  const badge = useRequestMenuBadge(item.href);

  return (
    <Link
      href={item.href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-gradient-to-r from-nav-accent/10 to-nav-accent/20 text-neutral-900 shadow-sm ring-1 ring-nav-accent/15 dark:from-nav-accent/20 dark:to-nav-accent/10 dark:text-white dark:ring-nav-accent/25"
          : "text-neutral-600 hover:bg-white/55 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-active-rail"
          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-nav-accent"
        />
      ) : null}
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
          active
            ? CHIP_CLASS[item.chip] ?? CHIP_CLASS.neutral
            : "bg-white/80 text-neutral-500 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/5 dark:text-neutral-400 dark:ring-white/5",
        )}
      >
        <Icon className="h-4 w-4" />
        {collapsed && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1.5">
            <NavCountBadge count={badge} />
          </span>
        ) : null}
      </span>
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate tracking-tight">{label}</span>
          <NavCountBadge count={badge} />
        </span>
      ) : null}
    </Link>
  );
}

function SidebarBrand({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const t = useT();
  const { locale } = useI18n();

  return (
    <div
      className={cn(
        "shrink-0 border-b border-sidebar-edge/80 dark:border-white/10",
        collapsed ? "px-2 pb-4 pt-4" : "px-4 pb-5 pt-5",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-[10px] font-bold tracking-tight text-white shadow-md shadow-primary/30"
          title={collapsed ? t("common.productName") : undefined}
        >
          DRC
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-400 dark:border-[#0c1512]" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase tracking-[0.14em] text-brand-title dark:text-white">
              {t("common.productName")}
            </p>
            <span className="mt-1 inline-flex max-w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:bg-primary/20 dark:text-emerald-200">
              {roleLabel(role, locale)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidebarNav({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const main = NAV_BY_ROLE[role];
  const shared = SHARED_NAV;
  const mainHrefs = main.map((item) => item.href);
  const sharedHrefs = shared.map((item) => item.href);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar",
        collapsed ? "px-2 py-3" : "px-3 py-3",
      )}
    >
      {!collapsed ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          {t("common.menu")}
        </p>
      ) : null}
      <nav className="flex flex-col gap-0.5">
        {main.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavActive(pathname, item.href, mainHrefs)}
          />
        ))}
      </nav>

      <div className="mt-4 border-t border-sidebar-edge/80 pt-3 dark:border-white/10">
        {!collapsed ? (
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            {t("common.settings")}
          </p>
        ) : null}
        <nav className="flex flex-col gap-0.5">
          {shared.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isNavActive(pathname, item.href, sharedHrefs)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

const sidebarSurface = cn(
  "bg-sidebar",
  "bg-[radial-gradient(120%_80%_at_0%_0%,color-mix(in_srgb,var(--layout-tint)_18%,transparent),transparent_55%)]",
  "dark:bg-[radial-gradient(120%_80%_at_0%_0%,color-mix(in_srgb,var(--layout-tint)_28%,transparent),transparent_50%)]",
);

export function Sidebar({
  role,
  collapsed,
}: {
  role: Role;
  collapsed: boolean;
}) {
  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-out",
        "border-r border-sidebar-edge shadow-[inset_-1px_0_0_rgba(6,121,88,0.06)]",
        "dark:border-sidebar-edge dark:shadow-none",
        sidebarSurface,
        "md:flex",
        collapsed ? "w-[80px]" : "w-[248px]",
      )}
    >
      <SidebarBrand role={role} collapsed={collapsed} />
      <SidebarNav role={role} collapsed={collapsed} />
    </aside>
  );
}

export function MobileDrawer({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const t = useT();
  const { locale } = useI18n();
  const items = [...NAV_BY_ROLE[role], ...SHARED_NAV];
  const hrefs = items.map((item) => item.href);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.closeMenu")}
        onClick={onClose}
      />
      <motion.div
        initial={{ x: -24, opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[288px] flex-col overflow-hidden shadow-2xl",
          "border-r border-sidebar-edge",
          sidebarSurface,
        )}
      >
        <div className="border-b border-sidebar-edge px-4 py-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-[9px] font-bold tracking-tight text-white">
              DRC
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-nav-accent">
                {t("common.productName")}
              </p>
              <span className="mt-1 inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {roleLabel(role, locale)}
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <div key={item.href} onClick={onClose}>
                <NavLink
                  item={item}
                  collapsed={false}
                  active={isNavActive(pathname, item.href, hrefs)}
                />
              </div>
            ))}
          </div>
        </nav>
      </motion.div>
    </div>
  );
}
