"use client";

import { useMemo, useState } from "react";
import { IconClockHour4, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { ShiftDialog } from "@/components/mess/shift-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import {
  deleteMealShift,
  isCanonicalMealShift,
  isCurrentShift,
  listMealShifts,
  mealShiftLabel,
  MealShiftFail,
  shiftDurationMin,
} from "@/lib/store/meal-shifts";
import type { MealShift } from "@/lib/types";
import { useT } from "@/i18n/provider";

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function MealShiftsSection({
  static: staticPanel = false,
}: {
  static?: boolean;
} = {}) {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MealShift | null>(null);
  const [deleting, setDeleting] = useState<MealShift | null>(null);

  const shifts = useMemo(() => listMealShifts(), [state.meal_shifts]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function failMessage(err: unknown) {
    if (err instanceof MealShiftFail && err.code === "IN_USE") {
      return t("mess.shifts.inUse");
    }
    if (err instanceof MealShiftFail && err.code === "BUILTIN") {
      return t("mess.shifts.builtin");
    }
    return t("mess.shifts.missing");
  }

  return (
    <>
      <CollapsibleSection
        icon={IconClockHour4}
        title={t("settings.shiftsTitle")}
        hint={t("settings.shiftsHint")}
        static={staticPanel}
        className="border-primary/10 shadow-sm"
        badge={
          <span className="rounded-lg bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary">
            {shifts.length}
          </span>
        }
        headerActions={
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="h-9 shrink-0 rounded-xl shadow-sm shadow-primary/20"
            onClick={openCreate}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("mess.shifts.newShift")}
          </Button>
        }
      >
        {shifts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            {t("mess.shifts.emptyHint")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3">{t("mess.shifts.name")}</th>
                  <th className="px-4 py-3">{t("mess.shifts.start")}</th>
                  <th className="px-4 py-3">{t("mess.shifts.end")}</th>
                  <th className="px-4 py-3">{t("mess.shifts.duration")}</th>
                  <th className="px-4 py-3">{t("mess.shifts.description")}</th>
                  <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => {
                  const overnight = shift.end_time <= shift.start_time;
                  const current = isCurrentShift(shift);
                  return (
                    <tr
                      key={shift.id}
                      className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {mealShiftLabel(shift.id, shift.name, t)}
                          </p>
                          {current ? (
                            <Badge className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                              {t("mess.shifts.now")}
                            </Badge>
                          ) : null}
                          {overnight ? (
                            <Badge className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                              {t("mess.shifts.overnight")}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {shift.start_time}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {shift.end_time}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {formatDuration(shiftDurationMin(shift.start_time, shift.end_time))}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {shift.description || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            aria-label={t("mess.shifts.editShift")}
                            onClick={() => {
                              setEditing(shift);
                              setEditorOpen(true);
                            }}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                          {isCanonicalMealShift(shift.id) ? null : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-red-600 hover:text-red-700"
                              aria-label={t("mess.shifts.deleteShift")}
                              onClick={() => setDeleting(shift)}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <ShiftDialog
        open={editorOpen}
        shift={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={() => toast(t("mess.shifts.saved"), "success")}
        onError={(message) => toast(message, "error")}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title={t("confirm.deleteShiftTitle")}
        body={t("confirm.deleteShiftBody", { name: deleting?.name ?? "" })}
        confirmLabel={t("mess.shifts.deleteShift")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          try {
            deleteMealShift(deleting.id);
            toast(t("mess.shifts.deleted"), "success");
          } catch (err) {
            toast(failMessage(err), "error");
          }
          setDeleting(null);
        }}
      />
    </>
  );
}
