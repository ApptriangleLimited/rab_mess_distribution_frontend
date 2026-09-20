import { CONSUME_REPORT_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** HQ + place — one line, no repeated org name. */
export function consumeHqLine() {
  return `${CONSUME_REPORT_META.orgName}, ${CONSUME_REPORT_META.station}`;
}

/** Bill title first, then HQ / station. */
export function ConsumeReportMasthead({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "letter-masthead mb-10 whitespace-normal text-center [word-spacing:normal]",
        className,
      )}
    >
      <p className="text-sm font-bold leading-snug">{title}</p>
      <p className="mt-2 text-[11px] leading-snug text-neutral-700">
        {consumeHqLine()}
      </p>
    </header>
  );
}
