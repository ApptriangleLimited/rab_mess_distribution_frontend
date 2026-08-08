"use client";

import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftMonthKey } from "@/lib/date";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { searchFilterFieldClass } from "@/components/shared/search-filter-bar";

type Props = {
  month: string;
  onChange: (month: string) => void;
  /** aria-label for month input */
  label?: string;
  className?: string;
};

/** Prev · month input · next for filter bars. */
export function MonthNav({ month, onChange, label, className }: Props) {
  const t = useT();
  const fieldClass = searchFilterFieldClass;

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        aria-label={t("common.prevMonth")}
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative w-44 shrink-0">
        <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          type="month"
          value={month}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ?? t("consume.month")}
          className={cn(fieldClass, "w-full pl-8")}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        aria-label={t("common.nextMonth")}
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
