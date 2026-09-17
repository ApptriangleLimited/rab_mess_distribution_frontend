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
        "border border-neutral-800 px-px py-0.5 text-center text-[7.5px] font-semibold leading-tight break-words",
        className,
      )}
    >
      {labelBn}
    </th>
  );
}
