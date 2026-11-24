"use client";

import { forwardRef, type ReactNode } from "react";
import { RankColumnHeader } from "@/components/manpower/rank-column-header";
import { StrengthReportTitle } from "@/components/manpower/strength-title";
import {
  ManpowerVerifiedByFooter,
  ManpowerVerifiedWatermark,
} from "@/components/manpower/verified-by-footer";
import { WingName } from "@/components/manpower/wing-name";
import { toBnDigits } from "@/lib/consume-official-reports";
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
import { cn } from "@/lib/utils";

type Props = {
  report: StrengthReport;
  locale?: string;
  verified?: boolean;
};

function formatCount(value: number, bn?: boolean) {
  const n = Math.abs(value);
  return bn ? toBnDigits(n) : String(n);
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
    <td className="border border-neutral-800 px-0.5 py-0.5 text-center tabular-nums">
      {blank ? "" : formatCount(value, bn)}
    </td>
  );
}

function AdminWingName({ wing }: { wing: string }) {
  if (wing === "সর্বমোট") return <>সর্বমোট</>;
  return <WingName wing={wing} paper />;
}

function MetricRow({
  label,
  counts,
  blankOfficer,
  emphasize,
  bn,
  wingCell,
}: {
  label: string;
  counts: StrengthCounts;
  blankOfficer?: boolean;
  emphasize?: boolean;
  bn?: boolean;
  wingCell?: ReactNode;
}) {
  return (
    <tr className={cn(emphasize && "bg-neutral-50 font-semibold")}>
      {wingCell}
      <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
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
      <td className="border border-neutral-800 px-0.5 py-0.5 text-center font-semibold tabular-nums">
        {formatCount(strengthMetricTotal(counts, !!blankOfficer), bn)}
      </td>
    </tr>
  );
}

function Form2BranchBlock({
  block,
  bn,
}: {
  block: StrengthBranchBlock;
  bn?: boolean;
}) {
  return (
    <>
      <MetricRow
        label="প্রাপ্ত"
        counts={block.held}
        emphasize={block.wing === "সর্বমোট"}
        bn={bn}
        wingCell={
          <td
            rowSpan={3}
            className="border border-neutral-800 px-1 py-0.5 text-left align-middle font-bold"
          >
            <AdminWingName wing={block.wing} />
          </td>
        }
      />
      <MetricRow
        label="উপস্থিত"
        counts={block.present}
        emphasize={block.wing === "সর্বমোট"}
        bn={bn}
      />
      <MetricRow
        label="অনুপস্থিত"
        counts={block.absent}
        emphasize={block.wing === "সর্বমোট"}
        bn={bn}
      />
    </>
  );
}

function BranchBlock({
  block,
  bn,
}: {
  block: StrengthBranchBlock;
  bn?: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={STRENGTH_CATEGORIES.length + 2}
          className="border border-neutral-800 bg-neutral-200/70 px-1 py-0.5 text-left text-[9px] font-bold"
        >
          <WingName wing={block.wing} paper />
        </td>
      </tr>
      <MetricRow
        label="প্রাপ্ত"
        counts={block.held}
        blankOfficer
        bn={bn}
      />
      <MetricRow
        label="উপস্থিত"
        counts={block.present}
        blankOfficer
        bn={bn}
      />
      <MetricRow
        label="অনুপস্থিত"
        counts={block.absent}
        blankOfficer
        bn={bn}
      />
    </>
  );
}

