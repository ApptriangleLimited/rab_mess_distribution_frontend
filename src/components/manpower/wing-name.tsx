import { wingLabelBn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";

/** Show Bangla wing; `title` keeps English link for hover / a11y. */
export function WingName({
  wing,
  className,
}: {
  /** Stored English wing / branch key. */
  wing: string;
  className?: string;
}) {
  const bn = wingLabelBn(wing);
  return (
    <span title={wing !== bn ? `${bn} · ${wing}` : wing} className={cn(className)}>
      {bn}
    </span>
  );
}
