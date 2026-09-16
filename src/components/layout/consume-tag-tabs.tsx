"use client";

import {
  CONSUME_FILTERS,
  consumeFilterLabel,
  type ConsumeFilter,
} from "@/lib/consume-filters";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: ConsumeFilter;
  onChange: (filter: ConsumeFilter) => void;
  counts?: Partial<Record<ConsumeFilter, number>>;
  className?: string;
};

const LABEL_KEY = {
  "fr-mfr": "consume.filterFrMfr",
  cd: "consume.filterCd",
  "leave-med": "consume.filterLeaveMed",
} as const;

/** Three consume bills — not the old per-tag chip row. */
export function ConsumeTagTabs({ value, onChange, counts, className }: Props) {
  const t = useT();

  return (
    <nav
      className={cn("flex w-full flex-wrap gap-1.5", className)}
      aria-label={t("consume.byTag")}
    >
      {CONSUME_FILTERS.map((id) => {
        const active = value === id;
        const count = counts?.[id] ?? 0;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            title={consumeFilterLabel(id)}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold tracking-wide transition",
              active
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
            )}
          >
            {t(LABEL_KEY[id])}
            {count > 0 ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-px text-[10px] font-extrabold tabular-nums",
                  active ? "bg-white/20" : "bg-black/10 dark:bg-white/15",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
