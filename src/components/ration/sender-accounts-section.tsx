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
import { DAILY_TAGS } from "@/lib/constants";
import {
  createSender,
  removeSender,
  updateSender,
  type SenderInput,
} from "@/lib/store/senders";
import type { DailyTag, SenderAccount } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const emptyForm = (): SenderInput => ({
  label: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  routing: "",
  branch: "",
  mapped_tags: [],
});

/** Org payout bank accounts — Settings left pane (ration). */
export function SenderAccountsSection() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SenderInput>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SenderAccount | null>(null);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setSectionOpen(true);
    setShowForm(true);
  }

  function startEdit(sender: SenderAccount) {
    setEditingId(sender.id);
    setForm({
      label: sender.label,
      bank_name: sender.bank_name,
      account_name: sender.account_name,
      account_number: sender.account_number,
      routing: sender.routing,
      branch: sender.branch,
      mapped_tags: [...sender.mapped_tags],
    });
    setSectionOpen(true);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function toggleTag(tag: DailyTag) {
    setForm((prev) => ({
      ...prev,
      mapped_tags: prev.mapped_tags.includes(tag)
        ? prev.mapped_tags.filter((x) => x !== tag)
        : [...prev.mapped_tags, tag],
    }));
  }

  function onSave() {
    if (!form.label.trim()) return;
    if (editingId) updateSender(editingId, form);
    else createSender(form);
    toast(t("ration.savedSender"), "success");
    closeForm();
  }

  return (
    <>
    <CollapsibleSection
      id="bank-accounts"
      className="scroll-mt-6"
      icon={IconBuildingBank}
      title={t("pages.senders.title")}
      hint={t("pages.senders.subtitle", { count: state.senders.length })}
      open={sectionOpen}
      onOpenChange={setSectionOpen}
      badge={
        <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
          {state.senders.length}
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
          {t("ration.newSender")}
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {state.senders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
              <IconBuildingBank className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {t("ration.emptySenders")}
            </p>
            <Button
              variant="cta"
              size="sm"
              className="rounded-lg"
              onClick={startCreate}
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t("ration.newSender")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {state.senders.map((sender) => (
              <li
                key={sender.id}
                className="group px-3 py-2.5 transition hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                      {sender.label}
                    </p>
                    <p className="mt-0.5 font-mono text-[13px] font-medium tracking-wide text-primary">
                      {sender.account_number || "—"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {[sender.bank_name, sender.account_name, sender.branch]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    {sender.mapped_tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sender.mapped_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-primary/20 bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-80 transition group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 rounded-lg p-0"
                      aria-label={t("common.edit")}
                      onClick={() => startEdit(sender)}
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-8 w-8 rounded-lg p-0"
                      aria-label={t("ration.deleteSender")}
                      onClick={() => setDeleteTarget(sender)}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleSection>

      <ConfirmDialog
        open={showForm}
        tone="default"
        title={editingId ? t("ration.editSender") : t("ration.newSender")}
        body={t("ration.reportHint")}
        confirmLabel={t("ration.saveSender")}
        panelClassName="max-w-[33.6rem]"
        onCancel={closeForm}
        onConfirm={onSave}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["label", t("ration.label")],
                ["bank_name", t("cc.fields.bankName")],
                ["account_name", t("cc.fields.accountName")],
                ["account_number", t("cc.fields.accountNumber")],
                ["routing", t("cc.fields.routing")],
                ["branch", t("cc.fields.branch")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-[11px] text-neutral-500">
              {t("ration.mappedTags")}
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                state.rates.length > 0
                  ? state.rates.map((r) => r.tag)
                  : DAILY_TAGS.map((t) => t.code)
              ).map((code) => {
                const on = form.mapped_tags.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleTag(code)}
                    className={cn(
                      "rounded-md px-2 py-1 font-mono text-[11px] font-semibold tracking-wide transition",
                      on
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "border border-neutral-200 bg-white text-neutral-500 hover:border-primary/40 dark:border-neutral-600 dark:bg-neutral-900",
                    )}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={t("confirm.deleteSenderTitle")}
        body={t("confirm.deleteSenderBody", {
          label: deleteTarget?.label ?? "",
        })}
        confirmLabel={t("ration.deleteSender")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            removeSender(deleteTarget.id);
            toast(t("ration.deletedSender"), "success");
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
