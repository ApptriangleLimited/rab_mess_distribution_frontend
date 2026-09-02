"use client";

import { useState } from "react";
import {
  IconBuildingBank,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { useToast } from "@/components/shared/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/hooks/use-store";
import {
  addMemberBank,
  removeMemberBank,
  renameMemberBank,
} from "@/lib/store/org-options";
import { useT } from "@/i18n/provider";

/** Member bank-name catalog — Settings (ration). Used on register form. */
export function MemberBanksSection({
  static: staticPanel = false,
}: {
  static?: boolean;
} = {}) {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const [sectionOpen, setSectionOpen] = useState(staticPanel);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [formValue, setFormValue] = useState("");
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  function startCreate() {
    setEditingLabel(null);
    setFormValue("");
    setFormOpen(true);
  }

  function startEdit(label: string) {
    setEditingLabel(label);
    setFormValue(label);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingLabel(null);
    setFormValue("");
  }

  function onSave() {
    const label = formValue.trim();
    if (!label) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    if (editingLabel) {
      if (label === editingLabel) {
        closeForm();
        return;
      }
      if (!renameMemberBank(editingLabel, label)) {
        toast(t("settings.orgLabelDuplicate"), "error");
        return;
      }
      toast(t("settings.orgLabelSaved"), "success");
      closeForm();
      return;
    }
    if (!addMemberBank(label)) {
      toast(t("settings.orgLabelDuplicate"), "error");
      return;
    }
    toast(t("settings.memberBankAdded"), "success");
    closeForm();
  }

  function onDelete() {
    if (!deleteLabel) return;
    removeMemberBank(deleteLabel);
    setDeleteLabel(null);
    toast(t("settings.memberBankDeleted"), "success");
  }

  return (
    <>
      <CollapsibleSection
        id="member-banks"
        className="scroll-mt-6"
        icon={IconBuildingBank}
        title={t("settings.memberBankTitle")}
        hint={t("settings.memberBankHint")}
        open={staticPanel ? true : sectionOpen}
        onOpenChange={staticPanel ? undefined : setSectionOpen}
        static={staticPanel}
        badge={
          <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
            {state.member_banks.length}
          </span>
        }
        headerActions={
          <Button
            variant="cta"
            size="sm"
            className="shrink-0 rounded-lg"
            onClick={startCreate}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("settings.addMemberBankName")}
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {state.member_banks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                <IconBuildingBank className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {t("settings.memberBankEmpty")}
              </p>
              <Button
                variant="cta"
                size="sm"
                className="rounded-lg"
                onClick={startCreate}
              >
                <IconPlus className="h-3.5 w-3.5" />
                {t("settings.addMemberBankName")}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {state.member_banks.map((label) => (
                <li
                  key={label}
                  className="group flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 dark:text-white">
                    {label}
                  </p>
                  <div className="flex shrink-0 gap-1 opacity-80 transition group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 rounded-lg p-0"
                      aria-label={t("common.edit")}
                      onClick={() => startEdit(label)}
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-8 w-8 rounded-lg p-0"
                      aria-label={t("common.delete")}
                      onClick={() => setDeleteLabel(label)}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleSection>

      <ConfirmDialog
        open={formOpen}
        title={
          editingLabel
            ? t("settings.editMemberBankNameTitle")
            : t("settings.addMemberBankNameTitle")
        }
        body={t("settings.memberBankFormBody")}
        confirmLabel={
          editingLabel ? t("common.save") : t("settings.addMemberBankName")
        }
        onCancel={closeForm}
        onConfirm={onSave}
      >
        <div className="space-y-1.5">
          <Label className="text-[11px] text-neutral-500">
            {t("cc.fields.bankName")}
          </Label>
          <Input
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            placeholder={t("settings.memberBankPlaceholder")}
            autoFocus
            className="h-9 rounded-lg text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteLabel}
        danger
        title={t("settings.deleteMemberBankTitle")}
        body={t("settings.deleteMemberBankBody", { name: deleteLabel ?? "" })}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleteLabel(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
