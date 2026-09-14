"use client";

import { forwardRef, type ReactNode } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import { RankColumnHeader } from "@/components/manpower/rank-column-header";
import { WingName } from "@/components/manpower/wing-name";
import {
  formatManpowerCell,
  manpowerRowTotal,
  type ManpowerAbsenceRow,
  type ManpowerCounts,
  type ManpowerReport,
  type ManpowerWingGroup,
} from "@/lib/manpower-report";
import { authorizedLabelBn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";

type Props = {
  report: ManpowerReport;
  locale?: string;
};

function Cell({
  value,
  signed,
  className,
}: {
  value: number;
  signed?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border border-neutral-800 px-0.5 py-0.5 text-center tabular-nums",
        className,
      )}
    >
      {formatManpowerCell(value, { signed })}
    </td>
  );
}

function MetricRow({
  label,
  counts,
  categories,
  emphasize,
  signed,
}: {
  label: ReactNode;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  emphasize?: boolean;
  signed?: boolean;
  wingCell?: ReactNode;
}) {
  return (
    <tr className={emphasize ? "bg-neutral-50 font-semibold" : undefined}>
      {wingCell}
      <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
        {label}
      </td>
      {categories.map((cat) => (
        <Cell
          key={cat.id}
          value={counts[cat.id] ?? 0}
          signed={signed}
        />
      ))}
      <Cell
        value={manpowerRowTotal(counts)}
        signed={signed}
        className="font-semibold"
      />
    </tr>
  );
}

/** Printable Daily Manpower Report (landscape). */
export const ManpowerLetter = forwardRef<HTMLDivElement, Props>(
  function ManpowerLetter({ report, locale = "bn-BD" }, ref) {
    const dateLabel = formatDateLong(report.date, locale);
    const { categories, hq, wings, absence } = report;

    return (
      <div
        ref={ref}
        className="mx-auto w-full max-w-[297mm] bg-white p-4 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="border-b border-neutral-800 pb-2 text-center">
          <p className="text-[11px] font-semibold">
            {CONSUME_REPORT_META.orgNameBn}
          </p>
          <h1 className="mt-0.5 text-base font-bold tracking-wide">
            দৈনিক জনবলের প্রতিবেদন
          </h1>
          <p className="text-[10px] text-neutral-600">
            Daily Manpower Report · {CONSUME_REPORT_META.stationBn}
          </p>
          <p className="mt-1 text-xs font-medium">তারিখ / Date: {dateLabel}</p>
        </header>

        <StrengthTable categories={categories} className="mt-3">
          <MetricRow
            label="প্রাধিকৃত"
            counts={hq.authorized}
            categories={categories}
            emphasize
          />
          <MetricRow
            label="প্রাপ্ত"
            counts={hq.held}
            categories={categories}
          />
          <MetricRow
            label="বৃদ্ধি/হ্রাস"
            counts={hq.shortfall}
            categories={categories}
            signed
          />
          <MetricRow
            label="অনুপস্থিত"
            counts={hq.absent}
            categories={categories}
          />
        </StrengthTable>

        {(report.groups?.length
          ? report.groups
          : [{ id: "main", titleBn: "উইং", wings, absence } as ManpowerWingGroup]
        ).map((group) => (
          <div key={group.id}>
            <p className="mt-5 text-[10px] font-semibold">{group.titleBn}</p>
            <StrengthTable categories={categories} className="mt-1" withWing>
              {group.wings.map((block) => (
                <WingGroup
                  key={block.wing}
                  wing={block.wing}
                  authorized={block.authorized}
                  held={block.held}
                  shortfall={block.shortfall}
                  absent={block.absent}
                  categories={categories}
                />
              ))}
            </StrengthTable>
            <p className="mt-4 text-[10px] font-semibold">
              * অনুপস্থিতির বিবরণ · {group.titleBn}
            </p>
            <LetterAbsenceTable rows={group.absence} />
          </div>
        ))}

      </div>
    );
  },
);

