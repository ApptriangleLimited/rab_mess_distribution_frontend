"use client";

import type { UserStatus } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ActiveInactiveToggle({
  value,
  onChange,
  className,
}: {
  value: UserStatus;
  onChange: (next: UserStatus) => void;
  className?: string;
}) {
  const t = useT();
  const active = value === "1";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? t("cc.statusActive") : t("cc.statusInactive")}
      onClick={() => onChange(active ? "0" : "1")}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 dark:border-neutral-600 dark:bg-neutral-900",
        className,
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-neutral-400" : "text-neutral-700 dark:text-neutral-200",
        )}
      >
        {t("cc.statusInactive")}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          active ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
            active ? "left-4" : "left-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-primary" : "text-neutral-400",
        )}
      >
        {t("cc.statusActive")}
      </span>
    </button>
  );
}
