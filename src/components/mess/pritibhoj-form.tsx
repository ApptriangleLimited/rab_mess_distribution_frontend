"use client";

import { useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { PritibhojMemberDialog } from "@/components/mess/pritibhoj-member-dialog";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { finalizePritibhojRow, sumPritibhojRows } from "@/lib/pritibhoj-demo";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import type {
  PritibhojColumn,
  PritibhojRoster,
  PritibhojRow,
  PritibhojSheetId,
} from "@/lib/types";
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
  onOpen,
}: {
  value: number;
  className?: string;
  onOpen?: () => void;
}) {
  return (
    <td
      className={cn(
        "border border-neutral-300 bg-neutral-50 px-1 py-1 text-center text-sm tabular-nums dark:border-neutral-600 dark:bg-neutral-900/70",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          className="w-full rounded-md bg-transparent font-[inherit] text-inherit underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {value}
        </button>
      ) : (
        value
      )}
    </td>
  );
}

function NumberInput({
  value,
  onChange,
  onOpen,
  className,
}: {
  value: number;
  onChange: (next: string) => void;
  onOpen?: () => void;
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
      {onOpen ? (
        <button
          type="button"
          className="mt-0.5 w-full text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {value}
        </button>
      ) : null}
    </td>
  );
}

function EditableTable({
  rows,
  onChange,
  footLabel,
  othersHeader,
  onOpen,
}: {
  rows: PritibhojRow[];
  onChange: (rows: PritibhojRow[]) => void;
  footLabel: string;
  othersHeader: string;
  onOpen?: (wing: string, column: PritibhojColumn, count: number) => void;
}) {
  const totals = sumPritibhojRows(rows.map(finalizePritibhojRow));

  function setNum(index: number, key: InputKey, value: string) {
    onChange(patchRow(rows, index, { [key]: parseCount(value) }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs [&_th]:whitespace-nowrap [&_th]:px-1.5">
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
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "officer", live.officer)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.dad}
                  onOpen={
                    onOpen ? () => onOpen(row.wing, "dad", live.dad) : undefined
                  }
                />
                <NumberInput
                  value={row.azadHall}
                  onChange={(next) => setNum(i, "azadHall", next)}
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "azadHall", live.azadHall)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.distribution}
                  className="bg-sky-50 dark:bg-sky-950/30"
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "distribution", live.distribution)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.others}
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "others", live.others)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.civilian}
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "civilian", live.civilian)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.nonMuslim}
                  onOpen={
                    onOpen
                      ? () =>
                          onOpen(row.wing, "nonMuslim", live.nonMuslim)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.total}
                  className="font-semibold"
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, "total", live.total)
                      : undefined
                  }
                />
                <NumberInput
                  value={row.azadHallDist}
                  onChange={(next) => setNum(i, "azadHallDist", next)}
                  onOpen={
                    onOpen
                      ? () =>
                          onOpen(row.wing, "azadHallDist", live.azadHallDist)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.distribution2}
                  className="bg-sky-50 dark:bg-sky-950/30"
                  onOpen={
                    onOpen
                      ? () =>
                          onOpen(row.wing, "distribution2", live.distribution2)
                      : undefined
                  }
                />
                <ReadCell
                  value={live.totalDistribution}
                  className="bg-amber-50 font-semibold dark:bg-amber-950/30"
                  onOpen={
                    onOpen
                      ? () =>
                          onOpen(
                            row.wing,
                            "totalDistribution",
                            live.totalDistribution,
                          )
                      : undefined
                  }
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
            {(
              [
                "officer",
                "dad",
                "azadHall",
                "distribution",
                "others",
                "civilian",
                "nonMuslim",
                "total",
                "azadHallDist",
                "distribution2",
                "totalDistribution",
              ] as const
            ).map((column) => (
              <ReadCell
                key={column}
                value={totals[column]}
                className={
                  column === "distribution" || column === "distribution2"
                    ? "bg-sky-100 dark:bg-sky-950/50"
                    : column === "totalDistribution"
                      ? "bg-amber-100 dark:bg-amber-950/40"
                      : "bg-sky-50 dark:bg-sky-950/40"
                }
                onOpen={
                  onOpen
                    ? () => onOpen("*", column, totals[column])
                    : undefined
                }
              />
            ))}
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
  ctx,
  onRoster,
}: {
  value: PritibhojInput;
  onChange: (next: PritibhojInput) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  ctx?: PritibhojCountCtx | null;
  onRoster?: (roster: PritibhojRoster) => Promise<void> | void;
}) {
  const t = useT();
  const [open, setOpen] = useState<{
    sheet: PritibhojSheetId;
    wing: string;
    column: PritibhojColumn;
    count: number;
  } | null>(null);
  const interactive = Boolean(ctx && ctx.users.length > 0 && onRoster);

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

      <section className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.mainSheet")}</h2>
        </div>
        <EditableTable
          rows={value.main_rows}
          onChange={(main_rows) => onChange({ ...value, main_rows })}
          footLabel="মোট জনবল ="
          othersHeader="অন্যান্য পদ"
          onOpen={
            interactive
              ? (wing, column, count) =>
                  setOpen({ sheet: "main", wing, column, count })
              : undefined
          }
        />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t("mess.pritibhoj.adminSheet")}</h2>
        </div>
        <EditableTable
          rows={value.admin_rows}
          onChange={(admin_rows) => onChange({ ...value, admin_rows })}
          footLabel="মোট ="
          othersHeader="অন্যান্য পদ"
          onOpen={
            interactive
              ? (wing, column, count) =>
                  setOpen({ sheet: "admin", wing, column, count })
              : undefined
          }
        />
      </section>
      {open && ctx && onRoster ? (
        <PritibhojMemberDialog
          sheet={open.sheet}
          wing={open.wing}
          column={open.column}
          sheetCount={open.count}
          rows={open.sheet === "main" ? value.main_rows : value.admin_rows}
          date={value.date}
          ctx={ctx}
          roster={value.roster}
          onClose={() => setOpen(null)}
          onRoster={async (next) => {
            await onRoster(next);
          }}
        />
      ) : null}
    </div>
  );
}
