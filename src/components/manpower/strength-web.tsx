"use client";

import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { StrengthReportTitle } from "@/components/manpower/strength-title";
import { WingName } from "@/components/manpower/wing-name";
import { useI18n } from "@/i18n/provider";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import {
  STRENGTH_CATEGORIES,
  strengthMetricTotal,
  type StrengthBranchBlock,
  type StrengthCounts,
  type StrengthReport,
} from "@/lib/strength-report";
import {
  authorizedWingDisplayCount,
  setAuthorizedHeldWingCount,
  setManpowerOfficerAbsent,
} from "@/lib/store/org-options";
import { cn } from "@/lib/utils";

type Props = {
  report: StrengthReport;
};

function CountCell({
  value,
  blank,
}: {
  value: number;
  blank?: boolean;
}) {
  return (
    <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm tabular-nums dark:border-neutral-700">
      {blank ? "—" : Math.abs(value)}
    </td>
  );
}

function MetricRow({
  label,
  counts,
  blankOfficer,
  emphasize,
}: {
  label: string;
  counts: StrengthCounts;
  blankOfficer?: boolean;
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
      {STRENGTH_CATEGORIES.map((cat) => (
        <CountCell
          key={cat.id}
          value={counts[cat.id] ?? 0}
          blank={blankOfficer && cat.id === "officer"}
        />
      ))}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {strengthMetricTotal(counts, !!blankOfficer)}
      </td>
    </tr>
  );
}

function OfficerHeldRow({
  date,
  wing,
  counts,
  officerAuthorizedId,
}: {
  date: string;
  wing: string;
  counts: StrengthCounts;
  officerAuthorizedId: string;
}) {
  const state = useStore();
  const row = state.authorized.find((r) => r.id === officerAuthorizedId);
  const stored = authorizedWingDisplayCount(row?.held_wings, wing);
  const [draft, setDraft] = useState<string | null>(null);

  function applyHeld(heldN: number) {
    setAuthorizedHeldWingCount(officerAuthorizedId, wing, heldN);
    const abs = authorizedWingDisplayCount(
      state.manpower_officer_absent?.[date],
      wing,
    );
    if (abs > heldN) setManpowerOfficerAbsent(date, wing, heldN);
  }

  function commit(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      setDraft("");
      applyHeld(0);
      return;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    setDraft(null);
    applyHeld(Math.floor(n));
  }

  return (
    <tr>
      <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
        প্রাপ্ত
      </td>
      {STRENGTH_CATEGORIES.map((cat) => {
        if (cat.id === "officer") {
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
                    if (Number.isFinite(n) && n >= 0) applyHeld(Math.floor(n));
                  } else {
                    applyHeld(0);
                  }
                }}
                onBlur={() => {
                  if (draft !== null) commit(draft);
                  setDraft(null);
                }}
                inputMode="numeric"
                aria-label={`অফিসার প্রাপ্ত — ${wing}`}
                className="mx-auto h-8 w-14 rounded-md border-sky-300 bg-sky-50 text-center font-mono text-sm tabular-nums dark:border-sky-700 dark:bg-sky-950/40"
              />
            </td>
          );
        }
        return <CountCell key={cat.id} value={counts[cat.id] ?? 0} />;
      })}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {strengthMetricTotal(counts)}
      </td>
    </tr>
  );
}

