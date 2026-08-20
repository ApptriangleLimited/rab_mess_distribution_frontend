"use client";

import {
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
};

/** Prev / next + “Showing x–y of n” (+ optional per-page) under list tables. */
export function ListPagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: Props) {
  const t = useT();
  const showSize = pageSize != null && onPageSizeChange != null;
  if (total === 0) return null;
  if (totalPages <= 1 && !showSize) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 dark:border-neutral-800",
        className,
      )}
    >
      <p className="text-xs tabular-nums text-neutral-500">
        {t("common.showingRange", { from, to, count: total })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {showSize ? (
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="whitespace-nowrap">{t("common.perPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs tabular-nums shadow-none focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={t("common.perPage")}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {totalPages > 1 ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              aria-label={t("common.prevPage")}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
              {t("common.pageOf", { page, total: totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              aria-label={t("common.nextPage")}
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
