"use client";

import { useId, useState, type ReactNode } from "react";
import { IconChevronDown, type Icon } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Settings-style card: header toggles body. Default collapsed. */
export function CollapsibleSection({
  title,
  hint,
  icon: Icon,
  badge,
  headerActions,
  children,
  className,
  id,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  /** Always show body; no expand/collapse chrome (tab panels). */
  static: staticPanel = false,
}: {
  title: string;
  hint?: string;
  icon: Icon;
  badge?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  static?: boolean;
}) {
  const t = useT();
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = staticPanel ? true : (openProp ?? uncontrolled);
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    if (staticPanel) return;
    const value = typeof next === "function" ? next(open) : next;
    if (openProp === undefined) setUncontrolled(value);
    onOpenChange?.(value);
  };
  const panelId = useId();

  return (
    <section
      id={id}
      className={cn(
        "section-card flex flex-col overflow-hidden p-0",
        open && "min-h-0",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 bg-gradient-to-br from-neutral-50/90 to-white px-3 py-2 dark:from-neutral-900/80 dark:to-neutral-950",
          open && "border-b border-neutral-200/90 dark:border-neutral-700",
        )}
      >
        {staticPanel ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" stroke={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {title}
                </h2>
                {badge}
              </div>
              {hint ? (
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {hint}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="-m-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-md p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" stroke={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {title}
                </h2>
                {badge}
              </div>
              {hint ? (
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  {hint}
                </p>
              ) : null}
            </div>
            <span className="sr-only">
              {open ? t("common.collapse") : t("common.expand")}
            </span>
          </button>
        )}
        {headerActions ? (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerActions}
          </div>
        ) : null}
        {!staticPanel ? (
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t("common.collapse") : t("common.expand")}
            onClick={() => setOpen((v) => !v)}
          >
            <IconChevronDown
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        ) : null}
      </header>

      {open ? (
        <div id={panelId} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ) : null}
    </section>
  );
}
