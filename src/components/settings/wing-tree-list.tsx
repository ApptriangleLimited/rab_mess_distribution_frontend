"use client";

import { useEffect, useState } from "react";
import {
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import {
  WING_LABELS,
  wingDisplayLabel,
  wingOfficialName,
  wingOfficialSerial,
} from "@/lib/constants";
import { wingLabelBn } from "@/lib/rank-labels";
import {
  addWing,
  listWingChildren,
  removeWing,
  renameWing,
  repairOfficialHqBranch,
} from "@/lib/store/org-options";
import { cn } from "@/lib/utils";

function WingNode({
  label,
  depth,
  onEdit,
  onDelete,
  onAddChild,
}: {
  label: string;
  depth: number;
  onEdit: (label: string) => void;
  onDelete: (label: string) => void;
  onAddChild: (parent: string) => void;
}) {
  const t = useT();
  const state = useStore();
  const children = listWingChildren(label);
  const [open, setOpen] = useState(false);
  const childCount = children.length;
  const hasChildren = childCount > 0;
  const pad = 12 + depth * 16;
  const serial = wingOfficialSerial(label, state.wing_serials);
  const official = wingOfficialName(label, state.wing_labels);
  const bn = wingLabelBn(label, state.wing_labels_bn);
  const showBn =
    bn &&
    bn.toLowerCase() !== official.toLowerCase() &&
    bn.toLowerCase() !== label.toLowerCase();
  const showShort =
    label.trim().toLowerCase() !== official.trim().toLowerCase();

  function toggleOpen() {
    if (!hasChildren) return;
    setOpen((v) => !v);
  }

  return (
    <li className="group border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
      <div
        className="flex items-center justify-between gap-2 py-2 pr-3"
        style={{ paddingLeft: pad }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-sm transition",
                "hover:bg-primary/15 hover:shadow-md hover:shadow-primary/10",
                "dark:border-primary/30 dark:bg-primary/20 dark:text-emerald-200",
                open && "bg-primary/15 ring-1 ring-primary/25 dark:bg-primary/25",
              )}
              aria-expanded={open}
              aria-label={open ? "Collapse" : "Expand"}
              onClick={toggleOpen}
            >
              <IconChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  open && "rotate-180",
                )}
                stroke={2.25}
              />
            </button>
          ) : (
            <span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
          )}
          {serial != null ? (
            <span
              className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900/10 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
              title={t("settings.wingSerial")}
            >
              {serial}
            </span>
          ) : (
            <span className="inline-flex h-7 w-7 shrink-0" aria-hidden />
          )}
          {hasChildren ? (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={toggleOpen}
              title={`${official}${showBn ? ` (${bn})` : ""}${showShort ? ` · ${label}` : ""}`}
            >
              <span className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary dark:text-white">
                {official}
                {showBn ? (
                  <span className="font-medium text-neutral-500"> ({bn})</span>
                ) : null}
              </span>
              {showShort ? (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-neutral-500">
                  {label}
                </span>
              ) : null}
            </button>
          ) : (
            <span
              className="min-w-0 flex-1 truncate"
              title={`${official}${showBn ? ` (${bn})` : ""}${showShort ? ` · ${label}` : ""}`}
            >
              <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {official}
                {showBn ? (
                  <span className="font-medium text-neutral-500"> ({bn})</span>
                ) : null}
              </span>
              {showShort ? (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-neutral-500">
                  {label}
                </span>
              ) : null}
            </span>
          )}
          {hasChildren ? (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {childCount}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1 opacity-80 transition group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() => onAddChild(label)}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("settings.addSubWing")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 rounded-lg p-0"
            aria-label={t("common.edit")}
            onClick={() => onEdit(label)}
          >
            <IconPencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="h-8 w-8 rounded-lg p-0"
            aria-label={t("common.delete")}
            onClick={() => onDelete(label)}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {open && hasChildren ? (
        <ul className="border-t border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/30">
          {children.map((child) => (
            <WingNode
              key={child}
              label={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WingTreeList() {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  useEffect(() => {
    repairOfficialHqBranch();
  }, []);
  const roots = listWingChildren(null);

  const [formOpen, setFormOpen] = useState(false);
  const [parentWing, setParentWing] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formFull, setFormFull] = useState("");
  const [formBangla, setFormBangla] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  function startCreateRoot() {
    setParentWing(null);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
    setFormBangla("");
    setFormSerial("");
    setFormOpen(true);
  }

  function startAddChild(parent: string) {
    setParentWing(parent);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
    setFormBangla("");
    setFormSerial("");
    setFormOpen(true);
  }

  function startEdit(label: string) {
    setParentWing(null);
    setEditingLabel(label);
    setFormValue(label);
    setFormFull(
      state.wing_labels[label] ?? WING_LABELS[label] ?? "",
    );
    setFormBangla(state.wing_labels_bn[label] ?? wingLabelBn(label));
    const serial = wingOfficialSerial(label, state.wing_serials);
    setFormSerial(serial != null ? String(serial) : "");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setParentWing(null);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
    setFormBangla("");
    setFormSerial("");
  }

  function parsedSerial() {
    const raw = formSerial.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }

  function onSave() {
    const full = formFull.trim();
    const label = formValue.trim() || full;
    const bangla = formBangla.trim();
    const serial = parsedSerial();
    if (!label) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    if (editingLabel) {
      if (
        label === editingLabel &&
        full === (state.wing_labels[editingLabel] ?? WING_LABELS[editingLabel] ?? "") &&
        bangla === (state.wing_labels_bn[editingLabel] ?? wingLabelBn(editingLabel)) &&
        serial === wingOfficialSerial(editingLabel, state.wing_serials)
      ) {
        closeForm();
        return;
      }
      if (!renameWing(editingLabel, label, full || undefined, bangla, serial)) {
        toast(t("settings.orgLabelDuplicate"), "error");
        return;
      }
      toast(t("settings.orgLabelSaved"), "success");
      closeForm();
      return;
    }
    const created = addWing(label, parentWing, full || undefined, bangla, serial);
    if (!created) {
      toast(t("settings.orgLabelDuplicate"), "error");
      return;
    }
    toast(
      t(parentWing ? "settings.subWingAdded" : "settings.wingAdded"),
      "success",
    );
    closeForm();
  }

  function onDelete() {
    if (!deleteLabel) return;
    removeWing(deleteLabel);
    setDeleteLabel(null);
    toast(t("settings.wingDeleted"), "success");
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
        <p className="text-[11px] text-neutral-500">
          <span className="mr-2 font-semibold text-neutral-600 dark:text-neutral-300">
            {t("settings.wingSerial")}
          </span>
          {t("settings.wingsTreeHint")}
        </p>
        <Button
          type="button"
          variant="cta"
          size="sm"
          className="shrink-0 rounded-lg"
          onClick={startCreateRoot}
        >
          <IconPlus className="h-3.5 w-3.5" />
          {t("settings.addWing")}
        </Button>
      </div>
      {roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {t("settings.orgListEmpty")}
          </p>
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="rounded-lg"
            onClick={startCreateRoot}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("settings.addWing")}
          </Button>
        </div>
      ) : (
        <ul>
          {roots.map((label) => (
            <WingNode
              key={`${label}:${state.wing_parent[label] ?? ""}:${listWingChildren(label).length}`}
              label={label}
              depth={0}
              onEdit={startEdit}
              onDelete={setDeleteLabel}
              onAddChild={startAddChild}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={formOpen}
        title={
          editingLabel
            ? t("settings.editWingTitle")
            : parentWing
              ? t("settings.addSubWingTitle")
              : t("settings.addWingTitle")
        }
        body={
          editingLabel
            ? t("settings.addWingBody")
            : parentWing
              ? t("settings.addSubWingBody", { parent: parentWing })
              : t("settings.addWingBody")
        }
        confirmLabel={
          editingLabel
            ? t("common.save")
            : parentWing
              ? t("settings.addSubWing")
              : t("settings.addWing")
        }
        onCancel={closeForm}
        onConfirm={onSave}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingSerialField")}
            </Label>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={formSerial}
              onChange={(e) => setFormSerial(e.target.value)}
              placeholder={t("settings.wingSerialPlaceholder")}
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
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingFullName")}
            </Label>
            <Input
              value={formFull}
              onChange={(e) => setFormFull(e.target.value)}
              placeholder={t("settings.wingFullPlaceholder")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingBanglaName")}
            </Label>
            <Input
              value={formBangla}
              onChange={(e) => setFormBangla(e.target.value)}
              placeholder={t("settings.wingBanglaPlaceholder")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingShortName")}
            </Label>
            <Input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder={t("settings.wingShortOptional")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteLabel)}
        title={t("settings.deleteWingTitle")}
        body={t("settings.deleteWingBodyCascade", {
          name: deleteLabel
            ? wingDisplayLabel(deleteLabel, state.wing_labels)
            : "",
        })}
        confirmLabel={t("common.delete")}
        danger
        onCancel={() => setDeleteLabel(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
