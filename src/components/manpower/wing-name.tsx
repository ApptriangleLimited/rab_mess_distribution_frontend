import { useStore } from "@/hooks/use-store";
import { wingLabelBn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";

/** Show Settings Bangla wing; `title` keeps English short for hover / a11y. */
export function WingName({
  wing,
  className,
}: {
  /** Stored English wing / branch key. */
  wing: string;
  className?: string;
}) {
  const state = useStore();
  const bn = wingLabelBn(wing, state.wing_labels_bn);
  return (
    <span title={wing !== bn ? `${bn} · ${wing}` : wing} className={cn(className)}>
      {bn}
    </span>
  );
}
