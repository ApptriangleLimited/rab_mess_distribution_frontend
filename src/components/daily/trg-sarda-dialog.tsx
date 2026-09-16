"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function TrgToneHint({ black }: { black: boolean }) {
  const t = useT();
  return (
    <span
      className={cn(
        "ml-auto text-xs font-semibold",
        black ? "text-neutral-950 dark:text-white" : "text-red-600 dark:text-red-400",
      )}
    >
      {black ? t("daily.sardaBlack") : t("daily.sardaRed")}
    </span>
  );
}

export function TrgSardaDialog({
  open,
  name,
  showSarda = false,
  sardaChecked = false,
  trainingChecked,
  confirmLabel,
  onSardaChange,
  onTrainingChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  showSarda?: boolean;
  sardaChecked?: boolean;
  trainingChecked: boolean;
  confirmLabel?: string;
  onSardaChange?: (checked: boolean) => void;
  onTrainingChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();

  return (
    <ConfirmDialog
      open={open}
      tone="default"
      title={t("daily.trgPromptTitle")}
      body={
        showSarda
          ? t("daily.sardaBody", { name })
          : t("daily.trgPromptBody", { name })
      }
      confirmLabel={confirmLabel ?? t("daily.sardaConfirm")}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-2">
        {showSarda ? (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
            <input
              type="checkbox"
              checked={sardaChecked}
              onChange={(e) => onSardaChange?.(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
            />
            <span className="font-medium text-neutral-800 dark:text-neutral-100">
              {t("daily.sardaLabel")}
            </span>
            <TrgToneHint black={sardaChecked} />
          </label>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
          <input
            type="checkbox"
            checked={trainingChecked}
            onChange={(e) => onTrainingChange(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
          />
          <span className="font-medium text-neutral-800 dark:text-neutral-100">
            {t("daily.trainingLabel")}
          </span>
          <TrgToneHint black={trainingChecked} />
        </label>
      </div>
    </ConfirmDialog>
  );
}
