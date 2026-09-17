"use client";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ManpowerVerifiedByFooter({
  show,
  className,
}: {
  show: boolean;
  className?: string;
}) {
  const t = useT();
  if (!show) return null;
  return (
    <div
      className={cn(
        "mt-8 flex justify-end pt-2 text-right text-[11px] leading-tight",
        className,
      )}
    >
      <div className="min-w-[14rem]">
        <p className="mb-10 border-b border-neutral-800" />
        <p className="font-semibold">{t("paperReports.verifiedByDeputy")}</p>
      </div>
    </div>
  );
}
