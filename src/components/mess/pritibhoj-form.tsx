"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyPritibhojRow,
  finalizePritibhojRow,
  sumPritibhojRows,
} from "@/lib/pritibhoj-demo";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type { PritibhojRow } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const NUM_KEYS = [
  "officer",
  "dad",
  "azadHall",
  "distribution",
  "others",
  "civilian",
  "nonMuslim",
  "azadHallDist",
  "distribution2",
] as const;

type NumKey = (typeof NUM_KEYS)[number];

function parseCount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function patchRow(rows: PritibhojRow[], index: number, patch: Partial<PritibhojRow>) {
  return rows.map((row, i) =>
    i === index ? finalizePritibhojRow({ ...row, ...patch }) : row,
  );
}

function EditableTable({
  rows,
  onChange,
  footLabel,
}: {
  rows: PritibhojRow[];
  onChange: (rows: PritibhojRow[]) => void;
  footLabel: string;
}) {
  const t = useT();
  const totals = sumPritibhojRows(rows.map(finalizePritibhojRow));

  function setNum(index: number, key: NumKey, value: string) {
    onChange(patchRow(rows, index, { [key]: parseCount(value) }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 text-[11px] font-semibold dark:bg-neutral-800">
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              #
            </th>
            <th className="border border-neutral-300 px-2 py-2 text-left dark:border-neutral-600">
              {t("mess.pritibhoj.wing")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.officer")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.dad")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.azadHall")}
            </th>
            <th className="border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              {t("mess.pritibhoj.distribution")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.others")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.civilian")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.nonMuslim")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.total")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("mess.pritibhoj.azadHallDist")}
            </th>
            <th className="border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              {t("mess.pritibhoj.distribution2")}
            </th>
            <th className="border border-neutral-300 bg-amber-100 px-2 py-2 dark:border-neutral-600 dark:bg-amber-950/40">
              {t("mess.pritibhoj.totalDistribution")}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const live = finalizePritibhojRow(row);
            return (
              <tr key={`${row.wing}-${i}`}>
                <td className="border border-neutral-300 px-2 py-1 text-center tabular-nums dark:border-neutral-600">
                  {i + 1}
                </td>
                <td className="border border-neutral-300 p-1 dark:border-neutral-600">
                  <Input
                    value={row.wing}
                    onChange={(e) =>
                      onChange(patchRow(rows, i, { wing: e.target.value }))
                    }
                    className="h-8 min-w-[9rem] px-2"
                  />
                </td>
                {NUM_KEYS.slice(0, 7).map((key) => (
                  <td
                    key={key}
                    className={cn(
                      "border border-neutral-300 p-1 dark:border-neutral-600",
                      key === "distribution" && "bg-sky-50 dark:bg-sky-950/30",
                    )}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row[key] || ""}
                      onChange={(e) => setNum(i, key, e.target.value)}
                      className="h-8 px-1.5 text-center tabular-nums"
                    />
                  </td>
                ))}
                <td className="border border-neutral-300 px-2 py-1 text-center text-sm font-semibold tabular-nums dark:border-neutral-600">
                  {live.total}
                </td>
                {NUM_KEYS.slice(7).map((key) => (
                  <td
                    key={key}
                    className={cn(
                      "border border-neutral-300 p-1 dark:border-neutral-600",
                      key === "distribution2" && "bg-sky-50 dark:bg-sky-950/30",
                    )}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row[key] || ""}
                      onChange={(e) => setNum(i, key, e.target.value)}
                      className="h-8 px-1.5 text-center tabular-nums"
                    />
                  </td>
                ))}
                <td className="border border-neutral-300 bg-amber-50 px-2 py-1 text-center text-sm font-semibold tabular-nums dark:border-neutral-600 dark:bg-amber-950/30">
                  {live.totalDistribution}
                </td>
                <td className="border border-neutral-300 p-1 text-center dark:border-neutral-600">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    disabled={rows.length <= 1}
                    aria-label={t("mess.pritibhoj.removeRow")}
                    onClick={() =>
                      onChange(rows.filter((_, idx) => idx !== i))
                    }
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
          <tr className="bg-sky-50 font-semibold dark:bg-sky-950/40">
            <td
              colSpan={2}
              className="border border-neutral-300 px-2 py-2 dark:border-neutral-600"
            >
              {footLabel}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.officer}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.dad}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.azadHall}
            </td>
            <td className="border border-neutral-300 bg-sky-100 px-2 py-2 text-center tabular-nums dark:border-neutral-600 dark:bg-sky-950/50">
              {totals.distribution}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.others}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.civilian}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.nonMuslim}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.total}
            </td>
            <td className="border border-neutral-300 px-2 py-2 text-center tabular-nums dark:border-neutral-600">
              {totals.azadHallDist}
            </td>
            <td className="border border-neutral-300 bg-sky-100 px-2 py-2 text-center tabular-nums dark:border-neutral-600 dark:bg-sky-950/50">
              {totals.distribution2}
            </td>
            <td className="border border-neutral-300 bg-amber-100 px-2 py-2 text-center tabular-nums dark:border-neutral-600 dark:bg-amber-950/40">
              {totals.totalDistribution}
            </td>
            <td className="border border-neutral-300 dark:border-neutral-600" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PritibhojForm({
  value,
  onChange,
}: {
  value: PritibhojInput;
  onChange: (next: PritibhojInput) => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pb-title">{t("mess.pritibhoj.title")}</Label>
          <Input
            id="pb-title"
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder={t("mess.pritibhoj.titlePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pb-occasion">{t("mess.pritibhoj.occasion")}</Label>
          <Input
            id="pb-occasion"
            value={value.occasion}
            onChange={(e) => onChange({ ...value, occasion: e.target.value })}
            placeholder={t("mess.pritibhoj.occasionPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("mess.pritibhoj.date")}</Label>
          <DatePicker
            value={value.date}
            onChange={(date) => onChange({ ...value, date })}
            allowClear={false}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pb-org">{t("mess.pritibhoj.org")}</Label>
          <Input
            id="pb-org"
            value={value.org}
            onChange={(e) => onChange({ ...value, org: e.target.value })}
          />
        </div>
        <p className="text-xs text-neutral-500 sm:col-span-2">
          {t("mess.pritibhoj.formHint")}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.mainSheet")}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl"
            onClick={() =>
              onChange({
                ...value,
                main_rows: [...value.main_rows, emptyPritibhojRow("")],
              })
            }
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("mess.pritibhoj.addWing")}
          </Button>
        </div>
        <EditableTable
          rows={value.main_rows}
          onChange={(main_rows) => onChange({ ...value, main_rows })}
          footLabel={t("mess.pritibhoj.footMain")}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.adminSheet")}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl"
            onClick={() =>
              onChange({
                ...value,
                admin_rows: [...value.admin_rows, emptyPritibhojRow("")],
              })
            }
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("mess.pritibhoj.addWing")}
          </Button>
        </div>
        <EditableTable
          rows={value.admin_rows}
          onChange={(admin_rows) => onChange({ ...value, admin_rows })}
          footLabel={t("mess.pritibhoj.footAdmin")}
        />
      </section>
    </div>
  );
}