function OfficerAbsentRow({
  date,
  wing,
  counts,
  held,
}: {
  date: string;
  wing: string;
  counts: StrengthCounts;
  held: StrengthCounts;
}) {
  const state = useStore();
  const stored = authorizedWingDisplayCount(
    state.manpower_officer_absent?.[date],
    wing,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const heldN = held.officer ?? 0;

  function commit(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      setDraft("");
      setManpowerOfficerAbsent(date, wing, 0);
      return;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    setDraft(null);
    setManpowerOfficerAbsent(date, wing, Math.min(Math.floor(n), heldN));
  }

  return (
    <tr>
      <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
        অনুপস্থিত
      </td>
      {STRENGTH_CATEGORIES.map((cat) => {
        if (cat.id === "officer") {
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
        return <CountCell key={cat.id} value={counts[cat.id] ?? 0} />;
      })}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {strengthMetricTotal(counts)}
      </td>
    </tr>
  );
}

function RankHead() {
  return (
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      <th className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
        ডিটেইল
      </th>
      {STRENGTH_CATEGORIES.map((c) => (
        <th
          key={c.id}
          className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
        >
          {c.labelBn}
        </th>
      ))}
      <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
        মোট
      </th>
    </tr>
  );
}

function BranchCard({
  block,
  date,
  officerAuthorizedId,
  editableOfficer,
  collapsible = true,
  defaultOpen,
}: {
  block: StrengthBranchBlock;
  date: string;
  officerAuthorizedId: string | null;
  editableOfficer?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  if (block.withoutRecord) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-sm text-neutral-500 dark:border-neutral-600">
        <WingName wing={block.wing} /> — রেকর্ড নেই
      </div>
    );
  }
  const canEdit = editableOfficer && Boolean(officerAuthorizedId);
  const showBody = !collapsible || open;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 bg-neutral-50 px-3 py-2.5 text-left text-sm font-semibold dark:bg-neutral-800/60"
        >
          <span className="min-w-0 truncate">
            <WingName wing={block.wing} />
          </span>
          <IconChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
      ) : (
        <div className="bg-neutral-50 px-3 py-2.5 text-sm font-semibold dark:bg-neutral-800/60">
          <span className="min-w-0 truncate">
            <WingName wing={block.wing} />
          </span>
        </div>
      )}
      {showBody ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <RankHead />
            </thead>
            <tbody>
              {canEdit && officerAuthorizedId ? (
                <OfficerHeldRow
                  date={date}
                  wing={block.wing}
                  counts={block.held}
                  officerAuthorizedId={officerAuthorizedId}
                />
              ) : (
                <MetricRow label="প্রাপ্ত" counts={block.held} />
              )}
              <MetricRow label="উপস্থিত" counts={block.present} />
              {canEdit ? (
                <OfficerAbsentRow
                  date={date}
                  wing={block.wing}
                  counts={block.absent}
                  held={block.held}
                />
              ) : (
                <MetricRow label="অনুপস্থিত" counts={block.absent} />
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Screen / tab panel view of Form 2/3 (not print letter). */
export function StrengthWeb({ report }: Props) {
  const { locale } = useI18n();
  const editableOfficer = true;
  const [branchesOpen, setBranchesOpen] = useState(true);
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <StrengthReportTitle
          titleBn={report.titleBn}
          wingLabel={report.wingLabel}
          date={report.date}
          locale={dateLocale}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <RankHead />
            </thead>
            <tbody>
              <MetricRow
                label="প্রাপ্ত"
                counts={report.grandTotal.held}
                emphasize
              />
              <MetricRow
                label="উপস্থিত"
                counts={report.grandTotal.present}
                emphasize
              />
              <MetricRow
                label="অনুপস্থিত"
                counts={report.grandTotal.absent}
                emphasize
              />
            </tbody>
          </table>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <h3 className="border-b border-neutral-200 px-3 py-2 text-sm font-bold dark:border-neutral-700">
          অনুপস্থিতির বিবরণ
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                  উইং
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  সিএল
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  পিএল
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  আরএল
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  এমএল
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  মাতৃত্ব
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  প্রশিক্ষণ
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  বাকি
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  পরীক্ষা
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  অন্যান্য
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  হাসপাতাল
                </th>
                <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
                  সর্বমোট
                </th>
              </tr>
            </thead>
            <tbody>
              {report.absence.map((row) => (
                <tr key={row.wing}>
                  <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
                    <WingName wing={row.wing} />
                  </td>
                  <CountCell value={row.cl} />
                  <CountCell value={row.pl} />
                  <CountCell value={row.rl} />
                  <CountCell value={row.ml} />
                  <CountCell value={row.maternity} />
                  <CountCell value={row.training} />
                  <CountCell value={row.remaining} />
                  <CountCell value={row.exam} />
                  <CountCell value={row.other} />
                  <CountCell value={row.hospital} />
                  <CountCell value={row.total} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => setBranchesOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-sm font-bold dark:border-neutral-700 dark:bg-neutral-800/60"
        >
          <span>শাখা অনুযায়ী</span>
          <IconChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition",
              branchesOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
        {branchesOpen ? (
          <div className="flex flex-col gap-2 p-2 sm:p-3">
            {report.branches.map((block) => (
              <BranchCard
                key={block.wing}
                block={block}
                date={report.date}
                officerAuthorizedId={report.officerAuthorizedId}
                editableOfficer={editableOfficer}
                collapsible={false}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
