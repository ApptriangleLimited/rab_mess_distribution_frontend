"use client";

import {
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/** Prev / next + “Showing x–y of n” under list tables. */
export function ListPagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
  className,
}: Props) {
  const t = useT();
  if (total === 0 || totalPages <= 1) return null;

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
    </div>
  );
}
