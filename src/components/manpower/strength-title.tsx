import { formatDateDmy } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Paper header for Admin Wing / HQ Br daily strength (Form 2 / 3). */
export function StrengthReportTitle({
  titleBn,
  wingLabel,
  date,
  locale = "bn-BD",
  compact,
}: {
  titleBn: string;
  wingLabel: string;
  date: string;
  locale?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "relative text-center",
        compact
          ? "border-b border-neutral-800 pb-1 pr-16"
          : "border-b border-neutral-300 px-3 py-3 pr-28 dark:border-neutral-700",
      )}
    >
      <h2
        className={cn(
          "font-bold tracking-wide",
          compact ? "text-base" : "text-lg",
        )}
      >
        {titleBn}
      </h2>
      <p
        className={cn(
          "font-semibold",
          compact ? "mt-0.5 text-[11px]" : "mt-0.5 text-sm",
        )}
      >
        {wingLabel}
      </p>
      <p
        className={cn(
          "absolute right-3 top-2 font-medium tabular-nums",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        তারিখ {formatDateDmy(date, locale)}
      </p>
    </header>
  );
}
