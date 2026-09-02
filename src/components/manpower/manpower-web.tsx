"use client";

import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { WingName } from "@/components/manpower/wing-name";
import { Input } from "@/components/ui/input";
import {
  formatManpowerCell,
  manpowerRowTotal,
  type ManpowerCounts,
  type ManpowerReport,
} from "@/lib/manpower-report";
import {
  authorizedWingDisplayCount,
  setManpowerOfficerAbsent,
} from "@/lib/store/org-options";
import { useStore } from "@/hooks/use-store";
import { authorizedLabelBn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";

type Props = {
  report: ManpowerReport;
};

function Cell({
  value,
  blank,
  className,
}: {
  value: number;
  blank?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border border-neutral-200 px-2 py-1.5 text-center text-sm tabular-nums dark:border-neutral-700",
        className,
      )}
    >
      {blank ? "—" : formatManpowerCell(value)}
    </td>
  );
}

function MetricRow({
  label,
  counts,
  categories,
  blankOfficer,
  officerCategoryId,
  emphasize,
}: {
  label: string;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  blankOfficer?: boolean;
  officerCategoryId: string | null;
  emphasize?: boolean;
}) {
  return (
    <tr
      className={cn(
        emphasize &&
          "bg-neutral-100 font-semibold dark:bg-neutral-800/80",
      )}
    >
      <td className="sticky left-0 z-[1] border border-neutral-200 bg-inherit px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700">
        {label}
      </td>
      {categories.map((cat) => {
        const isOfficer = blankOfficer && cat.id === officerCategoryId;
        return (
          <Cell
            key={cat.id}
            value={counts[cat.id] ?? 0}
            blank={isOfficer}
          />
        );
      })}
      <Cell
        value={
          blankOfficer && officerCategoryId
            ? manpowerRowTotal({
                ...counts,
                [officerCategoryId]: 0,
              })
            : manpowerRowTotal(counts)
        }
        className="font-semibold"
      />
    </tr>
  );
}

function OfficerAbsentRow({
  date,
  wing,
  counts,
  categories,
  officerCategoryId,
  held,
}: {
  date: string;
  wing: string;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  officerCategoryId: string;
  held: ManpowerCounts;
}) {
  const state = useStore();
  const stored = authorizedWingDisplayCount(
    state.manpower_officer_absent?.[date],
    wing,
  );
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      setDraft("");
      setManpowerOfficerAbsent(date, wing, 0);
      return;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    const heldN = held[officerCategoryId] ?? 0;
    const safe = Math.min(Math.floor(n), heldN);
    setDraft(null);
    setManpowerOfficerAbsent(date, wing, safe);
  }

  return (
    <tr>
      <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
        অনুপস্থিত
      </td>
      {categories.map((cat) => {
        if (cat.id === officerCategoryId) {
          return (
            <td
              key={cat.id}
              className="border border-neutral-200 px-1 py-1 text-center dark:border-neutral-700"
            >
              <Input
                value={draft !== null ? draft : String(stored)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  setDraft(digits);
                  if (digits !== "") {
                    const n = Number(digits);
                    if (Number.isFinite(n) && n >= 0) {
                      const heldN = held[officerCategoryId] ?? 0;
                      setManpowerOfficerAbsent(
                        date,
                        wing,
                        Math.min(Math.floor(n), heldN),
                      );
                    }
                  } else {
                    setManpowerOfficerAbsent(date, wing, 0);
                  }
                }}
                onBlur={() => {
                  if (draft !== null) commit(draft);
                  setDraft(null);
                }}
                inputMode="numeric"
                aria-label={`অফিসার অনুপস্থিত — ${wing}`}
                className="mx-auto h-8 w-14 rounded-md border-amber-300 bg-amber-50 text-center font-mono text-sm tabular-nums dark:border-amber-700 dark:bg-amber-950/40"
              />
            </td>
          );
        }
        return (
          <Cell key={cat.id} value={counts[cat.id] ?? 0} />
        );
      })}
      <Cell value={manpowerRowTotal(counts)} className="font-semibold" />
    </tr>
  );
}

function RankHead({
  categories,
}: {
  categories: ManpowerReport["categories"];
}) {
  return (
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      <th className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
        বিবরণ
      </th>
      {categories.map((cat) => (
        <th
          key={cat.id}
          className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
        >
          {authorizedLabelBn(cat.label)}
        </th>
      ))}
      <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
        মোট
      </th>
    </tr>
  );
}

