"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CANONICAL_MEAL_SHIFT_NAMES,
  createMealShift,
  isCanonicalMealShift,
  mealShiftLabel,
  MealShiftFail,
  updateMealShift,
} from "@/lib/store/meal-shifts";
import type { MealShift } from "@/lib/types";
import { useT } from "@/i18n/provider";

export function ShiftDialog({
  open,
  shift,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  shift: MealShift | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const editing = Boolean(shift);
  const canonical = shift ? isCanonicalMealShift(shift.id) : false;
  const [name, setName] = useState("");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("09:00");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(
      shift
        ? mealShiftLabel(shift.id, shift.name, t)
        : "",
    );
    setStart(shift?.start_time ?? "06:00");
    setEnd(shift?.end_time ?? "09:00");
    setDescription(shift?.description ?? "");
  }, [open, shift, t]);

  function failMessage(err: unknown) {
    if (err instanceof MealShiftFail) {
      if (err.code === "EMPTY_NAME") return t("mess.shifts.nameRequired");
      if (err.code === "BAD_TIME") return t("mess.shifts.badTime");
      if (err.code === "OVERLAP") return t("mess.shifts.overlap");
      if (err.code === "NAME_TAKEN") return t("mess.shifts.nameTaken");
    }
    return t("mess.shifts.missing");
  }

  function onConfirm() {
    const input = {
      name:
        shift && isCanonicalMealShift(shift.id)
          ? CANONICAL_MEAL_SHIFT_NAMES[shift.id]
          : name,
      start_time: start,
      end_time: end,
      description,
    };
    try {
      if (editing && shift) updateMealShift(shift.id, input);
      else createMealShift(input);
      onSaved();
      onClose();
    } catch (err) {
      onError(failMessage(err));
    }
  }

  return (
    <ConfirmDialog
      open={open}
      tone="success"
      rootClassName="no-print"
      title={editing ? t("mess.shifts.editShift") : t("mess.shifts.newShift")}
      body={t("mess.shifts.formHint")}
      confirmLabel={t("common.save")}
      panelClassName="max-w-md"
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="shift-name">{t("mess.shifts.name")}</Label>
          <Input
            id="shift-name"
            value={name}
            disabled={canonical}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-start">{t("mess.shifts.start")}</Label>
            <Input
              id="shift-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 rounded-lg tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-end">{t("mess.shifts.end")}</Label>
            <Input
              id="shift-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 rounded-lg tabular-nums"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift-desc">{t("mess.shifts.description")}</Label>
          <Textarea
            id="shift-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[72px] rounded-lg"
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}
