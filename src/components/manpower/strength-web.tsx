"use client";

import { useState, type ReactNode } from "react";
import { StrengthReportTitle } from "@/components/manpower/strength-title";
import { WingName } from "@/components/manpower/wing-name";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import { fromBnDigits, toBnDigits } from "@/lib/consume-official-reports";
import {
  STRENGTH_CATEGORIES,
  strengthCategoryLabelBn,
  strengthMetricTotal,
  sumAbsenceRows,
  type StrengthAbsenceRow,
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
  readOnly?: boolean;
};

function formatCount(value: number, bn?: boolean) {
  const n = Math.abs(value);
  return bn ? toBnDigits(n) : String(n);
}

function asciiDigits(raw: string) {
  return fromBnDigits(raw).replace(/[^\d]/g, "");
}

function inputCount(raw: string | null, stored: number, bn?: boolean) {
  const ascii = raw !== null ? raw : String(stored);
  return bn ? toBnDigits(ascii) : ascii;
}

function CountCell({
  value,
  blank,
  bn,
}: {
  value: number;
  blank?: boolean;
  bn?: boolean;
}) {
  return (
    <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm tabular-nums dark:border-neutral-700">
      {blank ? "—" : formatCount(value, bn)}
    </td>
  );
}

function WingNameCell({ children }: { children: ReactNode }) {
  return (
    <td
      rowSpan={3}
      className="sticky left-0 z-[2] w-36 border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-semibold align-middle dark:border-neutral-700 dark:bg-neutral-900"
    >
      {children}
    </td>
  );
}

function MetricRow({
  label,
  counts,
  blankOfficer,
  emphasize,
  wingCell,
  withWing,
  bn,
}: {
  label: string;
  counts: StrengthCounts;
  blankOfficer?: boolean;
  emphasize?: boolean;
  wingCell?: ReactNode;
  withWing?: boolean;
  bn?: boolean;
}) {
  return (
    <tr
      className={cn(
        emphasize && "bg-neutral-100 font-semibold dark:bg-neutral-800/80",
      )}
    >
      {wingCell}
      <td
        className={cn(
          "sticky z-[1] border border-neutral-200 bg-inherit px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700",
          withWing ? "left-36" : "left-0",
        )}
      >
        {label}
      </td>
      {STRENGTH_CATEGORIES.map((cat) => (
        <CountCell
          key={cat.id}
          value={counts[cat.id] ?? 0}
          blank={blankOfficer && cat.id === "officer"}
          bn={bn}
        />
      ))}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {formatCount(strengthMetricTotal(counts, !!blankOfficer), bn)}
      </td>
    </tr>
  );
}

function OfficerHeldRow({
  date,
  wing,
  counts,
  officerAuthorizedId,
  wingCell,
  bn,
}: {
  date: string;
  wing: string;
  counts: StrengthCounts;
  officerAuthorizedId: string;
  wingCell?: ReactNode;
  bn?: boolean;
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
    const digits = asciiDigits(raw);
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
      {wingCell}
      <td className="sticky left-36 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
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
                value={inputCount(draft, stored, bn)}
                onChange={(e) => {
                  const digits = asciiDigits(e.target.value);
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
        return <CountCell key={cat.id} value={counts[cat.id] ?? 0} bn={bn} />;
      })}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {formatCount(strengthMetricTotal(counts), bn)}
      </td>
    </tr>
  );
}

function OfficerAbsentRow({
  date,
  wing,
  counts,
  held,
  bn,
}: {
  date: string;
  wing: string;
  counts: StrengthCounts;
  held: StrengthCounts;
  bn?: boolean;
}) {
  const state = useStore();
  const stored = authorizedWingDisplayCount(
    state.manpower_officer_absent?.[date],
    wing,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const heldN = held.officer ?? 0;

  function commit(raw: string) {
    const digits = asciiDigits(raw);
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
      <td className="sticky left-36 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
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
                value={inputCount(draft, stored, bn)}
                onChange={(e) => {
                  const digits = asciiDigits(e.target.value);
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
        return <CountCell key={cat.id} value={counts[cat.id] ?? 0} bn={bn} />;
      })}
      <td className="border border-neutral-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums dark:border-neutral-700">
        {formatCount(strengthMetricTotal(counts), bn)}
      </td>
    </tr>
  );
}

