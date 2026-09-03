"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useT } from "@/i18n/provider";

export function TrgSardaDialog({
  open,
  name,
  checked,
  confirmLabel,
  onCheckedChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  checked: boolean;
  confirmLabel?: string;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();

  return (
    <ConfirmDialog
      open={open}
      tone="default"
      title={t("daily.sardaTitle")}
      body={t("daily.sardaBody", { name })}
      confirmLabel={confirmLabel ?? t("daily.sardaConfirm")}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
        />
        <span className="font-medium text-neutral-800 dark:text-neutral-100">
          {t("daily.sardaLabel")}
        </span>
        <span className="ml-auto text-xs text-neutral-500">
          {checked ? t("daily.sardaBlack") : t("daily.sardaRed")}
        </span>
      </label>
    </ConfirmDialog>
  );
}
