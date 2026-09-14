"use client";

import { useState, type ReactNode } from "react";
import { WingName } from "@/components/manpower/wing-name";
import { Input } from "@/components/ui/input";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import {
  formatManpowerCell,
  manpowerRowTotal,
  type ManpowerAbsenceRow,
  type ManpowerCounts,
  type ManpowerReport,
  type ManpowerWingBlock,
  type ManpowerWingGroup,
} from "@/lib/manpower-report";
import {
  setManpowerAbsentCount,
  setManpowerHeld,
} from "@/lib/store/org-options";
import { authorizedLabelBn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type Props = {
  report: ManpowerReport;
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
        "border border-neutral-200 px-2 py-1.5 text-center text-sm tabular-nums dark:border-neutral-700",
        className,
      )}
    >
      {formatManpowerCell(value, { signed })}
    </td>
  );
}

function WingNameCell({
  children,
  emphasize,
}: {
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <td
      rowSpan={4}
      className={cn(
        "sticky left-0 z-[2] w-36 border border-neutral-200 px-3 py-1.5 text-left text-sm font-semibold align-middle dark:border-neutral-700",
        emphasize
          ? "bg-neutral-100 dark:bg-neutral-800/80"
          : "bg-white dark:bg-neutral-900",
      )}
    >
      {children}
    </td>
  );
}

