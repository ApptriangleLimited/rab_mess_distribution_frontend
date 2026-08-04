"use client";

import { tagCellClass } from "@/components/daily/register-board";
import { useStore } from "@/hooks/use-store";
import { listAllTags } from "@/lib/store/rates";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type TagTabStat = {
  tag: DailyTag;
  days: number;
  users: number;
  amount: number;
};

export type ConsumeTagTab = DailyTag | "all";

type Props = {
  value: ConsumeTagTab | null;
  onChange: (tag: ConsumeTagTab) => void;
  /** Tags with data stay vivid; empty tags dim when stats passed. */
  stats?: TagTabStat[];
  className?: string;
};

/** By-tag tabs — All + code-only stamps. */
export function ConsumeTagTabs({ value, onChange, stats, className }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const tags = listAllTags();
  const byCode = new Map((stats ?? []).map((s) => [s.tag, s]));
  void state.rates;

  return (
    <nav
      className={cn("flex w-full flex-wrap gap-1.5", className)}
      aria-label={t("consume.byTag")}
    >
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={cn(
          "rounded-lg border px-2.5 py-1.5 text-xs font-bold tracking-wide transition",
          value === "all"
            ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-950"
            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
        )}
      >
        {t("common.all")}
      </button>

      {tags.map((code) => {
        const active = value === code;
        const quiet = stats != null && !byCode.has(code);

        return (
          <button
            key={code}
            type="button"
            title={tagLabel(code, locale)}
            aria-pressed={active}
            aria-label={`${code} ${tagLabel(code, locale)}`}
            onClick={() => onChange(code)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold tracking-wide transition",
              tagCellClass(code),
              active
                ? "ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-950"
                : "opacity-80 hover:opacity-100",
              quiet && !active && "opacity-35 hover:opacity-55",
            )}
          >
            {code}
          </button>
        );
      })}
    </nav>
  );
}
