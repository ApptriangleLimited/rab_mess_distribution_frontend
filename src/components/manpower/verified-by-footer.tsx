"use client";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ManpowerVerifiedWatermark({
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
        "manpower-verified-watermark pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div className="absolute left-1/2 top-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] text-center text-[13vw] font-black uppercase tracking-[0.18em] text-emerald-800/[0.12] print:text-[42mm] print:text-emerald-800/[0.14]">
        {t("paperReports.approved")}
      </div>
    </div>
  );
}

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
        "relative z-[1] mt-8 flex justify-end pt-2 text-right text-[11px] leading-tight",
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
