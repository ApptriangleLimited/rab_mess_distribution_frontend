"use client";

import { useMemo } from "react";
import { IconCake } from "@tabler/icons-react";
import { formatDateLong } from "@/lib/date";
import {
  lockPritibhojSheets,
  PRITIBHOJ_DEMO_META,
  sumPritibhojRows,
} from "@/lib/pritibhoj-demo";
import type { PritibhojEvent, PritibhojRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function bnDigits(n: number) {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

function NumCell({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "pb-cell border border-neutral-300 px-1.5 py-1.5 text-center text-sm tabular-nums dark:border-neutral-600",
        className,
      )}
    >
      {bnDigits(value)}
    </td>
  );
}

function PritibhojTable({
  rows,
  showGrand,
  footLabel,
}: {
  rows: PritibhojRow[];
  showGrand?: boolean;
  footLabel: string;
}) {
  const totals = useMemo(() => sumPritibhojRows(rows), [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="pritibhoj-table w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="pb-head bg-neutral-100 text-[11px] font-semibold dark:bg-neutral-800">
            <th className="pb-cell sticky left-0 z-[1] border border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-600 dark:bg-neutral-800">
              ক্রমিক
            </th>
            <th className="pb-cell sticky left-10 z-[1] border border-neutral-300 bg-neutral-100 px-2 py-2 text-left dark:border-neutral-600 dark:bg-neutral-800">
              উইং/শাখা/সেল
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              অফিসার
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              ডিএডি
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="pb-cell pb-sky border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              অন্যান্য
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              বেসামরিক
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              নন-মুসলিম
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              মোট
            </th>
            <th className="pb-cell border border-neutral-300 px-2 py-2 dark:border-neutral-600">
              আজাদ হল
            </th>
            <th className="pb-cell pb-sky border border-neutral-300 bg-sky-100 px-2 py-2 dark:border-neutral-600 dark:bg-sky-950/50">
              বিতরণ
            </th>
            <th className="pb-cell pb-amber border border-neutral-300 bg-amber-100 px-2 py-2 dark:border-neutral-600 dark:bg-amber-950/40">
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
              <td className="pb-cell sticky left-0 z-[1] border border-neutral-300 bg-white px-2 py-1.5 text-center tabular-nums dark:border-neutral-600 dark:bg-neutral-950">
                {bnDigits(i + 1)}
              </td>
              <td className="pb-cell sticky left-10 z-[1] border border-neutral-300 bg-white px-2 py-1.5 text-left font-medium dark:border-neutral-600 dark:bg-neutral-950">
                {row.wing}
              </td>
              <NumCell value={row.officer} />
              <NumCell value={row.dad} />
              <NumCell value={row.azadHall} />
              <NumCell
                value={row.distribution}
                className="pb-sky-soft bg-sky-50 dark:bg-sky-950/30"
              />
              <NumCell value={row.others} />
              <NumCell value={row.civilian} />
              <NumCell value={row.nonMuslim} />
              <NumCell value={row.total} className="font-semibold" />
              <NumCell value={row.azadHallDist} />
              <NumCell
                value={row.distribution2}
                className="pb-sky-soft bg-sky-50 dark:bg-sky-950/30"
              />
              <NumCell
                value={row.totalDistribution}
                className="pb-amber-soft bg-amber-50 font-semibold dark:bg-amber-950/30"
              />
            </tr>
          ))}
          <tr className="pb-foot bg-sky-50 font-semibold dark:bg-sky-950/40">
            <td
              colSpan={2}
              className="pb-cell sticky left-0 z-[1] border border-neutral-300 bg-sky-50 px-2 py-2 text-left dark:border-neutral-600 dark:bg-sky-950/40"
            >
              {footLabel}
            </td>
            <NumCell value={totals.officer} />
            <NumCell value={totals.dad} />
            <NumCell value={totals.azadHall} />
            <NumCell
              value={totals.distribution}
              className="pb-sky bg-sky-100 dark:bg-sky-950/50"
            />
            <NumCell value={totals.others} />
            <NumCell value={totals.civilian} />
            <NumCell value={totals.nonMuslim} />
            <NumCell value={totals.total} />
            <NumCell value={totals.azadHallDist} />
            <NumCell
              value={totals.distribution2}
              className="pb-sky bg-sky-100 dark:bg-sky-950/50"
            />
            <NumCell
              value={totals.totalDistribution}
              className="pb-amber bg-amber-100 dark:bg-amber-950/40"
            />
          </tr>
          {showGrand ? (
            <tr className="pb-grand bg-sky-100 font-bold dark:bg-sky-900/50">
              <td
                colSpan={13}
                className="pb-cell border border-neutral-300 px-3 py-2.5 text-center dark:border-neutral-600"
              >
                সর্বমোট জনবল = {bnDigits(totals.total)}
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
}: {
  event: PritibhojEvent;
  dateLocale: string;
  className?: string;
}) {
  const dateLabel = formatDateLong(event.date, dateLocale);
  const heading = event.title || event.occasion || PRITIBHOJ_DEMO_META.titleBn;
  const org = event.org || PRITIBHOJ_DEMO_META.orgBn;
  const sheets = lockPritibhojSheets(event);

  return (
    <div
      className={cn(
        "pritibhoj-sheets flex flex-col gap-5 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
        className,
      )}
    >
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-4 py-3 text-center dark:border-neutral-700">
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
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 px-4 py-3 text-center dark:border-neutral-700">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base">
            {PRITIBHOJ_DEMO_META.adminTitleBn}
          </h2>
          <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {org}
          </p>
        </div>
        <PritibhojTable rows={sheets.admin_rows} footLabel="মোট =" />
      </section>
    </div>
  );
}
