"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-xl font-semibold">{t("errors.appError")}</h2>
        <p className="text-sm text-neutral-600">{error.message}</p>
        <Button onClick={reset}>{t("common.tryAgain")}</Button>
      </body>
    </html>
  );
}
