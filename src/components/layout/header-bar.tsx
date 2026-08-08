"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import {
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMenu2,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { Role, Session } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { ROLE_HOMES, rolesForPicker } from "@/lib/constants";
import { setSession } from "@/lib/session";
import { nowISO } from "@/lib/date";
import { useToast } from "@/components/shared/toast-provider";

export function HeaderBar({
  session,
  onLogout,
  onMenu,
  sidebarCollapsed,
  onToggleSidebar,
  hideSidebarControls = false,
}: {
  session: Session;
  onLogout: () => void;
  onMenu: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  hideSidebarControls?: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideSettings =
    session.role === "cc" ||
    session.role === "daily" ||
    session.role === "consume" ||
    session.role === "ration" ||
    session.role === "admin";

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onSwitchRole(role: Role) {
    if (role === session.role) return;
    const next = { ...session, role, loggedInAt: nowISO() };
    setSession(next);
    toast(t("settings.switchedTo", { role: roleLabel(role, locale) }), "success");
    window.location.href = ROLE_HOMES[role];
  }

  return (
    <header
      className={cn(
        "relative z-40 no-print",
        "border-b border-white/10 bg-header-bar/95 text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        "backdrop-blur-xl",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-light/60 to-transparent" />

      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {!hideSidebarControls ? (
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15 md:hidden"
                onClick={onMenu}
                aria-label={t("common.openMenu")}
              >
                <IconMenu2 className="h-5 w-5" />
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15 md:inline-flex"
                onClick={onToggleSidebar}
                aria-label={
                  sidebarCollapsed
                    ? t("common.expandSidebar")
                    : t("common.collapseSidebar")
                }
                title={
                  sidebarCollapsed
                    ? t("common.expandSidebar")
                    : t("common.collapseSidebar")
                }
              >
                {sidebarCollapsed ? (
                  <IconLayoutSidebarLeftExpand className="h-5 w-5" />
                ) : (
                  <IconLayoutSidebarLeftCollapse className="h-5 w-5" />
                )}
              </motion.button>
            </>
          ) : (
            <p className="truncate text-sm font-semibold tracking-wide text-white/90">
              {t("common.productName")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <div className="hidden sm:block">
            <Select
              value={session.role}
              onValueChange={(v) => onSwitchRole(v as Role)}
            >
              <SelectTrigger
                className="h-10 min-w-[148px] rounded-xl border-white/10 bg-white/10 text-sm text-white shadow-none hover:bg-white/15 focus:ring-2 focus:ring-primary-light/40"
                aria-label={t("common.switchRole")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolesForPicker(session.role).map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 py-1.5 pl-1.5 pr-2 transition hover:bg-white/15",
                menuOpen && "bg-white/15 ring-1 ring-primary-light/40",
              )}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <UserAvatar name={session.name} />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[120px] truncate text-sm font-medium">
                  {session.name}
                </span>
                <span className="block text-[11px] text-white/55">
                  {roleLabel(session.role as Role, locale)}
                </span>
              </span>
              <IconChevronDown
                className={cn(
                  "hidden h-4 w-4 text-white/60 transition sm:block",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 p-1.5 text-neutral-900 shadow-2xl backdrop-blur-xl dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-100"
                >
                  <div className="mb-1 flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/80">
                    <IconUserCircle className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{session.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {roleLabel(session.role, locale)}
                      </p>
                    </div>
                  </div>
                  {!hideSettings ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/settings");
                      }}
                    >
                      <IconSettings className="h-4 w-4 text-neutral-500" />
                      {t("common.settings")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <IconLogout className="h-4 w-4" />
                    {t("common.logout")}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