function AdminWingName({ wing }: { wing: string }) {
  const key = wing.trim().toLowerCase();
  if (wing === "সর্বমোট") return <>সর্বমোট</>;
  if (key === "mt br" || key === "mt branch") return <>এমটি</>;
  if (key === "new / temporary attached") return <>নতুন / অস্থায়ী সংযুক্ত</>;
  return <WingName wing={wing} />;
}

function RankHead({
  withWing,
  metricLabel = "বিবরণ",
}: {
  withWing?: boolean;
  metricLabel?: string;
}) {
  return (
    <tr className="bg-neutral-100 dark:bg-neutral-800">
      {withWing ? (
        <th className="sticky left-0 z-[2] w-36 border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
          উইং
        </th>
      ) : null}
      <th
        className={cn(
          "sticky z-[1] border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800",
          withWing ? "left-36" : "left-0",
        )}
      >
        {metricLabel}
      </th>
      {STRENGTH_CATEGORIES.map((c) => (
        <th
          key={c.id}
          className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
        >
          {strengthCategoryLabelBn(c)}
        </th>
      ))}
      <th className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700">
        মোট
      </th>
    </tr>
  );
}

function BranchRows({
  block,
  date,
  officerAuthorizedId,
  editableOfficer,
  bn,
  form2,
}: {
  block: StrengthBranchBlock;
  date: string;
  officerAuthorizedId: string | null;
  editableOfficer?: boolean;
  bn?: boolean;
  form2?: boolean;
}) {
  const canEdit = editableOfficer && Boolean(officerAuthorizedId) && !block.withoutRecord;
  const wingCell = (
    <WingNameCell>
      {form2 ? <AdminWingName wing={block.wing} /> : <WingName wing={block.wing} />}
      {block.withoutRecord ? (
        <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
          রেকর্ড নেই
        </span>
      ) : null}
    </WingNameCell>
  );

  return (
    <>
      {canEdit && officerAuthorizedId ? (
        <OfficerHeldRow
          date={date}
          wing={block.wing}
          counts={block.held}
          officerAuthorizedId={officerAuthorizedId}
          wingCell={wingCell}
          bn={bn}
        />
      ) : (
        <MetricRow
          label="প্রাপ্ত"
          counts={block.held}
          blankOfficer={block.withoutRecord}
          withWing
          wingCell={wingCell}
          bn={bn}
        />
      )}
      <MetricRow
        label="উপস্থিত"
        counts={block.present}
        blankOfficer={block.withoutRecord}
        withWing
        bn={bn}
      />
      {canEdit ? (
        <OfficerAbsentRow
          date={date}
          wing={block.wing}
          counts={block.absent}
          held={block.held}
          bn={bn}
        />
      ) : (
        <MetricRow
          label="অনুপস্থিত"
          counts={block.absent}
          blankOfficer={block.withoutRecord}
          withWing
          bn={bn}
        />
      )}
    </>
  );
}

function AbsenceCells({
  row,
  bn,
}: {
  row: StrengthAbsenceRow;
  bn?: boolean;
}) {
  return (
    <>
      <CountCell value={row.cl} bn={bn} />
      <CountCell value={row.pl} bn={bn} />
      <CountCell value={row.rl} bn={bn} />
      <CountCell value={row.ml} bn={bn} />
      <CountCell value={row.maternity} bn={bn} />
      <CountCell value={row.training} bn={bn} />
      <CountCell value={row.remaining} bn={bn} />
      <CountCell value={row.exam} bn={bn} />
      <CountCell value={row.other} bn={bn} />
      <CountCell value={row.hospital} bn={bn} />
      <CountCell value={row.avgPresent} bn={bn} />
      <CountCell value={row.total} bn={bn} />
    </>
  );
}

