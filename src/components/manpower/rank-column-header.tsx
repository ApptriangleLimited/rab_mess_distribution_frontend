import { cn } from "@/lib/utils";

/** Bangla column header only. Data matching stays English ids / Settings labels. */
export function RankColumnHeader({
  labelBn,
  className,
}: {
  labelBn: string;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border border-neutral-800 px-0.5 py-1 font-semibold",
        className,
      )}
    >
      {labelBn}
    </th>
  );
}
