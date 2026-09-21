"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMenu2,
  IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ProfileDialog } from "@/components/layout/profile-dialog";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { switchToSeedRole } from "@/lib/api/switch-role";
import { ROLE_KEYS, isSuperAdminLogin } from "@/lib/constants";
import type { Role, Session } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import type { Locale } from "@/i18n";
import { roleLabel } from "@/i18n";
import { getProfileAvatar, homeForRole } from "@/lib/session";

export function HeaderBar({
  session,
  onLogout,
  onMenu,
  sidebarCollapsed,
  onToggleSidebar,
  hideSidebarControls = false,
  onProfileSaved,
}: {
  session: Session;
  onLogout: () => void;
  onMenu: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  hideSidebarControls?: boolean;
  onProfileSaved?: (name: string, avatarUrl: string | null, username?: string) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const { locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarUrl = session.avatarUrl ?? getProfileAvatar(session.role, session.username) ?? null;
  const canSwitchRoles =
    Boolean(session.roleSwitcher) || isSuperAdminLogin(session.username);

  async function onSwitchRole(role: Role) {
    if (role === session.role || switching) return;
    setSwitching(true);
    try {
      await switchToSeedRole(role, session);
      toast(t("settings.switchedTo", { role: roleLabel(role, locale) }), "success");
      window.location.href = homeForRole(role);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.switchFailed"),
        "error",
      );
      setSwitching(false);
    }
  }

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

  return (
    <header
      className={cn(
        "relative z-40 no-print",
        "border-b border-white/10 bg-header-bar/95 text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]",
        "backdrop-blur-xl",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-light/35 to-transparent" />

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {!hideSidebarControls ? (
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white shadow-inner shadow-white/5 transition hover:bg-white/15 md:hidden"
                onClick={onMenu}
                aria-label={t("common.openMenu")}
              >
                <IconMenu2 className="h-5 w-5" />
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white shadow-inner shadow-white/5 transition hover:bg-white/15 md:inline-flex"
                onClick={onToggleSidebar}
                aria-label={
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
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                {t("common.rab")}
              </p>
              <p className="truncate text-sm font-semibold tracking-[0.08em] text-white">
                {t("common.productName")}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          {canSwitchRoles ? (
            <label className="flex items-center gap-1.5">
              <span className="sr-only">{t("settings.activeRole")}</span>
              <select
                className="h-9 max-w-[9.5rem] rounded-xl border border-white/15 bg-white/10 px-2 text-xs font-semibold text-white outline-none ring-white/20 hover:bg-white/15 focus:ring-2"
                value={session.role}
                disabled={switching}
                onChange={(e) => void onSwitchRole(e.target.value as Role)}
                aria-label={t("settings.roleSwitcher")}
              >
                {ROLE_KEYS.map((role) => (
                  <option key={role} value={role} className="text-neutral-900">
                    {roleLabel(role, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div
            className="flex items-center rounded-2xl border border-white/10 bg-white/[0.07] p-0.5 shadow-inner shadow-black/10"
            role="group"
            aria-label={t("settings.locale")}
          >
            {(["en", "bn"] as const).map((code) => {
              const active = locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code as Locale)}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-[11px] font-bold tracking-wide transition",
                    active
                      ? "bg-white text-header-bar shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                  aria-pressed={active}
                  aria-label={code === "en" ? t("common.languageEn") : t("common.languageBn")}
                >
                  {code === "en" ? t("common.languageEn") : t("common.languageBn")}
                </button>
              );
            })}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.08] py-1 pl-1 pr-2.5 shadow-inner shadow-white/5 transition hover:bg-white/15",
                menuOpen && "bg-white/15 ring-1 ring-white/25",
              )}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <UserAvatar
                name={session.name}
                src={avatarUrl}
                className="ring-2 ring-white/20"
              />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight">
                  {session.name}
                </span>
                <span className="block text-[11px] font-medium tracking-wide text-white/60">
                  {roleLabel(session.role as Role, locale)}
                </span>
              </span>
              <IconChevronDown
                className={cn(
                  "hidden h-4 w-4 text-white/55 transition sm:block",
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
                  className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-1.5 text-neutral-900 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-100"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileOpen(true);
                    }}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <IconUser className="h-4 w-4" />
                    </span>
                    {t("profile.menu")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50">
                      <IconLogout className="h-4 w-4" />
                    </span>
                    {t("common.logout")}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ProfileDialog
        open={profileOpen}
        session={session}
        avatarUrl={avatarUrl}
        onClose={() => setProfileOpen(false)}
        onSaved={(name, avatar, username) => onProfileSaved?.(name, avatar, username)}
      />
    </header>
  );
}
