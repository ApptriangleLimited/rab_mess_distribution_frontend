"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <div className="page-pane items-start">
      <h2 className="text-xl font-semibold text-red-700">{t("errors.somethingBroke")}</h2>
      <p className="text-sm text-neutral-600">{error.message}</p>
      <Button variant="cta" onClick={reset}>
        {t("common.tryAgain")}
      </Button>
    </div>
  );
}