function WingBlock({
  date,
  wing,
  authorized,
  held,
  present,
  absent,
  categories,
  officerCategoryId,
  defaultOpen,
  editableOfficerAbsent,
  collapsible = true,
}: {
  date: string;
  wing: string;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
  present: ManpowerCounts;
  absent: ManpowerCounts;
  categories: ManpowerReport["categories"];
  officerCategoryId: string | null;
  defaultOpen?: boolean;
  editableOfficerAbsent?: boolean;
  /** false = always show table; title is static label. */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const showBody = !collapsible || open;
  const title =
    wing === "সর্বমোট" ? "সর্বমোট" : <WingName wing={wing} />;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 bg-neutral-50 px-3 py-2.5 text-left text-sm font-semibold dark:bg-neutral-800/60"
        >
          <span className="min-w-0 truncate">{title}</span>
          <IconChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
      ) : (
        <div className="bg-neutral-50 px-3 py-2.5 text-sm font-semibold dark:bg-neutral-800/60">
          <span className="min-w-0 truncate">{title}</span>
        </div>
      )}
      {showBody ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <RankHead categories={categories} />
            </thead>
            <tbody>
              <MetricRow
                label="প্রাধিকৃত"
                counts={authorized}
                categories={categories}
                officerCategoryId={officerCategoryId}
              />
              <MetricRow
                label="প্রাপ্ত"
                counts={held}
                categories={categories}
                officerCategoryId={officerCategoryId}
              />
              <MetricRow
                label="উপস্থিত"
                counts={present}
                categories={categories}
                officerCategoryId={officerCategoryId}
              />
              {editableOfficerAbsent && officerCategoryId ? (
                <OfficerAbsentRow
                  date={date}
                  wing={wing}
                  counts={absent}
                  categories={categories}
                  officerCategoryId={officerCategoryId}
                  held={held}
                />
              ) : (
                <MetricRow
                  label="অনুপস্থিত"
                  counts={absent}
                  categories={categories}
                  officerCategoryId={officerCategoryId}
                />
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Screen / tab panel view of Form 1 (not print letter). */
export function ManpowerWeb({ report }: Props) {
  const { date, categories, officerCategoryId, wings, grandTotal, absence } =
    report;
  const [wingsOpen, setWingsOpen] = useState(true);

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2">
      <WingBlock
        date={date}
        wing={grandTotal.wing}
        authorized={grandTotal.authorized}
        held={grandTotal.held}
        present={grandTotal.present}
        absent={grandTotal.absent}
        categories={categories}
        officerCategoryId={officerCategoryId}
        defaultOpen
      />

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <h3 className="border-b border-neutral-200 px-3 py-2 text-sm font-bold dark:border-neutral-700">
          অনুপস্থিতির বিবরণ
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                >
                  উইং
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  সিএল
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  পিএল
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  আরএল
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  এমএল
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  মাতৃত্ব
                </th>
                <th
                  colSpan={4}
                  className="border border-neutral-200 px-2 py-1.5 text-center text-xs font-semibold dark:border-neutral-700"
                >
                  অস্থায়ী জনবলের বিবরণ
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  হাসপাতাল
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  গড় উপস্থিত
                </th>
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
                >
                  মোট
                </th>
              </tr>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                  প্রশিক্ষণ
                </th>
                <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                  সাক্ষী
                </th>
                <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                  পরীক্ষা
                </th>
                <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                  অন্যান্য
                </th>
              </tr>
            </thead>
            <tbody>
              {absence.map((row) => (
                <tr key={row.wing}>
                  <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
                    <WingName wing={row.wing} />
                  </td>
                  <Cell value={row.cl} />
                  <Cell value={row.pl} />
                  <Cell value={row.rl} />
                  <Cell value={row.ml} />
                  <Cell value={row.maternity} />
                  <Cell value={row.training} />
                  <Cell value={row.witness} />
                  <Cell value={row.exam} />
                  <Cell value={row.other} />
                  <Cell value={row.hospital} />
                  <Cell value={row.avgPresent} className="font-semibold" />
                  <Cell value={row.total} className="font-semibold" />
                </tr>
              ))}
              <tr className="bg-neutral-50 font-semibold dark:bg-neutral-800/50">
                <td className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800/50">
                  সর্বমোট
                </td>
                <Cell value={absence.reduce((s, r) => s + r.cl, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.pl, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.rl, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.ml, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.maternity, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.training, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.witness, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.exam, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.other, 0)} />
                <Cell value={absence.reduce((s, r) => s + r.hospital, 0)} />
                <Cell
                  value={absence.reduce((s, r) => s + r.avgPresent, 0)}
                  className="font-semibold"
                />
                <Cell
                  value={absence.reduce((s, r) => s + r.total, 0)}
                  className="font-semibold"
                />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => setWingsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-sm font-bold dark:border-neutral-700 dark:bg-neutral-800/60"
        >
          <span>উইং অনুযায়ী</span>
          <IconChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition",
              wingsOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
        {wingsOpen ? (
          <div className="flex flex-col gap-2 p-2 sm:p-3">
            {wings.map((block) => (
              <WingBlock
                key={block.wing}
                date={date}
                wing={block.wing}
                authorized={block.authorized}
                held={block.held}
                present={block.present}
                absent={block.absent}
                categories={categories}
                officerCategoryId={officerCategoryId}
                editableOfficerAbsent
                collapsible={false}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
