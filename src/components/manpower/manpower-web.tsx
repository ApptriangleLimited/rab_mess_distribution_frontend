"use client";

import { useState, type ReactNode } from "react";
import { StrengthReportTitle } from "@/components/manpower/strength-title";
import { WingName } from "@/components/manpower/wing-name";
import { Input } from "@/components/ui/input";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { fromBnDigits, toBnDigits } from "@/lib/consume-official-reports";
import {
  ABSENCE_DETAIL_FIELDS,
  formatManpowerCell,
  isManualPresentWing,
  manpowerRowTotalFor,
  type ManpowerAbsenceRow,
  type ManpowerCounts,
  type ManpowerReport,
  type ManpowerWingBlock,
  type ManpowerWingGroup,
} from "@/lib/manpower-report";
import {
  setManpowerAbsenceDetail,
  setManpowerAbsentCount,
  setManpowerHeld,
  setManpowerPresentCount,
} from "@/lib/store/org-options";
import { useStore } from "@/hooks/use-store";
import { form1RankLabelBn, isForm1RankColumn } from "@/lib/rank-labels";
import { cn } from "@/lib/utils";

type Props = {
  report: ManpowerReport;
  readOnly?: boolean;
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
      {toBnDigits(formatManpowerCell(value, { signed }))}
    </td>
  );
}

function WingNameCell({
  children,
  emphasize,
  rowSpan = 4,
}: {
  children: ReactNode;
  emphasize?: boolean;
  rowSpan?: number;
}) {
  return (
    <td
      rowSpan={rowSpan}
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
        value={manpowerRowTotalFor(counts, categories)}
        signed={signed}
        className="font-semibold"
      />
    </tr>
  );
}

