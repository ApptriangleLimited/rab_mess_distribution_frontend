import { tagDisplayClass } from "@/lib/trg-tone";
import { tagLabel } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DailyTag, TrgTone } from "@/lib/types";

export function TagChip({
  tag,
  tone,
  empty = "—",
}: {
  tag?: DailyTag | "";
  tone?: TrgTone | null;
  empty?: string;
}) {
  const { locale } = useI18n();
  if (!tag) {
    return (
      <span className="text-xs text-neutral-400 dark:text-neutral-500">
        {empty}
      </span>
    );
  }
  return (
    <span
      title={`${tag} — ${tagLabel(tag, locale)}`}
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold",
        tagDisplayClass(tag, tone),
      )}
    >
      {tag}
    </span>
  );
}
