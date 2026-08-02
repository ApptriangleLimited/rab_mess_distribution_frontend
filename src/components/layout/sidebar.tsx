"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  CHIP_CLASS,
  NAV_BY_ROLE,
  SHARED_NAV,
  type NavItem,
} from "@/components/layout/role-nav";
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

  return (
    <Link
      href={item.href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:text-white dark:ring-white/10"
          : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white",
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
          active
            ? CHIP_CLASS[item.chip] ?? CHIP_CLASS.neutral
            : "bg-white/70 text-neutral-500 shadow-sm dark:bg-white/5 dark:text-neutral-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function SidebarBrand({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const t = useT();
  const { locale } = useI18n();

  return (
    <div
      className={cn(
        "shrink-0 border-b border-primary/10 dark:border-white/10",
        collapsed ? "px-2 pb-4 pt-4" : "px-4 pb-5 pt-5",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-sm font-bold text-white shadow-lg shadow-primary/25"
          title={collapsed ? t("common.productName") : undefined}
        >
          MD
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-neutral-900" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase tracking-[0.12em] text-brand-title dark:text-white">
              {t("common.productName")}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {roleLabel(role, locale)}
            </p>
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

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar py-4",
        collapsed ? "px-2" : "px-3",
      )}
    >
      {!collapsed ? (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          {t("common.menu")}
        </p>
      ) : null}
      <nav className="flex flex-col gap-1">
        {main.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <div
        className={cn(
          "mt-4 border-t border-primary/10 pt-4 dark:border-white/10",
        )}
      >
        {!collapsed ? (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            {t("common.settings")}
          </p>
        ) : null}
        <nav className="flex flex-col gap-1">
          {shared.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

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
        "border-r border-primary/10 bg-gradient-to-b from-layout-tint/25 via-layout-tint/10 to-white",
        "dark:border-white/10 dark:from-layout-tint/20 dark:via-neutral-950 dark:to-neutral-950",
        "md:flex",
        collapsed ? "w-[80px]" : "w-[260px]",
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
          "absolute inset-y-0 left-0 flex w-[288px] flex-col overflow-hidden",
          "border-r border-primary/10 bg-gradient-to-b from-layout-tint/40 via-white to-white shadow-2xl",
          "dark:from-layout-tint/30 dark:via-neutral-950 dark:to-neutral-950",
        )}
      >
        <div className="border-b border-primary/10 px-4 py-5 dark:border-white/10">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-nav-accent">
            {t("common.productName")}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{roleLabel(role, locale)}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div key={item.href} onClick={onClose}>
                <NavLink
                  item={item}
                  collapsed={false}
                  active={
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              </div>
            ))}
          </div>
        </nav>
      </motion.div>
    </div>
  );
}
