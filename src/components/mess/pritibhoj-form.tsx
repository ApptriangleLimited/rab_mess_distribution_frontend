"use client";

import { IconRefresh } from "@tabler/icons-react";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { finalizePritibhojRow, sumPritibhojRows } from "@/lib/pritibhoj-demo";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type { PritibhojRow } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const INPUT_KEYS = ["officer", "azadHall", "azadHallDist"] as const;

type InputKey = (typeof INPUT_KEYS)[number];

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

function ReadCell({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border border-neutral-300 bg-neutral-50 px-2 py-1 text-center text-sm tabular-nums dark:border-neutral-600 dark:bg-neutral-900/70",
        className,
      )}
    >
      {value}
    </td>
  );
}

function NumberInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border border-neutral-300 p-1 dark:border-neutral-600",
        className,
      )}
    >
      <Input
        type="number"
        min={0}
        step={1}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-1.5 text-center tabular-nums"
      />
    </td>
  );
}

function EditableTable({
  rows,
  onChange,
  footLabel,
  othersHeader,
}: {
  rows: PritibhojRow[];
  onChange: (rows: PritibhojRow[]) => void;
  footLabel: string;
  othersHeader: string;
}) {
  const totals = sumPritibhojRows(rows.map(finalizePritibhojRow));

  function setNum(index: number, key: InputKey, value: string) {
    onChange(patchRow(rows, index, { [key]: parseCount(value) }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 text-[11px] font-semibold dark:bg-neutral-800">
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              ক্রমিক
            </th>
            <th className="border border-neutral-300 px-2 py-2 text-left dark:border-neutral-600">
              উইং/শাখা/সেল
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              অফিসার
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              ডিএডি
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              {othersHeader}
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              বেসামরিক
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              নন-মুসলিম
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              মোট
            </th>
            <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="border border-neutral-300 bg-amber-100 px-2 py-2 dark:border-neutral-600 dark:bg-amber-950/40">
              মোট বিতরণ
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
                <td className="border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-left font-medium dark:border-neutral-600 dark:bg-neutral-900/70">
                  {row.wing}
                </td>
                <NumberInput
                  value={row.officer}
                  onChange={(next) => setNum(i, "officer", next)}
                />
                <ReadCell value={live.dad} />
                <NumberInput
                  value={row.azadHall}
                  onChange={(next) => setNum(i, "azadHall", next)}
                />
                <ReadCell
                  value={live.distribution}
                  className="bg-sky-50 dark:bg-sky-950/30"
                />
                <ReadCell value={live.others} />
                <ReadCell value={live.civilian} />
                <ReadCell value={live.nonMuslim} />
                <ReadCell
                  value={live.total}
                  className="font-semibold"
                />
                <NumberInput
                  value={row.azadHallDist}
                  onChange={(next) => setNum(i, "azadHallDist", next)}
                />
                <ReadCell
                  value={live.distribution2}
                  className="bg-sky-50 dark:bg-sky-950/30"
                />
                <ReadCell
                  value={live.totalDistribution}
                  className="bg-amber-50 font-semibold dark:bg-amber-950/30"
                />
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
            <ReadCell value={totals.officer} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.dad} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.azadHall} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell
              value={totals.distribution}
              className="bg-sky-100 dark:bg-sky-950/50"
            />
            <ReadCell value={totals.others} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.civilian} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.nonMuslim} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.total} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell value={totals.azadHallDist} className="bg-sky-50 dark:bg-sky-950/40" />
            <ReadCell
              value={totals.distribution2}
              className="bg-sky-100 dark:bg-sky-950/50"
            />
            <ReadCell
              value={totals.totalDistribution}
              className="bg-amber-100 dark:bg-amber-950/40"
            />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PritibhojForm({
  value,
  onChange,
  onRefresh,
  refreshing = false,
}: {
  value: PritibhojInput;
  onChange: (next: PritibhojInput) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
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
          <div className="flex items-center gap-2">
            <DatePicker
              value={value.date}
              onChange={(date) => onChange({ ...value, date })}
              allowClear={false}
              className="min-w-0 flex-1"
            />
            {onRefresh ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 rounded-xl"
                disabled={refreshing}
                onClick={onRefresh}
              >
                <IconRefresh className="h-4 w-4" />
                {refreshing ? t("common.loading") : t("common.refresh")}
              </Button>
            ) : null}
          </div>
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
        <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.mainSheet")}</h2>
        </div>
        <EditableTable
          rows={value.main_rows}
          onChange={(main_rows) => onChange({ ...value, main_rows })}
          footLabel="মোট জনবল ="
          othersHeader="অন্যান্য"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.adminSheet")}</h2>
        </div>
        <EditableTable
          rows={value.admin_rows}
          onChange={(admin_rows) => onChange({ ...value, admin_rows })}
          footLabel="মোট ="
          othersHeader="অন্যান্য পদ"
        />
      </section>
    </div>
  );
}
