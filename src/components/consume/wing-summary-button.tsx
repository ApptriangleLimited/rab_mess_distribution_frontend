"use client";

import Link from "next/link";
import { IconFileReport } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";

type Props = {
  month: string;
  wing: string;
  back: string;
  className?: string;
};

export function wingSummaryHref(month: string, wing: string, back: string) {
  const params = new URLSearchParams({ month, wing, back });
  return `/consume/monthly/wing-summary/print?${params.toString()}`;
}

/** Shown only when a specific consume wing filter is selected. */
export function WingSummaryButton({ month, wing, back, className }: Props) {
  const t = useT();
  if (!wing || wing === "all") return null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={className ?? "h-8 shrink-0 rounded-lg"}
    >
      <Link href={wingSummaryHref(month, wing, back)}>
        <IconFileReport className="h-3.5 w-3.5" />
        {t("consume.wingSummary")}
      </Link>
    </Button>
  );
}
