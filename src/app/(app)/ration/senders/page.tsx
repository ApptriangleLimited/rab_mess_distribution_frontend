"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { DAILY_TAGS } from "@/lib/constants";
import {
  createSender,
  removeSender,
  updateSender,
  type SenderInput,
} from "@/lib/store/senders";
import type { DailyTag, SenderAccount } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";

const emptyForm = (): SenderInput => ({
  label: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  routing: "",
  branch: "",
  mapped_tags: [],
});

export default function SendersPage() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SenderInput>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SenderAccount | null>(null);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
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
    setShowForm(true);
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
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  return (
    <PagePane>
      <PageHeader
        title={t("pages.senders.title")}
        subtitle={t("pages.senders.subtitle", { count: state.senders.length })}
        actions={
          <Button variant="cta" onClick={startCreate}>
            {t("ration.newSender")}
          </Button>
        }
      />

      {showForm ? (
        <SectionCard>
          <h2 className="mb-4 text-base font-semibold">
            {editingId ? t("ration.editSender") : t("ration.newSender")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Label>{t("ration.mappedTags")}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAILY_TAGS.map((tag) => {
                const on = form.mapped_tags.includes(tag.code);
                return (
                  <button
                    key={tag.code}
                    type="button"
                    onClick={() => toggleTag(tag.code)}
                    className={
                      on
                        ? "rounded-md bg-primary px-3 py-1 text-xs text-white"
                        : "rounded-md border border-neutral-300 px-3 py-1 text-xs"
                    }
                  >
                    {tag.code} — {tagLabel(tag.code, locale)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="cta" onClick={onSave}>
              {t("ration.saveSender")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {state.senders.length === 0 ? (
        <EmptyState
          title={t("ration.emptySenders")}
          action={
            <Button variant="cta" onClick={startCreate}>
              {t("ration.newSender")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.senders.map((sender) => (
            <SectionCard key={sender.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">
                    {sender.label}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {sender.bank_name} · {sender.account_number}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {sender.account_name} · {sender.branch}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(sender)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteTarget(sender)}
                  >
                    {t("ration.deleteSender")}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {sender.mapped_tags.map((tag) => (
                  <Badge key={tag} className="bg-primary/10 text-primary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

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
    </PagePane>
  );
}
