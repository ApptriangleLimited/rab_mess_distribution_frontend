import { cn } from "@/lib/utils";

export function NavCountBadge({
  count,
  tone = "menu",
}: {
  count: number;
  /** `menu` = sidebar; `tab` / `tabActive` = header tabs. */
  tone?: "menu" | "tab" | "tabActive";
}) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-px text-[10px] font-extrabold tabular-nums leading-4",
        tone === "menu" &&
          "bg-amber-500 text-white shadow-sm dark:bg-amber-400 dark:text-amber-950",
        tone === "tab" &&
          "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
        tone === "tabActive" && "bg-white/25 text-white",
      )}
    >
      {label}
    </span>
  );
}
