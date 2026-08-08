"use client";

import { IconFilterOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

/** Compact clear-filters control for filter bars. */
export function ClearFiltersButton({ onClick, disabled, className }: Props) {
  const t = useT();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "h-10 w-10 shrink-0 rounded-xl text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100",
        className,
      )}
      aria-label={t("common.clearFilters")}
      title={t("common.clearFilters")}
      onClick={onClick}
      disabled={disabled}
    >
      <IconFilterOff className="h-4 w-4" />
    </Button>
  );
}
