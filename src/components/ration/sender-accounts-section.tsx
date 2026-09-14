"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import {
  createSenderApi,
  deleteSenderApi,
  listSenders,
  updateSenderApi,
} from "@/lib/api/settings";
import { DAILY_TAGS, FUEL_RATE_TAG } from "@/lib/constants";
import {
  createSender,
  isSenderActive,
  removeSender,
  updateSender,
  type SenderInput,
} from "@/lib/store/senders";
import type { DailyTag, SenderAccount } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn, digitsOnly } from "@/lib/utils";
import { BRANCH_DISTRICTS } from "@/lib/constants";
import { SearchableSelect } from "@/components/shared/searchable-select";

const emptyForm = (): Omit<SenderInput, "label"> => ({
  bank_name: "",
  account_name: "",
  account_number: "",
  routing: "",
  branch: "",
  branch_location: "",
  mapped_tags: [],
  active: true,
});

function senderTitle(sender: Pick<SenderAccount, "label" | "account_name" | "bank_name">) {
  return (
    sender.account_name.trim() ||
    sender.bank_name.trim() ||
    sender.label.trim() ||
    "—"
  );
}

function buildSenderInput(
  form: Omit<SenderInput, "label">,
): SenderInput | null {
  const label =
    form.account_name.trim() ||
    form.bank_name.trim() ||
    form.account_number.trim();
  if (!label) return null;
  return { ...form, label };
}

