"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";

export default function NotFound() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">{t("errors.pageNotFound")}</h1>
      <Button asChild variant="cta">
        <Link href="/login">{t("common.backToLogin")}</Link>
      </Button>
    </div>
  );
}
