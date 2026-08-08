"use client";

import type { ReactNode } from "react";
import { IconFilter } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Collapse mode only. Ignored when `flat`. */
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  /** Dot on filter btn when rank/wing/date (etc.) active. */
  filtersActive?: boolean;
  /** Stat tiles (collapse: after filter btn; flat: after fields). */
  tiles?: ReactNode;
  /** Optional trailing control (e.g. print). */
  trailing?: ReactNode;
  /** Filter fields — inline when `flat`, else expand panel. */
  children: ReactNode;
  /** Few fields: show everything one row, no filter toggle. */
  flat?: boolean;
  className?: string;
};

const fieldClass =
  "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

/** Search · (filter | fields) · tiles · trailing. */
export function SearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  filtersOpen = false,
  onFiltersOpenChange,
  filtersActive = false,
  tiles,
  trailing,
  children,
  flat = true,
  className,
}: Props) {
  const t = useT();
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50",
        className,
      )}
    >
      <div className="flex w-full flex-nowrap items-center gap-2.5 overflow-x-auto">
        <div className="w-64 shrink-0 sm:w-72">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? t("common.search")}
            className={cn(fieldClass, "w-full")}
            aria-label={t("common.search")}
          />
        </div>

        {flat ? (
          children
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "relative h-10 w-10 shrink-0 rounded-xl",
              filtersOpen &&
                "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
            )}
            aria-label={
              filtersOpen ? t("common.hideFilters") : t("common.showFilters")
            }
            aria-expanded={filtersOpen}
            title={t("common.filters")}
            onClick={() => onFiltersOpenChange?.(!filtersOpen)}
          >
            <IconFilter className="h-4 w-4" />
            {filtersActive ? (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </Button>
        )}

        {tiles ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-2">
            {tiles}
          </div>
        ) : null}
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      {!flat ? (
        <AnimatePresence initial={false}>
          {filtersOpen ? (
            <motion.div
              key="filters"
              initial={
                reduceMotion ? false : { height: 0, opacity: 0, marginTop: 0 }
              }
              animate={{ height: "auto", opacity: 1, marginTop: 10 }}
              exit={
                reduceMotion
                  ? undefined
                  : { height: 0, opacity: 0, marginTop: 0 }
              }
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex w-full flex-nowrap items-center gap-2.5 overflow-x-auto border-t border-neutral-200/80 pt-2.5 dark:border-neutral-700/80">
                {children}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}

export { fieldClass as searchFilterFieldClass };
