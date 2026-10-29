"use client";

import { Fragment, useState } from "react";
import { Input } from "@/components/ui/input";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { fromBnDigits, toBnDigits } from "@/lib/consume-official-reports";
import { formatDateDmy } from "@/lib/date";
import {
  forceRankCellKey,
  forceRankCells,
  type ForceRankForceRow,
  type ForceRankReport,
  type ForceRankWingBlock,
} from "@/lib/force-rank-report";
import { isManualPresentWing } from "@/lib/manpower-report";
import { setForceRankCell, setForceRankOfficer } from "@/lib/store/org-options";
import { cn } from "@/lib/utils";

function countText(n: number) {
  if (!n) return "-";
  return toBnDigits(n);
}

function asciiDigits(raw: string) {
  return fromBnDigits(raw).replace(/[^\d]/g, "");
}

function OfficerCountInput({
  date,
  field,
  value,
  ariaLabel,
  compact,
}: {
  date: string;
  field: "held" | "total";
  value: number;
  ariaLabel: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    const digits = asciiDigits(raw);
    const n = digits === "" ? 0 : Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    setForceRankOfficer(date, field, Math.floor(n));
    setDraft(null);
  }

  return (
    <Input
      value={toBnDigits(draft !== null ? draft : value ? String(value) : "")}
      onChange={(e) => {
        const digits = asciiDigits(e.target.value);
        setDraft(digits);
        if (digits === "") {
          setForceRankOfficer(date, field, 0);
          return;
        }
        const n = Number(digits);
        if (Number.isFinite(n) && n >= 0) {
          setForceRankOfficer(date, field, Math.floor(n));
        }
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      inputMode="numeric"
      placeholder="-"
      aria-label={ariaLabel}
      className={cn(
        "mx-auto h-7 w-14 rounded-sm border-amber-300 bg-amber-50 px-1 text-center font-mono tabular-nums shadow-none dark:border-amber-700 dark:bg-amber-950/40",
        compact ? "h-6 w-12 text-[8px]" : "text-[11px]",
      )}
    />
  );
}

function ForceRankCountInput({
  date,
  wing,
  force,
  colId,
  index,
  rank,
  value,
  ariaLabel,
  compact,
}: {
  date: string;
  wing: string;
  force: string;
  colId: string;
  index: number;
  rank: string;
  value: number;
  ariaLabel: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cellKey = forceRankCellKey(force, colId, index, rank);

  function commit(raw: string) {
    const digits = asciiDigits(raw);
    const n = digits === "" ? 0 : Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    setForceRankCell(date, wing, cellKey, Math.floor(n));
    setDraft(null);
  }

  return (
    <Input
      value={toBnDigits(draft !== null ? draft : String(value))}
      onChange={(e) => {
        const digits = asciiDigits(e.target.value);
        setDraft(digits);
        if (digits === "") {
          setForceRankCell(date, wing, cellKey, 0);
          return;
        }
        const n = Number(digits);
        if (Number.isFinite(n) && n >= 0) {
          setForceRankCell(date, wing, cellKey, Math.floor(n));
        }
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      inputMode="numeric"
      aria-label={ariaLabel}
      className={cn(
        "mx-auto h-6 w-full min-w-0 max-w-[2.75rem] rounded-sm border-amber-300 bg-amber-50 px-0.5 text-center font-mono tabular-nums shadow-none dark:border-amber-700 dark:bg-amber-950/40",
        compact ? "text-[8px]" : "text-[11px]",
      )}
    />
  );
}

function fallbackWing(report: ForceRankReport): ForceRankWingBlock[] {
  if (report.forces.length) {
    return [
      {
        wing: report.filterWing || "—",
        labelBn: report.filterWing && report.filterWing !== "all" ? report.filterWing : "—",
        forces: report.forces,
        total: report.forces.reduce((sum, row) => sum + row.total, 0),
      },
    ];
  }
  return [];
}

function ForceRankWingTable({
  report,
  wing,
  forces,
  compact,
  head,
  cell,
  editable,
}: {
  report: ForceRankReport;
  wing: string;
  forces: ForceRankForceRow[];
  compact?: boolean;
  head: string;
  cell: string;
  editable?: boolean;
}) {
  const manual = Boolean(editable && isManualPresentWing(wing));
  return (
    <table className="force-rank-main w-full border-collapse">
      <thead>
        <tr>
          <th className={cn(head, "text-left")}>বাহিনী</th>
          {report.columns.map((col) => (
            <th key={col.id} className={head} colSpan={col.span}>
              {col.labelBn}
            </th>
          ))}
          <th className={head}>মোট</th>
        </tr>
      </thead>
      <tbody>
        {forces.map((row) => (
          <Fragment key={row.force}>
            <tr>
              <th
                rowSpan={2}
                className={cn(
                  "border border-black px-1.5 py-1 text-left font-bold align-middle",
                  compact ? "text-[10px]" : "text-[12px]",
                )}
              >
                {row.labelBn}
              </th>
              {report.columns.map((col) =>
                forceRankCells(row, col).map((item, i) => (
                  <td
                    key={`${row.force}-${col.id}-n-${i}`}
                    colSpan={item.span || 1}
                    className={cn(cell, "font-medium leading-tight")}
                  >
                    {item.labelBn}
                  </td>
                )),
              )}
              <td className={cn(cell, "font-bold")}>মোট</td>
            </tr>
            <tr>
              {report.columns.map((col) =>
                forceRankCells(row, col).map((item, i) => (
                  <td
                    key={`${row.force}-${col.id}-c-${i}`}
                    colSpan={item.span || 1}
                    className={cn(cell, "tabular-nums")}
                  >
                    {manual || (editable && col.id === "dad") ? (
                      <ForceRankCountInput
                        date={report.date}
                        wing={wing}
                        force={row.force}
                        colId={col.id}
                        index={i}
                        rank={item.rank}
                        value={item.count}
                        ariaLabel={`${wing} ${row.labelBn} ${col.labelBn} ${item.labelBn}`}
                        compact={compact}
                      />
                    ) : (
                      countText(item.count)
                    )}
                  </td>
                )),
              )}
              <td className={cn(cell, "font-bold tabular-nums")}>
                {countText(row.total)}
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function ForceRankSheet({
  report,
  compact,
  className,
  editable,
}: {
  report: ForceRankReport;
  compact?: boolean;
  className?: string;
  editable?: boolean;
}) {
  const dateBn = formatDateDmy(report.date, "bn-BD").replace(/-/g, "/");
  const org = report.orgBn || CONSUME_REPORT_META.orgNameBn;
  const head = cn(
    "border border-black bg-white px-1 py-1 text-center font-bold",
    compact ? "text-[9px]" : "text-[12px]",
  );
  const cell = cn(
    "border border-black px-0.5 py-0.5 text-center",
    compact ? "text-[8px]" : "text-[11px]",
  );

  return (
    <div className={cn("text-black", className)}>
      <header className="force-rank-header mb-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div />
        <div className="force-rank-titles text-center">
          <h2
            className={cn(
              "font-bold leading-tight",
              compact ? "text-[13px]" : "text-lg",
            )}
          >
            {org}
          </h2>
          <p
            className={cn(
              "font-bold leading-tight",
              compact ? "mt-0.5 text-[12px]" : "mt-0.5 text-base",
            )}
          >
            {report.titleBn}
          </p>
        </div>
        <p
          className={cn(
            "force-rank-date text-right font-semibold tabular-nums",
            compact ? "text-[10px]" : "text-sm",
          )}
        >
          {`তারিখ-${dateBn}`}
        </p>
      </header>

      {(report.wings.length ? report.wings : fallbackWing(report)).map(
        (block) => (
          <section
            key={block.wing}
            className="force-rank-wing mt-3 break-inside-avoid first:mt-0"
          >
            <h3
              className={cn(
                "force-rank-wing-title mb-1 font-bold",
                compact ? "text-[11px]" : "text-sm",
              )}
            >
              {`উইং: ${block.labelBn}`}
            </h3>
            <ForceRankWingTable
              report={report}
              wing={block.wing}
              forces={block.forces}
              compact={compact}
              head={head}
              cell={cell}
              editable={editable}
            />
          </section>
        ),
      )}

      <table className="force-rank-footer mt-3 w-full border-collapse">
        <tbody>
          <tr>
            <td className="border-0 p-0 align-bottom">
              <table className="force-rank-officer border-collapse">
                <thead>
                  <tr>
                    <th className={cn(head, "min-w-[4.5rem]")} />
                    <th className={cn(head, "min-w-[3.5rem]")}>প্রাপ্ত</th>
                    <th className={cn(head, "min-w-[3.5rem]")}>মোট</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th
                      className={cn(
                        "border border-black px-2 py-1 text-left font-bold",
                        compact ? "text-[10px]" : "text-[12px]",
                      )}
                    >
                      অফিসার
                    </th>
                    <td className={cn(cell, "tabular-nums")}>
                      {editable ? (
                        <OfficerCountInput
                          date={report.date}
                          field="held"
                          value={report.officerHeld}
                          ariaLabel="অফিসার প্রাপ্ত"
                          compact={compact}
                        />
                      ) : (
                        countText(report.officerHeld)
                      )}
                    </td>
                    <td className={cn(cell, "tabular-nums")}>
                      {editable ? (
                        <OfficerCountInput
                          date={report.date}
                          field="total"
                          value={report.officerTotal}
                          ariaLabel="অফিসার মোট"
                          compact={compact}
                        />
                      ) : (
                        countText(report.officerTotal)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td
              className={cn(
                "force-rank-grand border-0 p-0 text-right align-bottom font-bold tabular-nums",
                compact ? "text-[12px]" : "text-base",
              )}
            >
              {`সর্বমোট-${countText(report.grandTotal)}`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
