"use client";

import { useMemo, useState } from "react";
import { IconCake } from "@tabler/icons-react";
import { PritibhojMemberDialog } from "@/components/mess/pritibhoj-member-dialog";
import { formatDateLong } from "@/lib/date";
import {
  lockPritibhojSheets,
  PRITIBHOJ_DEMO_META,
  sumPritibhojRows,
} from "@/lib/pritibhoj-demo";
import { applyPritibhojLookups } from "@/lib/store/pritibhoj-counts";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";
import type {
  PritibhojColumn,
  PritibhojEvent,
  PritibhojRoster,
  PritibhojRow,
  PritibhojSheetId,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COUNT_COLUMNS: { key: PritibhojColumn; className?: string }[] = [
  { key: "officer" },
  { key: "dad" },
  { key: "azadHall" },
  { key: "distribution", className: "pb-sky-soft bg-sky-50 dark:bg-sky-950/30" },
  { key: "others" },
  { key: "civilian" },
  { key: "nonMuslim" },
  { key: "total", className: "font-semibold" },
  { key: "azadHallDist" },
  { key: "distribution2", className: "pb-sky-soft bg-sky-50 dark:bg-sky-950/30" },
  {
    key: "totalDistribution",
    className: "pb-amber-soft bg-amber-50 font-semibold dark:bg-amber-950/30",
  },
];

function bnDigits(n: number) {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

function NumCell({
  value,
  className,
  onOpen,
}: {
  value: number;
  className?: string;
  onOpen?: () => void;
}) {
  const label = bnDigits(value);
  return (
    <td
      className={cn(
        "pb-cell border border-neutral-300 px-1.5 py-1.5 text-center text-sm tabular-nums dark:border-neutral-600",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          className="w-full rounded-md bg-transparent font-[inherit] text-inherit underline-offset-2 hover:underline"
          onClick={onOpen}
        >
          {label}
        </button>
      ) : (
        label
      )}
    </td>
  );
}

function PritibhojTable({
  rows,
  showGrand,
  footLabel,
  onOpen,
}: {
  rows: PritibhojRow[];
  showGrand?: boolean;
  footLabel: string;
  onOpen?: (wing: string, column: PritibhojColumn, count: number) => void;
}) {
  const totals = useMemo(() => sumPritibhojRows(rows), [rows]);
  const footClass: Partial<Record<PritibhojColumn, string>> = {
    distribution: "pb-sky bg-sky-100 dark:bg-sky-950/50",
    distribution2: "pb-sky bg-sky-100 dark:bg-sky-950/50",
    totalDistribution: "pb-amber bg-amber-100 dark:bg-amber-950/40",
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="pritibhoj-table w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="pb-col-sl" />
          <col className="pb-col-wing" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
          <col className="pb-col-num" />
        </colgroup>
        <thead>
          <tr className="pb-head bg-neutral-100 text-[10px] font-semibold dark:bg-neutral-800">
            <th className="pb-cell border border-neutral-300 bg-neutral-100 px-1 py-1.5 text-center whitespace-normal dark:border-neutral-600 dark:bg-neutral-800">
              ক্রমিক
            </th>
            <th className="pb-cell border border-neutral-300 bg-neutral-100 px-1 py-1.5 text-left whitespace-normal dark:border-neutral-600 dark:bg-neutral-800">
              উইং/শাখা/সেল
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              অফিসার
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              ডিএডি
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="pb-cell pb-sky border border-neutral-300 bg-sky-100 px-0.5 py-1 whitespace-normal dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              অন্যান্য পদ
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              বেসামরিক
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              নন-মুসলিম
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              মোট
            </th>
            <th className="pb-cell border border-neutral-300 px-0.5 py-1 whitespace-normal dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="pb-cell pb-sky border border-neutral-300 bg-sky-100 px-0.5 py-1 whitespace-normal dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="pb-cell pb-amber border border-neutral-300 bg-amber-100 px-0.5 py-1 whitespace-normal dark:border-neutral-600 dark:bg-amber-950/40">
              মোট বিতরণ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.wing}-${i}`}
              className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50"
            >
              <td className="pb-cell border border-neutral-300 bg-white px-0.5 py-1 text-center tabular-nums dark:border-neutral-600 dark:bg-neutral-950">
                {bnDigits(i + 1)}
              </td>
              <td className="pb-cell border border-neutral-300 bg-white px-0.5 py-1 text-left font-medium whitespace-normal dark:border-neutral-600 dark:bg-neutral-950">
                {row.wing}
              </td>
              {COUNT_COLUMNS.map((col) => (
                <NumCell
                  key={col.key}
                  value={row[col.key]}
                  className={col.className}
                  onOpen={
                    onOpen
                      ? () => onOpen(row.wing, col.key, row[col.key])
                      : undefined
                  }
                />
              ))}
            </tr>
          ))}
          <tr className="pb-foot bg-sky-50 font-semibold dark:bg-sky-950/40">
            <td
              colSpan={2}
              className="pb-cell border border-neutral-300 bg-sky-50 px-0.5 py-1 text-left whitespace-normal dark:border-neutral-600 dark:bg-sky-950/40"
            >
              {footLabel}
            </td>
            {COUNT_COLUMNS.map((col) => (
              <NumCell
                key={col.key}
                value={totals[col.key]}
                className={footClass[col.key]}
                onOpen={
                  onOpen
                    ? () => onOpen("*", col.key, totals[col.key])
                    : undefined
                }
              />
            ))}
          </tr>
          {showGrand ? (
            <tr className="pb-grand bg-sky-100 font-bold dark:bg-sky-900/50">
              <td
                colSpan={13}
                className="pb-cell border border-neutral-300 px-3 py-2.5 text-center dark:border-neutral-600"
              >
                সর্বমোট জনবল ={" "}
                {onOpen ? (
                  <button
                    type="button"
                    className="bg-transparent font-[inherit] text-inherit underline-offset-2 hover:underline"
                    onClick={() => onOpen("*", "total", totals.total)}
                  >
                    {bnDigits(totals.total)}
                  </button>
                ) : (
                  bnDigits(totals.total)
                )}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Both Pritibhoj sheets — web + print preview. */
export function PritibhojSheets({
  event,
  dateLocale,
  className,
  ctx,
  onRoster,
}: {
  event: PritibhojEvent;
  dateLocale: string;
  className?: string;
  ctx?: PritibhojCountCtx | null;
  onRoster?: (roster: PritibhojRoster) => Promise<void>;
}) {
  const dateLabel = formatDateLong(event.date, dateLocale);
  const heading = event.title || event.occasion || PRITIBHOJ_DEMO_META.titleBn;
  const org = event.org || PRITIBHOJ_DEMO_META.orgBn;
  const [open, setOpen] = useState<{
    sheet: PritibhojSheetId;
    wing: string;
    column: PritibhojColumn;
    count: number;
  } | null>(null);
  const sheets = useMemo(() => {
    const locked = lockPritibhojSheets(event);
    if (!ctx || ctx.users.length === 0) return locked;
    return lockPritibhojSheets({
      ...locked,
      main_rows: applyPritibhojLookups(
        locked.main_rows,
        event.date,
        ctx,
        event.roster,
        "main",
      ),
      admin_rows: applyPritibhojLookups(
        locked.admin_rows,
        event.date,
        ctx,
        event.roster,
        "admin",
      ),
    });
  }, [ctx, event]);
  const interactive = Boolean(ctx && ctx.users.length > 0 && onRoster);

  return (
    <div
      className={cn(
        "pritibhoj-sheets flex flex-col gap-5 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
        className,
      )}
    >
      <section className="overflow-visible rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="pb-sheet-head border-b border-neutral-200 px-4 py-3 text-center dark:border-neutral-700">
          <div className="no-print mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 print:hidden">
            <IconCake className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold leading-snug text-neutral-900 dark:text-white sm:text-base">
            {heading}
          </h2>
          {event.occasion && event.occasion !== heading ? (
            <p className="mt-1 text-xs text-neutral-500">{event.occasion}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {org}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">তারিখঃ {dateLabel}</p>
        </div>
        <PritibhojTable
          rows={sheets.main_rows}
          showGrand
          footLabel="মোট জনবল ="
          onOpen={
            interactive
              ? (wing, column, count) =>
                  setOpen({ sheet: "main", wing, column, count })
              : undefined
          }
        />
      </section>

      <section className="overflow-visible rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="pb-sheet-head border-b border-neutral-200 px-4 py-3 text-center dark:border-neutral-700">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base">
            {PRITIBHOJ_DEMO_META.adminTitleBn}
          </h2>
          <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {org}
          </p>
        </div>
        <PritibhojTable
          rows={sheets.admin_rows}
          footLabel="মোট ="
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
          rows={open.sheet === "main" ? sheets.main_rows : sheets.admin_rows}
          date={event.date}
          ctx={ctx}
          roster={event.roster}
          report={{ title: heading, org, occasion: event.occasion }}
          onClose={() => setOpen(null)}
          onRoster={onRoster}
        />
      ) : null}
    </div>
  );
}
