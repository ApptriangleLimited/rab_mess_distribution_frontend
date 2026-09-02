"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconClockHour4,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  SearchFilterBar,
} from "@/components/shared/search-filter-bar";
import { ShiftDialog } from "@/components/mess/shift-dialog";
import { MessTabs } from "@/components/layout/mess-tabs";
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

export default function MessShiftsClient() {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MealShift | null>(null);
  const [deleting, setDeleting] = useState<MealShift | null>(null);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return shifts;
    return shifts.filter((s) =>
      [
        mealShiftLabel(s.id, s.name, t),
        s.description,
        s.start_time,
        s.end_time,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [shifts, q, t]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(shift: MealShift) {
    setEditing(shift);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
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
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-violet-50/50 to-emerald-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messShifts.title")}
              subtitle={t("pages.messShifts.subtitle", {
                count: filtered.length,
              })}
              center={<MessTabs />}
              actions={
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  className="h-9 shrink-0 rounded-xl px-3 shadow-sm shadow-primary/20"
                  onClick={openCreate}
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("mess.shifts.newShift")}
                </Button>
              }
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("mess.shifts.searchPlaceholder")}
          searchClassName="w-64 shrink-0 sm:w-72"
        >
          <ClearFiltersButton
            disabled={!q.trim()}
            onClick={() => setQ("")}
          />
        </SearchFilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={t("mess.shifts.empty")}
            description={t("mess.shifts.emptyHint")}
            action={
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="h-9 rounded-xl px-3"
                onClick={openCreate}
              >
                <IconPlus className="h-3.5 w-3.5" />
                {t("mess.shifts.newShift")}
              </Button>
            }
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconClockHour4 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("pages.messShifts.title")}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("mess.shifts.name")}</th>
                    <th className="px-4 py-3">{t("mess.shifts.start")}</th>
                    <th className="px-4 py-3">{t("mess.shifts.end")}</th>
                    <th className="px-4 py-3">{t("mess.shifts.duration")}</th>
                    <th className="px-4 py-3">
                      {t("mess.shifts.description")}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shift) => {
                    const overnight =
                      shift.end_time <= shift.start_time;
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
                          {formatDuration(
                            shiftDurationMin(shift.start_time, shift.end_time),
                          )}
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
                              onClick={() => openEdit(shift)}
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
          </section>
        )}
      </motion.div>

      <ShiftDialog
        open={editorOpen}
        shift={editing}
        onClose={closeEditor}
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
    </PagePane>
  );
}