function asciiDigits(raw: string) {
  return fromBnDigits(raw).replace(/[^\d]/g, "");
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
    const digits = asciiDigits(raw);
    const n = digits === "" ? 0 : Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    onCommit(Math.floor(n));
    setDraft(null);
  }

  return (
    <td className="border border-neutral-200 px-1 py-1 text-center dark:border-neutral-700">
      <Input
        value={toBnDigits(draft !== null ? draft : String(value))}
        onChange={(e) => {
          const digits = asciiDigits(e.target.value);
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
  emphasize,
}: {
  label: string;
  counts: ManpowerCounts;
  categories: ManpowerReport["categories"];
  date: string;
  wing: string;
  kind: "held" | "absent" | "present";
  withWing?: boolean;
  emphasize?: boolean;
}) {
  if (!isManualPresentWing(wing)) {
    return (
      <MetricRow
        label={label}
        counts={counts}
        categories={categories}
        emphasize={emphasize}
        withWing={withWing}
      />
    );
  }
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
          ariaLabel={`${form1RankLabelBn(cat.label)} ${label} — ${wing}`}
          onCommit={(n) => {
            if (kind === "held") setManpowerHeld(date, wing, cat.id, n);
            else if (kind === "present") setManpowerPresentCount(date, wing, cat.id, n);
            else
              setManpowerAbsentCount(date, wing, cat.id, n, {
                ...counts,
                [cat.id]: n,
              });
          }}
        />
      ))}
      <Cell value={manpowerRowTotalFor(counts, categories)} className="font-semibold" />
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
  present,
  absent,
  categories,
  editable,
  emphasize,
  showShortfall = false,
}: {
  date: string;
  wing: string;
  /** Paper: wing name spans the field rows. */
  wingLabel?: ReactNode;
  authorized: ManpowerCounts;
  held: ManpowerCounts;
  shortfall: ManpowerCounts;
  present: ManpowerCounts;
  absent: ManpowerCounts;
  categories: ManpowerReport["categories"];
  editable?: boolean;
  emphasize?: boolean;
  /** বৃদ্ধি/হ্রাস only on the HQ summary, not per-wing rows. */
  showShortfall?: boolean;
}) {
  const withWing = wingLabel != null;
  const manual = Boolean(editable && isManualPresentWing(wing));

  function dutyRow(
    label: string,
    counts: ManpowerCounts,
    kind: "held" | "present" | "absent",
    signed?: boolean,
  ) {
    if (!manual) {
      return (
        <MetricRow
          label={label}
          counts={counts}
          categories={categories}
          emphasize={emphasize}
          signed={signed}
          withWing={withWing}
        />
      );
    }
    return (
      <InputMetricRow
        label={label}
        counts={counts}
        categories={categories}
        date={date}
        wing={wing}
        kind={kind}
        withWing={withWing}
        emphasize={emphasize}
      />
    );
  }

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
            <WingNameCell
              emphasize={emphasize}
              rowSpan={showShortfall ? 5 : 4}
            >
              {wingLabel}
            </WingNameCell>
          ) : undefined
        }
      />
      {dutyRow("প্রাপ্ত", held, "held")}
      {showShortfall ? (
        <MetricRow
          label="বৃদ্ধি/হ্রাস"
          counts={shortfall}
          categories={categories}
          emphasize={emphasize}
          signed
          withWing={withWing}
        />
      ) : null}
      {dutyRow("উপস্থিত", present, "present")}
      {dutyRow("অনুপস্থিত", absent, "absent")}
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
  const state = useStore();
  const cols = categories.filter((cat) => isForm1RankColumn(cat.label));
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
      {cols.map((cat) => (
        <th
          key={cat.id}
          className="border border-neutral-200 px-2 py-2 text-xs font-semibold dark:border-neutral-700"
        >
          {form1RankLabelBn(cat.label, state.rank_labels_bn)}
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
  date,
  editable,
}: {
  title: string;
  rows: ManpowerAbsenceRow[];
  date: string;
  editable?: boolean;
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
            {rows.map((row) => {
              const manual = Boolean(editable && isManualPresentWing(row.wing));
              return (
                <tr key={row.wing}>
                  <td className="sticky left-0 z-[1] border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900">
                    <WingName wing={row.wing} />
                  </td>
                  {ABSENCE_DETAIL_FIELDS.map((field) =>
                    manual ? (
                      <CountInput
                        key={`${date}-${row.wing}-${field}`}
                        value={row[field]}
                        ariaLabel={`${field} — ${row.wing}`}
                        onCommit={(n) => {
                          const next: Record<string, number> = {};
                          for (const key of ABSENCE_DETAIL_FIELDS) {
                            next[key] = key === field ? n : row[key];
                          }
                          setManpowerAbsenceDetail(
                            date,
                            row.wing,
                            field,
                            n,
                            next,
                          );
                        }}
                      />
                    ) : (
                      <Cell
                        key={field}
                        value={row[field]}
                        className={
                          field === "avgPresent" ? "font-semibold" : undefined
                        }
                      />
                    ),
                  )}
                  <Cell value={row.total} className="font-semibold" />
                </tr>
              );
            })}
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
export function ManpowerWeb({ report, readOnly = false }: Props) {
  const { date, hq, wings, absence, grandTotal } = report;
  const categories = report.categories.filter((c) =>
    isForm1RankColumn(c.label),
  );

  return (
    <div className="flex flex-col gap-6 p-1 sm:p-2">
      <section className="overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <StrengthReportTitle
          titleBn="দৈনিক জনবলের প্রতিবেদন"
          wingLabel={CONSUME_REPORT_META.orgNameBn}
          date={date}
          locale="bn-BD"
        />
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
                present={hq.present}
                absent={hq.absent}
                categories={categories}
                showShortfall
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
                    present={block.present}
                    absent={block.absent}
                    categories={categories}
                    editable={!readOnly}
                  />
                ))}
                <BlockRows
                  date={date}
                  wing={grandTotal.wing}
                  wingLabel="সর্বমোট"
                  authorized={grandTotal.authorized}
                  held={grandTotal.held}
                  shortfall={grandTotal.shortfall}
                  present={grandTotal.present}
                  absent={grandTotal.absent}
                  categories={categories}
                  emphasize
                />
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
            date={date}
            editable={!readOnly}
          />
        ),
      )}
    </div>
  );
}