function LetterAbsenceTable({ rows }: { rows: ManpowerAbsenceRow[] }) {
  return (
    <table className="mt-1 w-full border-collapse text-[9px] leading-tight">
      <thead>
        <tr className="bg-neutral-100">
          <th
            rowSpan={2}
            className="border border-neutral-800 px-1 py-1 text-left align-middle"
          >
            উইং
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            সিএল
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            পিএল
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            আরএল
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            এমএল
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            মাতৃত্ব
          </th>
          <th
            colSpan={4}
            className="border border-neutral-800 px-0.5 py-1 text-center font-semibold"
          >
            অস্থায়ী জনবলের বিবরণ
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            হাসপাতাল
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            গড় উপস্থিত
          </th>
          <th
            rowSpan={2}
            className="border border-neutral-800 px-0.5 py-1 align-middle"
          >
            মোট
          </th>
        </tr>
        <tr className="bg-neutral-100">
          <th className="border border-neutral-800 px-0.5 py-1">প্রশিক্ষণ</th>
          <th className="border border-neutral-800 px-0.5 py-1">সাক্ষী</th>
          <th className="border border-neutral-800 px-0.5 py-1">পরীক্ষা</th>
          <th className="border border-neutral-800 px-0.5 py-1">অন্যান্য</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.wing}>
            <td className="border border-neutral-800 px-1 py-0.5 text-left font-medium">
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
        <tr className="bg-neutral-50 font-semibold">
          <td className="border border-neutral-800 px-1 py-0.5">সর্বমোট</td>
          <Cell value={rows.reduce((s, r) => s + r.cl, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.pl, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.rl, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.ml, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.maternity, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.training, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.witness, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.exam, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.other, 0)} />
          <Cell value={rows.reduce((s, r) => s + r.hospital, 0)} />
          <Cell
            value={rows.reduce((s, r) => s + r.avgPresent, 0)}
            className="font-semibold"
          />
          <Cell
            value={rows.reduce((s, r) => s + r.total, 0)}
            className="font-semibold"
          />
        </tr>
      </tbody>
    </table>
  );
}

function StrengthTable({
  categories,
  className,
  children,
  withWing,
}: {
  categories: ManpowerReport["categories"];
  className?: string;
  children: ReactNode;
  withWing?: boolean;
}) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-[9px] leading-tight",
        className,
      )}
    >
      <thead>
        <tr className="bg-neutral-100">
          {withWing ? (
            <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
              উইং
            </th>
          ) : null}
          <th className="border border-neutral-800 px-1 py-1 text-left font-semibold">
            বিবরণ
          </th>
          {categories.map((cat) => (
            <RankColumnHeader
              key={cat.id}
              labelBn={authorizedLabelBn(cat.label)}
            />
          ))}
          <th className="border border-neutral-800 px-0.5 py-1 font-semibold">
            মোট
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function WingGroup({
  wing,
  authorized,
  held,
  shortfall,
  absent,
  categories,
  emphasize,
}: {
  wing: string;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
  shortfall: ManpowerCounts;
  absent: ManpowerCounts;
  categories: ManpowerReport["categories"];
  emphasize?: boolean;
}) {
  const isGrand = wing === "সর্বমোট";
  return (
    <>
      <MetricRow
        label="প্রাধিকৃত"
        counts={authorized}
        categories={categories}
        emphasize={emphasize}
        wingCell={
          <td
            rowSpan={4}
            className={cn(
              "border border-neutral-800 px-1 py-0.5 text-left align-middle font-bold",
              emphasize ? "bg-neutral-50" : undefined,
            )}
          >
            {isGrand ? "সর্বমোট" : <WingName wing={wing} />}
          </td>
        }
      />
      <MetricRow
        label="প্রাপ্ত"
        counts={held}
        categories={categories}
        emphasize={emphasize}
      />
      <MetricRow
        label="বৃদ্ধি/হ্রাস"
        counts={shortfall}
        categories={categories}
        emphasize={emphasize}
        signed
      />
      <MetricRow
        label="অনুপস্থিত"
        counts={absent}
        categories={categories}
        emphasize={emphasize}
      />
    </>
  );
}
