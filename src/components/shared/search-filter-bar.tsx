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
  /** Override default search field width (e.g. `w-44 shrink-0`). */
  searchClassName?: string;
  /** Collapse mode only. Ignored when `flat`. */
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  /** Dot on filter btn when rank/wing/date (etc.) active. */
  filtersActive?: boolean;
  /** Stat tiles (collapse: after filter btn; flat: after fields). */
  tiles?: ReactNode;
  /** Hide built-in search (e.g. search lives in page header). */
  hideSearch?: boolean;
  /** Hide filter fields row (e.g. filters live in page header). */
  hideFilters?: boolean;
  /**
   * Put tiles on their own row and wrap to extra lines (no X-scroll).
   * Trailing (e.g. print) sits on the right of that row.
   */
  wrapTiles?: boolean;
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
  searchClassName,
  filtersOpen = false,
  onFiltersOpenChange,
  filtersActive = false,
  tiles,
  wrapTiles = false,
  hideSearch = false,
  hideFilters = false,
  trailing,
  children,
  flat = true,
  className,
}: Props) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const hasTopControls =
    !hideSearch ||
    (flat && !hideFilters) ||
    !flat ||
    Boolean(tiles && !wrapTiles);
  const trailingOnTileRow = Boolean(trailing && tiles && wrapTiles);

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50",
        className,
      )}
    >
      {hasTopControls || (trailing && !trailingOnTileRow) ? (
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
          {hideSearch ? null : (
            <div className={cn("w-64 shrink-0 sm:w-72", searchClassName)}>
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? t("common.search")}
                className={cn(fieldClass, "w-full")}
                aria-label={t("common.search")}
              />
            </div>
          )}

          {flat && !hideFilters ? (
            children
          ) : !flat ? (
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
          ) : null}

          {tiles && !wrapTiles ? (
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
              {tiles}
            </div>
          ) : null}
          {trailing && !trailingOnTileRow ? (
            <div className="shrink-0">{trailing}</div>
          ) : null}
        </div>
      ) : null}

      {tiles && wrapTiles ? (
        <div
          className={cn(
            "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start",
            hasTopControls || (trailing && !trailingOnTileRow)
              ? "mt-2.5 border-t border-neutral-200/80 pt-2.5 dark:border-neutral-700/80"
              : null,
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap content-start items-center gap-1.5">
            {tiles}
          </div>
          {trailingOnTileRow ? (
            <div className="shrink-0 self-end sm:self-start">{trailing}</div>
          ) : null}
        </div>
      ) : null}

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