/** Org payout bank accounts — Settings (ration). */
export function SenderAccountsSection({
  static: staticPanel = false,
  rateTags,
}: {
  static?: boolean;
  rateTags?: DailyTag[];
} = {}) {
  const t = useT();
  const apiOn = isApiEnabled();
  const state = useStore();
  const { toast } = useToast();
  const [apiSenders, setApiSenders] = useState<SenderAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SenderInput, "label">>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(staticPanel);
  const [deleteTarget, setDeleteTarget] = useState<SenderAccount | null>(null);

  const senders = apiOn && apiSenders ? apiSenders : state.senders;
  const rawTagOptions =
    rateTags ??
    (state.rates.length > 0
      ? state.rates.map((r) => r.tag)
      : DAILY_TAGS.map((row) => row.code));
  const tagOptions = rawTagOptions.some(
    (code) => code.toLowerCase() === FUEL_RATE_TAG.toLowerCase(),
  )
    ? rawTagOptions
    : [...rawTagOptions, FUEL_RATE_TAG];

  useEffect(() => {
    if (!apiOn) return;
    let cancelled = false;
    setLoading(true);
    void listSenders()
      .then((res) => {
        if (cancelled) return;
        setApiSenders(res.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setApiSenders([]);
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load sender accounts from API.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, toast]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setSectionOpen(true);
    setShowForm(true);
  }

  function startEdit(sender: SenderAccount) {
    setEditingId(sender.id);
    setForm({
      bank_name: sender.bank_name,
      account_name: sender.account_name,
      account_number: sender.account_number,
      routing: sender.routing,
      branch: sender.branch,
      branch_location: sender.branch_location ?? "",
      mapped_tags: [...sender.mapped_tags],
      active: isSenderActive(sender),
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

  async function onSave() {
    const payload = buildSenderInput(form);
    if (!payload) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    if (apiOn) {
      try {
        if (editingId) {
          const updated = await updateSenderApi(editingId, payload);
          setApiSenders((prev) =>
            (prev ?? []).map((row) => (row.id === editingId ? updated : row)),
          );
        } else {
          const created = await createSenderApi(payload);
          setApiSenders((prev) => [...(prev ?? []), created]);
        }
        toast(t("ration.savedSender"), "success");
        closeForm();
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not save sender account.";
        toast(detail, "error");
      }
      return;
    }
    if (editingId) updateSender(editingId, payload);
    else createSender(payload);
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
      hint={t("pages.senders.subtitle", { count: senders.length })}
      open={staticPanel ? true : sectionOpen}
      onOpenChange={staticPanel ? undefined : setSectionOpen}
      static={staticPanel}
      badge={
        <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
          {senders.length}
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
        {loading ? (
          <div className="px-3 py-8 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </div>
        ) : senders.length === 0 ? (
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
            {senders.map((sender) => (
              <li
                key={sender.id}
                className={cn(
                  "group px-3 py-2.5 transition hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]",
                  !isSenderActive(sender) && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm text-neutral-900 dark:text-white">
                        {sender.bank_name.trim() ? (
                          <>
                            <span className="font-semibold">
                              {sender.bank_name.trim()}
                            </span>
                            {sender.account_name.trim() ? (
                              <span className="font-normal text-neutral-600 dark:text-neutral-300">
                                {" · "}
                                {sender.account_name.trim()}
                              </span>
                            ) : null}
                          </>
                        ) : sender.account_name.trim() ? (
                          <span className="font-normal text-neutral-600 dark:text-neutral-300">
                            {sender.account_name.trim()}
                          </span>
                        ) : (
                          <span className="font-semibold">
                            {sender.label.trim() || "—"}
                          </span>
                        )}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          isSenderActive(sender)
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                        )}
                      >
                        {isSenderActive(sender)
                          ? t("cc.statusActive")
                          : t("cc.statusInactive")}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[13px] font-medium tracking-wide text-primary">
                      {sender.account_number || "—"}
                    </p>
                    {sender.branch.trim() ? (
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {sender.branch.trim()}
                        {sender.branch_location?.trim()
                          ? ` · ${sender.branch_location.trim()}`
                          : ""}
                      </p>
                    ) : sender.branch_location?.trim() ? (
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {sender.branch_location.trim()}
                      </p>
                    ) : null}
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
                ["bank_name", t("cc.fields.bankName")],
                ["account_name", t("cc.fields.accountName")],
                ["account_number", t("cc.fields.accountNumber")],
                ["routing", t("cc.fields.routing")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [key]:
                        key === "account_number" || key === "routing"
                          ? digitsOnly(e.target.value)
                          : e.target.value,
                    }))
                  }
                  inputMode={
                    key === "account_number" || key === "routing"
                      ? "numeric"
                      : undefined
                  }
                  className="h-9 rounded-lg font-mono text-sm"
                  placeholder={
                    key === "account_name"
                      ? t("cc.placeholders.accountName")
                      : undefined
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-neutral-500">
                {t("cc.fields.branch")}
              </Label>
              <SearchableSelect
                options={BRANCH_DISTRICTS}
                value={form.branch}
                onChange={(v) => setForm((prev) => ({ ...prev, branch: v }))}
                placeholder={t("cc.selectBranchDistrict")}
                triggerClassName="h-9 rounded-lg font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[11px] text-neutral-500">
                {t("cc.fields.branchLocation")}
              </Label>
              <Input
                value={form.branch_location}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    branch_location: e.target.value,
                  }))
                }
                className="h-9 rounded-lg text-sm"
                placeholder={t("cc.placeholders.branchLocation")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("cc.fields.status")}
            </Label>
            <Select
              value={form.active !== false ? "1" : "0"}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, active: v === "1" }))
              }
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
                <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-neutral-500">
              {t("ration.mappedTags")}
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagOptions.map((code) => {
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
          label: deleteTarget ? senderTitle(deleteTarget) : "",
        })}
        confirmLabel={t("ration.deleteSender")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (apiOn) {
            try {
              await deleteSenderApi(deleteTarget.id);
              setApiSenders((prev) =>
                (prev ?? []).filter((row) => row.id !== deleteTarget.id),
              );
              toast(t("ration.deletedSender"), "success");
            } catch (err) {
              const detail =
                err instanceof ApiClientError
                  ? err.detail
                  : "Could not delete sender account.";
              toast(detail, "error");
            }
          } else {
            removeSender(deleteTarget.id);
            toast(t("ration.deletedSender"), "success");
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
