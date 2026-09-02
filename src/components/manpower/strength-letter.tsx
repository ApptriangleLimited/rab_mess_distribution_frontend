"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import { RankColumnHeader } from "@/components/manpower/rank-column-header";
import { WingName } from "@/components/manpower/wing-name";
import {
  STRENGTH_CATEGORIES,
  strengthMetricTotal,
  type StrengthBranchBlock,
  type StrengthCounts,
  type StrengthReport,
} from "@/lib/strength-report";
import { cn } from "@/lib/utils";

type Props = {
  report: StrengthReport;
  locale?: string;
};

function CountCell({
  value,
  blank,
}: {
  value: number;
  blank?: boolean;
}) {
  return (
    <td className="border border-neutral-800 px-0.5 py-0.5 text-center tabular-nums">
      {blank ? "" : Math.abs(value)}
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
    <tr className={cn(emphasize && "bg-neutral-50 font-semibold")}>
      <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
        {label}
      </td>
      {STRENGTH_CATEGORIES.map((cat) => (
        <CountCell
          key={cat.id}
          value={counts[cat.id] ?? 0}
          blank={blankOfficer && cat.id === "officer"}
        />
      ))}
      <td className="border border-neutral-800 px-0.5 py-0.5 text-center font-semibold tabular-nums">
        {strengthMetricTotal(counts, !!blankOfficer)}
      </td>
    </tr>
  );
}

function BranchBlock({ block }: { block: StrengthBranchBlock }) {
  return (
    <>
      <tr>
        <td
          colSpan={STRENGTH_CATEGORIES.length + 2}
          className="border border-neutral-800 bg-neutral-200/70 px-1 py-0.5 text-left text-[9px] font-bold"
        >
          <WingName wing={block.wing} />
        </td>
      </tr>
      <MetricRow
        label="প্রাপ্ত"
        counts={block.held}
        blankOfficer
      />
      <MetricRow
        label="উপস্থিত"
        counts={block.present}
        blankOfficer
      />
      <MetricRow
        label="অনুপস্থিত"
        counts={block.absent}
        blankOfficer
      />
    </>
  );
}

/** Form 2 letter — Admin Wing daily strength. Officer blank on branch rows. */
export const StrengthLetter = forwardRef<HTMLDivElement, Props>(
  function StrengthLetter({ report, locale = "bn-BD" }, ref) {
    const dateLabel = formatDateLong(report.date, locale);

    return (
      <div
        ref={ref}
        className="mx-auto w-full max-w-[297mm] bg-white p-3 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="border-b border-neutral-800 pb-2 text-center">
          <p className="text-[11px] font-semibold">
            {CONSUME_REPORT_META.orgNameBn}
          </p>
          <h1 className="mt-0.5 text-base font-bold tracking-wide">
            {report.titleBn}
          </h1>
          <p className="text-[10px] font-medium text-neutral-700">
            {report.wingLabel}
          </p>
          <p className="text-[10px] text-neutral-600">
            Daily Manpower Report · {CONSUME_REPORT_META.stationBn}
          </p>
          <p className="mt-1 text-xs font-medium">তারিখ / Date: {dateLabel}</p>
        </header>

        {/* Top summary */}
        <table className="mt-3 w-full border-collapse text-[8px] leading-tight">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
                ডিটেইল
              </th>
              {STRENGTH_CATEGORIES.map((c) => (
                <RankColumnHeader
                  key={c.id}
                  labelBn={c.labelBn}
                />
              ))}
              <th className="border border-neutral-800 px-0.5 py-1 font-semibold">
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow label="প্রাপ্ত" counts={report.summary.held} />
            <MetricRow label="উপস্থিত" counts={report.summary.present} />
            <MetricRow label="অনুপস্থিত" counts={report.summary.absent} />
          </tbody>
        </table>

        {/* Branch breakdown */}
        <table className="mt-3 w-full border-collapse text-[8px] leading-tight">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
                ডিটেইল
              </th>
              {STRENGTH_CATEGORIES.map((c) => (
                <RankColumnHeader
                  key={c.id}
                  labelBn={c.labelBn}
                />
              ))}
              <th className="border border-neutral-800 px-0.5 py-1 font-semibold">
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            {report.branches.map((block) => (
              <BranchBlock key={block.wing} block={block} />
            ))}
            <tr>
              <td
                colSpan={STRENGTH_CATEGORIES.length + 2}
                className="border border-neutral-800 bg-neutral-200/70 px-1 py-0.5 text-left text-[9px] font-bold"
              >
                {report.grandTotal.wing === "সর্বমোট" ? (
                  "সর্বমোট"
                ) : (
                  <WingName wing={report.grandTotal.wing} />
                )}
              </td>
            </tr>
            <MetricRow
              label="প্রাপ্ত"
              counts={report.grandTotal.held}
              blankOfficer
              emphasize
            />
            <MetricRow
              label="উপস্থিত"
              counts={report.grandTotal.present}
              blankOfficer
              emphasize
            />
            <MetricRow
              label="অনুপস্থিত"
              counts={report.grandTotal.absent}
              blankOfficer
              emphasize
            />
          </tbody>
        </table>

        {/* Absence / other duties */}
        <p className="mt-3 text-[10px] font-semibold">
          * অন্যান্য কর্তব্য / Absence detail
        </p>
        <table className="mt-1 w-full border-collapse text-[8px] leading-tight">
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
              <th className="border border-neutral-800 px-0.5 py-1">সর্বমোট</th>
            </tr>
          </thead>
          <tbody>
            {report.absence.map((row) => (
              <tr key={row.wing}>
                <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
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

        {report.formNo === 3 ? (
          <p className="mt-2 text-[10px] font-medium">
            যাওয়া — {report.movement.going} &nbsp;&nbsp; আসা —{" "}
            {report.movement.coming}
          </p>
        ) : null}
      </div>
    );
  },
);
