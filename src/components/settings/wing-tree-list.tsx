"use client";

import { useState } from "react";
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
import { WING_LABELS, wingDisplayLabel } from "@/lib/constants";
import { wingSettingsLabel } from "@/lib/rank-labels";
import {
  addWing,
  listWingChildren,
  removeWing,
  renameWing,
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
  const display = wingSettingsLabel(label);

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
          {hasChildren ? (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-neutral-900 hover:text-primary dark:text-white"
              onClick={toggleOpen}
              title={display}
            >
              {display}
            </button>
          ) : (
            <span
              className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 dark:text-white"
              title={display}
            >
              {display}
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
  const roots = listWingChildren(null);

  const [formOpen, setFormOpen] = useState(false);
  const [parentWing, setParentWing] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formFull, setFormFull] = useState("");
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  function startCreateRoot() {
    setParentWing(null);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
    setFormOpen(true);
  }

  function startAddChild(parent: string) {
    setParentWing(parent);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
    setFormOpen(true);
  }

  function startEdit(label: string) {
    setParentWing(null);
    setEditingLabel(label);
    setFormValue(label);
    setFormFull(
      state.wing_labels[label] ?? WING_LABELS[label] ?? "",
    );
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setParentWing(null);
    setEditingLabel(null);
    setFormValue("");
    setFormFull("");
  }

  function onSave() {
    const label = formValue.trim();
    const full = formFull.trim();
    if (!label) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    if (editingLabel) {
      if (label === editingLabel && full === (state.wing_labels[editingLabel] ?? WING_LABELS[editingLabel] ?? "")) {
        closeForm();
        return;
      }
      if (!renameWing(editingLabel, label, full || undefined)) {
        toast(t("settings.orgLabelDuplicate"), "error");
        return;
      }
      toast(t("settings.orgLabelSaved"), "success");
      closeForm();
      return;
    }
    const created = addWing(label, parentWing, full || undefined);
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
              {t("settings.wingShortName")}
            </Label>
            <Input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder={t("settings.wingPlaceholder")}
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
