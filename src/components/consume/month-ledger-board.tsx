"use client";

import { useMemo } from "react";
import { TAG_CELL } from "@/components/daily/register-board";
import { dateInMonth, todayISO } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
};

export function MonthLedgerBoard({
  month,
  dayCount,
  tagCodes,
  rows,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const today = todayISO();
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const todayDay = today.startsWith(month)
    ? Number(today.slice(8, 10))
    : null;

  return (
    <div
      className={cn(
        "relative z-10 overflow-hidden rounded-xl border shadow-sm",
        "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {t("consume.ledgerBoardHint")}
        </p>
        <p className="shrink-0 text-[11px] font-medium tabular-nums text-neutral-500">
          {rows.length} · {month}
        </p>
      </div>

      <div className="max-h-[min(72vh,760px)] overflow-auto bg-white dark:bg-neutral-950">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-30">
            <tr className="bg-neutral-100 text-[11px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
              <th className="sticky left-0 z-40 w-9 border-b border-r border-neutral-300 bg-neutral-100 px-1 py-2 text-center dark:border-neutral-700 dark:bg-neutral-900">
                {t("daily.colSerial")}
              </th>
              <th className="sticky left-9 z-40 w-[92px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                {t("daily.colId")}
              </th>
              <th className="sticky left-[128px] z-40 w-[96px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                {t("cc.fields.rank")}
              </th>
              <th className="sticky left-[224px] z-40 min-w-[140px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                {t("cc.fields.name")}
              </th>
              {days.map((d) => {
                const isToday = todayDay === d;
                const isFuture = dateInMonth(month, d) > today;
                return (
                  <th
                    key={d}
                    className={cn(
                      "w-9 min-w-9 border-b border-r border-neutral-300 px-0 py-2 text-center dark:border-neutral-700",
                      isToday &&
                        "bg-primary/15 text-primary dark:bg-primary/25",
                      isFuture &&
                        "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/50 dark:text-neutral-600",
                    )}
                  >
                    {d}
                  </th>
                );
              })}
              {tagCodes.map((code) => (
                <th
                  key={code}
                  className="min-w-10 border-b border-r border-neutral-300 bg-neutral-100 px-1.5 py-2 text-center font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-900"
                  title={tagLabel(code, locale)}
                >
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const odd = index % 2 === 0;
              const stickyBg = odd
                ? "bg-white dark:bg-neutral-950"
                : "bg-neutral-50 dark:bg-neutral-900";

              return (
                <tr
                  key={row.user.id}
                  className={
                    odd
                      ? "bg-white dark:bg-neutral-950"
                      : "bg-neutral-50 dark:bg-neutral-900"
                  }
                >
                  <td
                    className={cn(
                      "sticky left-0 z-20 border-b border-r border-neutral-200 px-1 py-0 text-center font-mono text-[11px] text-neutral-500 dark:border-neutral-800",
                      stickyBg,
                    )}
                  >
                    {index + 1}
                  </td>
                  <td
                    className={cn(
                      "sticky left-9 z-20 border-b border-r border-neutral-200 px-2 py-0 font-mono text-[11px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                      stickyBg,
                    )}
                  >
                    {row.user.rab_id}
                  </td>
                  <td
                    className={cn(
                      "sticky left-[128px] z-20 max-w-[96px] truncate border-b border-r border-neutral-200 px-2 py-0 text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                      stickyBg,
                    )}
                  >
                    {row.user.rank || "—"}
                  </td>
                  <td
                    className={cn(
                      "sticky left-[224px] z-20 max-w-[160px] truncate border-b border-r border-neutral-200 px-2 py-0 text-xs font-medium text-neutral-900 dark:border-neutral-800 dark:text-white",
                      stickyBg,
                    )}
                  >
                    {row.user.name}
                  </td>
                  {row.days.map((tag, di) => {
                    const d = di + 1;
                    const date = dateInMonth(month, d);
                    const future = date > today;
                    const isToday = todayDay === d;

                    if (future) {
                      return (
                        <td
                          key={d}
                          className="h-9 w-9 min-w-9 border-b border-r border-neutral-200 bg-neutral-50/80 p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
                          aria-hidden
                        />
                      );
                    }

                    const prev = row.days[di - 1];
                    const next = row.days[di + 1];
                    const contL = Boolean(tag && prev === tag);
                    const contR = Boolean(tag && next === tag);
                    const title = tag
                      ? `${row.user.name} · ${date} · ${tag} ${tagLabel(tag, locale)}`
                      : `${row.user.name} · ${date}`;

                    return (
                      <td
                        key={d}
                        title={title}
                        className={cn(
                          "h-9 w-9 min-w-9 border-b border-r border-neutral-200 p-0 dark:border-neutral-800",
                          isToday && "bg-primary/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-full w-full items-center justify-center font-mono text-[10px] font-bold leading-none",
                            tag
                              ? cn(
                                  TAG_CELL[tag],
                                  contL ? "rounded-l-none" : "rounded-l-sm",
                                  contR ? "rounded-r-none" : "rounded-r-sm",
                                )
                              : "text-neutral-300 dark:text-neutral-600",
                          )}
                        >
                          {tag || "·"}
                        </span>
                      </td>
                    );
                  })}
                  {tagCodes.map((code) => (
                    <td
                      key={code}
                      className="border-b border-r border-neutral-200 px-1.5 py-0 text-center font-mono text-[11px] tabular-nums text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
                    >
                      {row.tagCounts[code] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
