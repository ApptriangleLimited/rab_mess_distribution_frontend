"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useT } from "@/i18n/provider";
import { WR_CODES, type WrCode } from "@/lib/wr-code";
import { cn } from "@/lib/utils";

export function WrCodeDialog({
  open,
  name,
  onPick,
  onCancel,
}: {
  open: boolean;
  name: string;
  onPick: (code: WrCode) => void;
  onCancel: () => void;
}) {
  const t = useT();

  return (
    <ConfirmDialog
      open={open}
      tone="default"
      title={t("daily.wrPromptTitle")}
      body={t("daily.wrPromptBody", { name })}
      confirmLabel={t("common.cancel")}
      hideConfirm
      onConfirm={onCancel}
      onCancel={onCancel}
      panelClassName="max-w-lg"
    >
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {WR_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onPick(code)}
            className={cn(
              "h-10 rounded-xl border border-stone-200 bg-stone-100 text-sm font-bold tracking-wide text-stone-900 shadow-sm transition",
              "hover:border-primary/40 hover:bg-white hover:text-primary",
              "dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
            )}
          >
            WR {code}
          </button>
        ))}
      </div>
    </ConfirmDialog>
  );
}
