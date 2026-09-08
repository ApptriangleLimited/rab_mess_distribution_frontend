"use client";

import { useStore } from "@/hooks/use-store";
import { listAllTags } from "@/lib/store/rates";
import { tagCellClass } from "@/lib/tag-colors";
import { tagLabel } from "@/i18n";
import type { Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import type { DailyTag } from "@/lib/types";

/** Same colored chips Daily uses when painting a cockpit cell. */
export function ColoredTagGrid({
  value,
  onPick,
  locale,
  columns = 3,
  allowedTags,
}: {
  value?: DailyTag | "";
  onPick: (tag: DailyTag) => void;
  locale: Locale;
  columns?: 3 | 4;
  allowedTags?: readonly DailyTag[];
}) {
  const state = useStore();
  const tags = allowedTags?.length
    ? listAllTags().filter((code) => allowedTags.includes(code))
    : listAllTags();
  void state.rates;

  return (
    <div
      className={cn(
        "grid gap-1.5",
        columns === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {tags.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onPick(code)}
          className={cn(
            "rounded-md px-1.5 py-1.5 font-mono text-[11px] font-bold transition hover:opacity-90",
            tagCellClass(code),
            value === code && "ring-2 ring-primary ring-offset-1",
          )}
          title={tagLabel(code, locale)}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
