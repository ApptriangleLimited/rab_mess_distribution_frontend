"use client";

import { useEffect, useRef } from "react";
import {
  IconBuildingBank,
  IconClockHour4,
  IconCoin,
  IconMilitaryRank,
  IconQrcode,
  IconShield,
  IconTopologyStar3,
  IconClipboardList,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "rates"
  | "staff"
  | "rank"
  | "wing"
  | "force"
  | "shifts"
  | "bank"
  | "member-bank"
  | "authorized"
  | "qr";

type TabDef = {
  id: SettingsTabId;
  labelKey: MessageKey;
  icon: Icon;
  rationOnly?: boolean;
  staffOnly?: boolean;
};

const TABS: TabDef[] = [
  { id: "rates", labelKey: "settings.tabRates", icon: IconCoin },
  { id: "staff", labelKey: "settings.tabStaff", icon: IconUsers, staffOnly: true },
  { id: "rank", labelKey: "settings.tabRank", icon: IconMilitaryRank },
  { id: "wing", labelKey: "settings.tabWing", icon: IconTopologyStar3 },
  { id: "force", labelKey: "settings.tabForce", icon: IconShield },
  { id: "shifts", labelKey: "settings.tabShifts", icon: IconClockHour4 },
  {
    id: "bank",
    labelKey: "settings.tabBank",
    icon: IconBuildingBank,
    rationOnly: true,
  },
  {
    id: "member-bank",
    labelKey: "settings.tabMemberBank",
    icon: IconUsers,
    rationOnly: true,
  },
  {
    id: "authorized",
    labelKey: "settings.tabAuthorized",
    icon: IconClipboardList,
  },
  { id: "qr", labelKey: "settings.tabQr", icon: IconQrcode },
];

export function settingsTabsForRole(
  isRation: boolean,
  canManageStaff = false,
): TabDef[] {
  return TABS.filter(
    (tab) =>
      (!tab.rationOnly || isRation) && (!tab.staffOnly || canManageStaff),
  );
}

export function parseSettingsTab(
  raw: string | null,
  isRation: boolean,
  canManageStaff = false,
): SettingsTabId {
  const allowed = settingsTabsForRole(isRation, canManageStaff).map((t) => t.id);
  if (raw && (allowed as string[]).includes(raw)) {
    return raw as SettingsTabId;
  }
  return allowed[0] ?? "rates";
}

/** In-page Settings sections — Rates / Ranks / Wings / Forces / Shifts / SRB Bank / Member Bank / Authorized / QR. */
export function SettingsSectionTabs({
  value,
  onChange,
  isRation,
  canManageStaff = false,
  className,
  /** Sit inside RoleNavTabs `after` — no own border chrome. */
  embedded = false,
}: {
  value: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
  isRation: boolean;
  canManageStaff?: boolean;
  className?: string;
  embedded?: boolean;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const tabs = settingsTabsForRole(isRation, canManageStaff);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const activeEl = root.querySelector<HTMLElement>(
      `[data-settings-tab="${value}"]`,
    );
    if (!activeEl) return;
    const target =
      activeEl.offsetLeft - root.clientWidth / 2 + activeEl.offsetWidth / 2;
    root.scrollTo({
      left: Math.max(0, target),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [value, reduceMotion]);

  const buttons = tabs.map((tab) => {
    const Icon = tab.icon;
    const active = value === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        data-settings-tab={tab.id}
        onClick={() => onChange(tab.id)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
          active
            ? "text-white"
            : "text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-emerald-200",
        )}
      >
        {active ? (
          <motion.span
            layoutId="settings-section-tabs-pill"
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary-light to-secondary shadow-md shadow-primary/30"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 32 }
            }
          />
        ) : null}
        {!active ? (
          <span
            className="absolute inset-0 rounded-xl opacity-0 transition-opacity hover:bg-primary/8 hover:opacity-100 dark:hover:bg-primary/15"
            aria-hidden
          />
        ) : null}
        <span className="relative z-10 inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-lg transition",
              active
                ? "bg-white/20 text-white"
                : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-emerald-200",
            )}
          >
            <Icon className="h-3.5 w-3.5" stroke={2.25} />
          </span>
          <span className="whitespace-nowrap">{t(tab.labelKey)}</span>
        </span>
      </button>
    );
  });

  if (embedded) {
    return (
      <div
        ref={rootRef as React.RefObject<HTMLDivElement>}
        className={cn("inline-flex items-center gap-1", className)}
        role="group"
        aria-label={t("settings.tabs")}
      >
        {buttons}
      </div>
    );
  }

  return (
    <nav
      ref={rootRef}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto scroll-smooth rounded-2xl border border-primary/15 bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80 p-1 shadow-[0_1px_2px_rgba(6,121,87,0.06),0_8px_20px_-14px_rgba(15,23,42,0.2)] dark:border-primary/25 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none",
        className,
      )}
      aria-label={t("settings.tabs")}
    >
      {buttons}
    </nav>
  );
}