function HqAbsenceSection({ report }: { report: StrengthReport }) {
  const isHq = report.formNo === 3;
  const form2 = report.formNo === 2;
  const total = sumAbsenceRows(
    report.formNo === 3
      ? report.absence.filter((row) => row.wing !== "সদর")
      : report.absence,
  );

  if (!isHq && !form2) {
    return (
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
                  গড় হাজির
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
                  <AbsenceCells row={row} bn />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th
                colSpan={6}
                className="border border-neutral-200 dark:border-neutral-700"
              />
              <th
                colSpan={4}
                className="border border-neutral-200 px-2 py-1.5 text-center text-xs font-semibold dark:border-neutral-700"
              >
                অস্থায়ী জনবলের বিবরণ
              </th>
              <th className="border border-neutral-200 dark:border-neutral-700" />
              <th className="border border-neutral-200 dark:border-neutral-700" />
              <th className="border border-neutral-200 dark:border-neutral-700" />
            </tr>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-left text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                উইং
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                সিএল
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                পিএল
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                আরএল
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                এমএল
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                * মাতৃত্বকালীন ছুটি
              </th>
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
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                হাসপাতাল
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                গড় হাজির
              </th>
              <th className="border border-neutral-200 px-2 py-1.5 text-xs font-semibold dark:border-neutral-700">
                সর্বমোট
              </th>
            </tr>
          </thead>
          <tbody>
            {report.absence.map((row) => (
              <tr key={row.wing}>
                <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
                  {form2 ? (
                    <AdminWingName wing={row.wing} />
                  ) : (
                    <WingName wing={row.wing} />
                  )}
                </td>
                <AbsenceCells row={row} bn />
              </tr>
            ))}
            <tr className="bg-neutral-100 font-semibold dark:bg-neutral-800/80">
              <td className="sticky left-0 z-[1] border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-left text-sm dark:border-neutral-700 dark:bg-neutral-800">
                সর্বমোট
              </td>
              <AbsenceCells row={total} bn />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Screen / tab panel view of Form 2/3 (not print letter). */
export function StrengthWeb({ report, readOnly = false }: Props) {
  const isHq = report.formNo === 3;
  const form2 = report.formNo === 2;
  const bn = true;
  return (
    <div className="flex flex-col gap-6 p-1 sm:p-2">
      <section className="overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <StrengthReportTitle
          titleBn={report.titleBn}
          wingLabel={report.wingLabel}
          date={report.date}
          locale="bn-BD"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <RankHead metricLabel={form2 ? "ডিটেইল" : "বিবরণ"} />
            </thead>
            <tbody>
              <MetricRow
                label="প্রাপ্ত"
                counts={report.grandTotal.held}
                emphasize
                bn={bn}
              />
              <MetricRow
                label="উপস্থিত"
                counts={report.grandTotal.present}
                emphasize
                bn={bn}
              />
              <MetricRow
                label="অনুপস্থিত"
                counts={report.grandTotal.absent}
                emphasize
                bn={bn}
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        {form2 ? null : (
          <h3 className="px-1 text-sm font-bold">{report.wingLabel}</h3>
        )}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <RankHead
                  withWing
                  metricLabel={form2 ? "জনবল" : "বিবরণ"}
                />
              </thead>
              <tbody>
                {report.branches.map((block) => (
                  <BranchRows
                    key={block.wing}
                    block={block}
                    date={report.date}
                    officerAuthorizedId={report.officerAuthorizedId}
                    editableOfficer={!readOnly}
                    bn={bn}
                    form2={form2}
                  />
                ))}
                {form2 ? (
                  <BranchRows
                    block={report.grandTotal}
                    date={report.date}
                    officerAuthorizedId={null}
                    bn={bn}
                    form2
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {isHq || form2 ? (
        <h3 className="px-1 text-sm font-bold">* অন্যান্য কর্তব্য</h3>
      ) : null}

      <HqAbsenceSection report={report} />
    </div>
  );
}