function MetricRow({
  label,
  counts,
  categories,
  emphasize,
  signed,
  wingCell,
  withWing,
}: {
  label: ReactNode;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  emphasize?: boolean;
  signed?: boolean;
  wingCell?: ReactNode;
  withWing?: boolean;
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

function CountInput({
  value,
  ariaLabel,
  onCommit,
}: {
  value: number;
  ariaLabel: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    const n = digits === "" ? 0 : Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    onCommit(Math.floor(n));
    setDraft(null);
  }

  return (
    <td className="border border-neutral-200 px-1 py-1 text-center dark:border-neutral-700">
      <Input
        value={draft !== null ? draft : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          setDraft(digits);
          if (digits === "") {
            onCommit(0);
            return;
          }
          const n = Number(digits);
          if (Number.isFinite(n) && n >= 0) onCommit(Math.floor(n));
        }}
        onBlur={() => {
          if (draft !== null) commit(draft);
          setDraft(null);
        }}
        inputMode="numeric"
        aria-label={ariaLabel}
        className="mx-auto h-8 w-14 rounded-md border-amber-300 bg-amber-50 text-center font-mono text-sm tabular-nums dark:border-amber-700 dark:bg-amber-950/40"
      />
    </td>
  );
}

function InputMetricRow({
  label,
  counts,
  categories,
  date,
  wing,
  kind,
  withWing,
}: {
  label: string;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  date: string;
  wing: string;
  kind: "held" | "absent";
  withWing?: boolean;
}) {
  return (
    <tr>
      <td
        className={cn(
          "sticky z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900",
          withWing ? "left-36" : "left-0",
        )}
      >
        {label}
      </td>
      {categories.map((cat) => (
        <CountInput
          key={`${date}-${wing}-${cat.id}-${kind}`}
          value={counts[cat.id] ?? 0}
          ariaLabel={`${authorizedLabelBn(cat.label)} ${label} — ${wing}`}
          onCommit={(n) => {
            if (kind === "held") setManpowerHeld(date, wing, cat.id, n);
            else setManpowerAbsentCount(date, wing, cat.id, n);
          }}
        />
      ))}
      <Cell value={manpowerRowTotal(counts)} className="font-semibold" />
    </tr>
  );
}

function BlockRows({
  date,
  wing,
  wingLabel,
  authorized,
  held,
  shortfall,
  absent,
  categories,
  editable,
  emphasize,
}: {
  date: string;
  wing: string;
  /** Paper: wing name spans the four field rows. */
  wingLabel?: ReactNode;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
  shortfall: ManpowerCounts;
  absent: ManpowerCounts;
  categories: ManpowerReport["categories"];
  editable?: boolean;
  emphasize?: boolean;
}) {
  const withWing = wingLabel != null;
  return (
    <>
      <MetricRow
        label="প্রাধিকৃত"
        counts={authorized}
        categories={categories}
        emphasize={emphasize}
        withWing={withWing}
        wingCell={
          withWing ? (
            <WingNameCell emphasize={emphasize}>{wingLabel}</WingNameCell>
          ) : undefined
        }
      />
      {editable ? (
        <InputMetricRow
          label="প্রাপ্ত"
          counts={held}
          categories={categories}
          date={date}
          wing={wing}
          kind="held"
          withWing={withWing}
        />
      ) : (
        <MetricRow
          label="প্রাপ্ত"
          counts={held}
          categories={categories}
          emphasize={emphasize}
          withWing={withWing}
        />
      )}
      <MetricRow
        label="বৃদ্ধি/হ্রাস"
        counts={shortfall}
        categories={categories}
        emphasize={emphasize}
        signed
        withWing={withWing}
      />
      {editable ? (
        <InputMetricRow
          label="অনুপস্থিত"
          counts={absent}
          categories={categories}
          date={date}
          wing={wing}
          kind="absent"
          withWing={withWing}
        />
      ) : (
        <MetricRow
          label="অনুপস্থিত"
          counts={absent}
          categories={categories}
          emphasize={emphasize}
          withWing={withWing}
        />
      )}
    </>
  );
}

function RankHead({
  categories,
  withWing,
}: {
  categories: ManpowerReport["categories"];
  withWing?: boolean;
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

function StrengthCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">{children}</table>
      </div>
    </section>
  );
}

function fallbackGroups(
  wings: ManpowerWingBlock[],
  absence: ManpowerAbsenceRow[],
): ManpowerWingGroup[] {
  return [
    {
      id: "main",
      titleBn: "উইং",
      wings,
      absence,
    },
  ];
}

function AbsenceTable({
  title,
  rows,
}: {
  title: string;
  rows: ManpowerAbsenceRow[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <h3 className="border-b border-neutral-200 px-3 py-2 text-sm font-bold dark:border-neutral-700">
        {title}
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
            {rows.map((row) => (
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
      </div>
    </section>
  );
}

/** Screen / tab panel view of Form 1 (not print letter). */
export function ManpowerWeb({ report }: Props) {
  const { locale } = useI18n();
  const { date, categories, hq, wings, absence } = report;
  const dateLabel = formatDateLong(date, locale === "bn" ? "bn-BD" : "en-GB");

  return (
    <div className="flex flex-col gap-6 p-1 sm:p-2">
      <section className="overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <header className="border-b border-neutral-300 px-3 py-3 text-center dark:border-neutral-700">
          <p className="text-[11px] font-semibold">
            {CONSUME_REPORT_META.orgNameBn}
          </p>
          <h2 className="mt-0.5 text-base font-bold tracking-wide">
            দৈনিক জনবলের প্রতিবেদন
          </h2>
          <p className="text-[10px] text-neutral-600 dark:text-neutral-400">
            Daily Manpower Report · {CONSUME_REPORT_META.stationBn}
          </p>
          <p className="mt-1 text-xs font-medium">তারিখ / Date: {dateLabel}</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <RankHead categories={categories} />
            </thead>
            <tbody>
              <BlockRows
                date={date}
                wing="hq"
                authorized={hq.authorized}
                held={hq.held}
                shortfall={hq.shortfall}
                absent={hq.absent}
                categories={categories}
              />
            </tbody>
          </table>
        </div>
      </section>

      {(report.groups?.length ? report.groups : fallbackGroups(wings, absence)).map(
        (group) => (
          <section key={group.id} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-bold">{group.titleBn}</h3>
            <StrengthCard>
              <thead>
                <RankHead categories={categories} withWing />
              </thead>
              <tbody>
                {group.wings.map((block: ManpowerWingBlock) => (
                  <BlockRows
                    key={block.wing}
                    date={date}
                    wing={block.wing}
                    wingLabel={<WingName wing={block.wing} />}
                    authorized={block.authorized}
                    held={block.held}
                    shortfall={block.shortfall}
                    absent={block.absent}
                    categories={categories}
                    editable
                  />
                ))}
              </tbody>
            </StrengthCard>
          </section>
        ),
      )}

      {(report.groups?.length ? report.groups : fallbackGroups(wings, absence)).map(
        (group) => (
          <AbsenceTable
            key={`abs-${group.id}`}
            title={`অনুপস্থিতির বিবরণ · ${group.titleBn}`}
            rows={group.absence}
          />
        ),
      )}
    </div>
  );
}
