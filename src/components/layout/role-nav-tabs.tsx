"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Icon } from "@tabler/icons-react";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import { cn } from "@/lib/utils";

export type RoleNavTab = {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  badge?: number;
};

type Props = {
  tabs: RoleNavTab[];
  ariaLabel: string;
  /** Unique layoutId so multiple strips on one page don't clash. */
  layoutId: string;
  className?: string;
  /** Extra controls after main tabs (e.g. Settings Rates/Bank/QR). */
  after?: ReactNode;
};

/** Shared colorful header tab strip (Daily / Ration / Consume). */
export function RoleNavTabs({
  tabs,
  ariaLabel,
  layoutId,
  className,
  after,
}: Props) {
  const reduceMotion = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);
  const activeHref = tabs.find((tab) => tab.active)?.href ?? "";

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !activeHref) return;
    const active = nav.querySelector<HTMLElement>(
      `[data-tab-href="${CSS.escape(activeHref)}"]`,
    );
    if (!active) return;
    const target =
      active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2;
    nav.scrollTo({
      left: Math.max(0, target),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeHref, reduceMotion]);

  return (
    <nav
      ref={navRef}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto scroll-smooth rounded-2xl border border-primary/15 bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80 p-1 shadow-[0_1px_2px_rgba(6,121,87,0.06),0_8px_20px_-14px_rgba(15,23,42,0.2)] dark:border-primary/25 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none",
        className,
      )}
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tab-href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
              tab.active
                ? "text-white"
                : "text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-emerald-200",
            )}
          >
            {tab.active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary-light to-secondary shadow-md shadow-primary/30"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32 }
                }
              />
            ) : null}
            {!tab.active ? (
              <span
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity hover:bg-primary/8 hover:opacity-100 dark:hover:bg-primary/15"
                aria-hidden
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-lg transition",
                  tab.active
                    ? "bg-white/20 text-white"
                    : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-emerald-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" stroke={2.25} />
              </span>
              <span className="whitespace-nowrap">{tab.label}</span>
              <NavCountBadge
                count={tab.badge ?? 0}
                tone={tab.active ? "tabActive" : "tab"}
              />
            </span>
          </Link>
        );
      })}
      {after ? (
        <>
          <span
            className="mx-0.5 h-6 w-px shrink-0 self-center bg-neutral-200/90 dark:bg-neutral-700"
            aria-hidden
          />
          {after}
        </>
      ) : null}
    </nav>
  );
}