function AbsencePrintCells({
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

function LetterAbsenceTable({ report }: { report: StrengthReport }) {
  const isHq = report.formNo === 3;
  const form2 = report.formNo === 2;
  const total = sumAbsenceRows(
    report.formNo === 3
      ? report.absence.filter((row) => row.wing !== "সদর")
      : report.absence,
  );

  if (!isHq && !form2) {
    return (
      <>
        <p className="mt-3 text-[10px] font-semibold">অনুপস্থিতির বিবরণ</p>
        <table className="mt-1 w-full table-fixed border-collapse text-[7px] leading-tight">
          <colgroup>
            <col className="w-[16%]" />
            {Array.from({ length: 12 }).map((_, i) => (
              <col key={i} className="w-[7%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-800 px-1 py-1 text-left">
                উইং
              </th>
              <th className="border border-neutral-800 px-0.5 py-1">সিএল</th>
              <th className="border border-neutral-800 px-0.5 py-1">পিএল</th>
              <th className="border border-neutral-800 px-0.5 py-1">আরএল</th>
              <th className="border border-neutral-800 px-0.5 py-1">এমএল</th>
              <th className="border border-neutral-800 px-0.5 py-1">মাতৃত্ব</th>
              <th className="border border-neutral-800 px-0.5 py-1">প্রশিক্ষণ</th>
              <th className="border border-neutral-800 px-0.5 py-1">বাকি</th>
              <th className="border border-neutral-800 px-0.5 py-1">পরীক্ষা</th>
              <th className="border border-neutral-800 px-0.5 py-1">অন্যান্য</th>
              <th className="border border-neutral-800 px-0.5 py-1">হাসপাতাল</th>
              <th className="border border-neutral-800 px-0.5 py-1">গড় হাজির</th>
              <th className="border border-neutral-800 px-0.5 py-1">সর্বমোট</th>
            </tr>
          </thead>
          <tbody>
            {report.absence.map((row) => (
              <tr key={row.wing}>
                <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
                  <WingName wing={row.wing} paper />
                </td>
                <AbsencePrintCells row={row} bn />
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <table className="mt-3 w-full table-fixed border-collapse text-[7px] leading-tight">
        <colgroup>
          <col className="w-[16%]" />
          {Array.from({ length: 12 }).map((_, i) => (
            <col key={i} className="w-[7%]" />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-neutral-100">
            <th colSpan={6} className="border border-neutral-800" />
            <th colSpan={4} className="border border-neutral-800 px-0.5 py-1 text-center">
              অস্থায়ী জনবলের বিবরণ
            </th>
            <th className="border border-neutral-800" />
            <th className="border border-neutral-800" />
            <th className="border border-neutral-800" />
          </tr>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-800 px-1 py-0.5 text-left">উইং</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">সিএল</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">পিএল</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">আরএল</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">এমএল</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">
              মাতৃত্ব
            </th>
            <th className="border border-neutral-800 px-0.5 py-0.5">প্রশিক্ষণ</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">সাক্ষী</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">পরীক্ষা</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">অন্যান্য</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">হাসপাতাল</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">গড় হাজির</th>
            <th className="border border-neutral-800 px-0.5 py-0.5">সর্বমোট</th>
          </tr>
        </thead>
        <tbody>
          {report.absence.map((row) => (
            <tr key={row.wing}>
              <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
                {form2 ? (
                  <AdminWingName wing={row.wing} />
                ) : (
                  <WingName wing={row.wing} paper />
                )}
              </td>
              <AbsencePrintCells row={row} bn />
            </tr>
          ))}
          <tr className="bg-neutral-50 font-semibold">
            <td className="border border-neutral-800 px-1 py-0.5 text-left">
              সর্বমোট
            </td>
            <AbsencePrintCells row={total} bn />
          </tr>
        </tbody>
    </table>
  );
}

/** Form 2/3 letter — Admin Wing / HQ Br daily strength. */
export const StrengthLetter = forwardRef<HTMLDivElement, Props>(
  function StrengthLetter({ report, locale = "bn-BD", verified = false }, ref) {
    const bn = true;
    return (
      <div
        ref={ref}
        className="strength-letter relative mx-auto w-full max-w-[210mm] min-h-0 overflow-hidden bg-white p-2.5 text-neutral-900 shadow-sm print:min-h-0 print:max-w-none print:overflow-visible print:p-0 print:shadow-none"
      >
        <ManpowerVerifiedWatermark show={verified} />
        <div className="relative z-[1]">
        <StrengthReportTitle
          titleBn={report.titleBn}
          wingLabel={report.wingLabel}
          date={report.date}
          locale="bn-BD"
          compact
        />

        {/* Top summary */}
        <table className="mt-3 w-full table-fixed border-collapse text-[7px] leading-tight">
          <colgroup>
            <col className="w-[12%]" />
            {STRENGTH_CATEGORIES.map((c) => (
              <col key={c.id} />
            ))}
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
                ডিটেইল
              </th>
              {STRENGTH_CATEGORIES.map((c) => (
                <RankColumnHeader
                  key={c.id}
                  labelBn={strengthCategoryLabelBn(c)}
                />
              ))}
              <th className="border border-neutral-800 px-0.5 py-1 font-semibold">
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow label="প্রাপ্ত" counts={report.summary.held} bn={bn} />
            <MetricRow label="উপস্থিত" counts={report.summary.present} bn={bn} />
            <MetricRow label="অনুপস্থিত" counts={report.summary.absent} bn={bn} />
          </tbody>
        </table>

        {/* Branch breakdown */}
        <table className="mt-3 w-full table-fixed border-collapse text-[7px] leading-tight">
          <colgroup>
            {report.formNo === 2 ? <col className="w-[12%]" /> : null}
            <col className="w-[10%]" />
            {STRENGTH_CATEGORIES.map((c) => (
              <col key={`br-${c.id}`} />
            ))}
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-neutral-100">
              {report.formNo === 2 ? (
                <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
                  উইং
                </th>
              ) : null}
              <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
                {report.formNo === 2 ? "জনবল" : "ডিটেইল"}
              </th>
              {STRENGTH_CATEGORIES.map((c) => (
                <RankColumnHeader
                  key={c.id}
                  labelBn={strengthCategoryLabelBn(c)}
                />
              ))}
              <th className="border border-neutral-800 px-0.5 py-1 font-semibold">
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            {report.formNo === 2 ? (
              <>
                {report.branches.map((block) => (
                  <Form2BranchBlock key={block.wing} block={block} bn={bn} />
                ))}
                <Form2BranchBlock block={report.grandTotal} bn={bn} />
              </>
            ) : (
              <>
                {report.branches.map((block) => (
                  <BranchBlock key={block.wing} block={block} bn={bn} />
                ))}
                <tr>
                  <td
                    colSpan={STRENGTH_CATEGORIES.length + 2}
                    className="border border-neutral-800 bg-neutral-200/70 px-1 py-0.5 text-left text-[9px] font-bold"
                  >
                    {report.grandTotal.wing === "সর্বমোট" ? (
                      "সর্বমোট"
                    ) : (
                      <WingName wing={report.grandTotal.wing} paper />
                    )}
                  </td>
                </tr>
                <MetricRow
                  label="প্রাপ্ত"
                  counts={report.grandTotal.held}
                  blankOfficer
                  emphasize
                  bn={bn}
                />
                <MetricRow
                  label="উপস্থিত"
                  counts={report.grandTotal.present}
                  blankOfficer
                  emphasize
                  bn={bn}
                />
                <MetricRow
                  label="অনুপস্থিত"
                  counts={report.grandTotal.absent}
                  blankOfficer
                  emphasize
                  bn={bn}
                />
              </>
            )}
          </tbody>
        </table>

        {bn ? (
          <p className="mt-3 text-[10px] font-semibold">* অন্যান্য কর্তব্য</p>
        ) : null}

        <LetterAbsenceTable report={report} />

        {report.formNo === 3 ? (
          <p className="mt-2 text-[10px] font-medium">
            যাওয়া — {toBnDigits(report.movement.going)} &nbsp;&nbsp; আসা —{" "}
            {toBnDigits(report.movement.coming)}
          </p>
        ) : null}

        <ManpowerVerifiedByFooter show={verified} />
        </div>
      </div>
    );
  },
);
