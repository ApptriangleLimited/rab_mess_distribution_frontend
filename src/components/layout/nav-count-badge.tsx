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
          "bg-red-600 text-white shadow-sm dark:bg-red-500 dark:text-white",
        tone === "tab" &&
          "bg-red-600 text-white dark:bg-red-500 dark:text-white",
        tone === "tabActive" && "bg-white/25 text-white",
      )}
    >
      {label}
    </span>
  );
}
