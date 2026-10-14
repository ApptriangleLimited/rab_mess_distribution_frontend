"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LoadingScreen({
  label,
  overlay = false,
  className,
}: {
  label?: string;
  overlay?: boolean;
  className?: string;
}) {
  const t = useT();
  const text = label ?? t("common.loadingData");

  const body = (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15">
        <IconLoader2 className="h-7 w-7 animate-spin" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {text}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {t("common.loading")}
        </p>
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-[2px] dark:bg-neutral-950/70",
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[18rem] w-full items-center justify-center",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {body}
    </div>
  );
}
