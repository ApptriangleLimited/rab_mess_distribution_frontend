"use client";

import { useMemo } from "react";
import { tagCellClass } from "@/components/daily/register-board";
import { dateInMonth, todayISO } from "@/lib/date";
import type { DailyTag } from "@/lib/types";
import type { LedgerRow } from "@/lib/reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Density = "default" | "medium" | "comfortable";

type Props = {
  month: string;
  dayCount: number;
  tagCodes: DailyTag[];
  rows: LedgerRow[];
  /** Subset of day-of-month numbers to show (1-based). Default: 1..dayCount. */
  visibleDays?: number[];
  /** Hide `{count} · {month}` in board chrome. */
  hideMonthMeta?: boolean;
  /** Hide ID / Rank / Name sticky cols (keep Ser). */
  hideUserDetails?: boolean;
  /** Hide per-tag day-count result cols. */
  hideTagResults?: boolean;
  /** Extra sticky col after tags: All = totalDays. */
  showAllColumn?: boolean;
  /** Hide day-of-month tag mark columns (daily result grid). */
  hideDayColumns?: boolean;
  /** @deprecated Prefer `density="comfortable"`. */
  comfortable?: boolean;
  /** Table spacing: default (dense) · medium · comfortable. */
  density?: Density;
};

const DENSITY = {
  default: {
    ser: 36,
    id: 92,
    rank: 96,
    name: 140,
    tag: 40,
    pad: undefined as string | undefined,
    rowH: undefined as number | undefined,
    chrome: "px-3 py-2",
    chromeText: "text-xs",
    tableText: "w-max text-sm",
    headText: "text-[11px]",
    bodyMono: "text-[11px]",
    bodyText: "text-xs",
    tagHead: "text-[10px]",
    maxH: "max-h-[min(72vh,760px)]",
  },
  medium: {
    ser: 42,
    id: 104,
    rank: 108,
    name: 168,
    tag: 48,
    pad: "8px 10px",
    rowH: 40,
    chrome: "px-3.5 py-2.5",
    chromeText: "text-xs",
    tableText: "w-full text-sm",
    headText: "text-[11px]",
    bodyMono: "text-xs",
    bodyText: "text-sm",
    tagHead: "text-[11px]",
    maxH: "max-h-[min(75vh,820px)]",
  },
  comfortable: {
    ser: 48,
    id: 120,
    rank: 120,
    name: 200,
    tag: 56,
    pad: "12px",
    rowH: 48,
    chrome: "px-4 py-3",
    chromeText: "text-sm",
    tableText: "w-full text-base",
    headText: "text-xs",
    bodyMono: "text-sm",
    bodyText: "text-sm",
    tagHead: "text-xs",
    maxH: "max-h-[min(78vh,900px)]",
  },
} as const;

export function MonthLedgerBoard({
  month,
  dayCount,
  tagCodes,
  rows,
  visibleDays,
  hideMonthMeta = false,
  hideUserDetails = false,
  hideTagResults = false,
  showAllColumn = false,
  hideDayColumns = false,
  comfortable = false,
  density,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const today = todayISO();
  const days = useMemo(() => {
    if (hideDayColumns) return [];
    if (visibleDays?.length) return visibleDays;
    return Array.from({ length: dayCount }, (_, i) => i + 1);
  }, [dayCount, hideDayColumns, visibleDays]);

  const todayDay = today.startsWith(month)
    ? Number(today.slice(8, 10))
    : null;

  const resolved: Density =
    density ?? (comfortable ? "comfortable" : "default");
  const d = DENSITY[resolved];

  const SER_W = d.ser;
  const ID_W = d.id;
  const RANK_W = d.rank;
  const NAME_W = d.name;
  const TAG_W = d.tag;
  const NAME_LEFT = SER_W + ID_W + RANK_W;
  const TAG_LEFT0 = hideUserDetails ? SER_W : NAME_LEFT + NAME_W;
  const visibleTags = hideTagResults ? [] : tagCodes;
  const resultColCount = visibleTags.length + (showAllColumn ? 1 : 0);
  const cellPad = d.pad;
  const rowH = d.rowH;

  return (
    <div
      className={cn(
        "relative z-10 overflow-hidden rounded-xl border shadow-sm",
        "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
          d.chrome,
        )}
      >
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-neutral-500 dark:text-neutral-400",
            d.chromeText,
          )}
        >
          {t("consume.ledgerBoardHint")}
        </p>
        {!hideMonthMeta ? (
          <p
            className={cn(
              "shrink-0 font-medium tabular-nums text-neutral-500",
              d.chromeText,
            )}
          >
            {rows.length} · {month}
          </p>
        ) : (
          <p
            className={cn(
              "shrink-0 font-medium tabular-nums text-neutral-500",
              d.chromeText,
            )}
          >
            {rows.length}
          </p>
        )}
      </div>

      <div className={cn("overflow-auto bg-white dark:bg-neutral-950", d.maxH)}>
        <table className={cn("min-w-full border-collapse text-left", d.tableText)}>
          <thead className="sticky top-0 z-30">
            <tr
              className={cn(
                "bg-neutral-100 font-bold uppercase tracking-wide text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300",
                d.headText,
              )}
            >
              <th
                className="sticky left-0 z-40 border-b border-r border-neutral-300 bg-neutral-100 text-center dark:border-neutral-700 dark:bg-neutral-900"
                style={{ width: SER_W, minWidth: SER_W, padding: cellPad }}
              >
                {t("daily.colSerial")}
              </th>
              {!hideUserDetails ? (
                <>
                  <th
                    className="sticky z-40 border-b border-r border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
                    style={{ left: SER_W, width: ID_W, minWidth: ID_W, padding: cellPad }}
                  >
                    {t("daily.colId")}
                  </th>
                  <th
                    className="sticky z-40 border-b border-r border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
                    style={{ left: SER_W + ID_W, width: RANK_W, minWidth: RANK_W, padding: cellPad }}
                  >
                    {t("cc.fields.rank")}
                  </th>
                  <th
                    className="sticky z-40 border-b border-r border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
                    style={{ left: NAME_LEFT, width: NAME_W, minWidth: NAME_W, padding: cellPad }}
                  >
                    {t("cc.fields.name")}
                  </th>
                </>
              ) : null}
              {visibleTags.map((code, i) => {
                const last = !showAllColumn && i === visibleTags.length - 1;
                return (
                  <th
                    key={code}
                    title={tagLabel(code, locale)}
                    className={cn(
                      "sticky z-40 box-border border-b border-r border-neutral-300 bg-emerald-100 text-center font-mono text-emerald-800 dark:border-neutral-700 dark:bg-emerald-950 dark:text-emerald-300",
                      d.tagHead,
                      last && "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)]",
                    )}
                    style={{
                      left: TAG_LEFT0 + i * TAG_W,
                      width: TAG_W,
                      minWidth: TAG_W,
                      maxWidth: TAG_W,
                      padding: cellPad,
                    }}
                  >
                    {code}
                  </th>
                );
              })}
              {showAllColumn ? (
                <th
                  title={t("mess.colAll")}
                  className={cn(
                    "sticky z-40 box-border border-b border-r border-neutral-300 bg-emerald-100 text-center font-mono text-emerald-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)] dark:border-neutral-700 dark:bg-emerald-950 dark:text-emerald-300",
                    d.tagHead,
                  )}
                  style={{
                    left: TAG_LEFT0 + visibleTags.length * TAG_W,
                    width: TAG_W,
                    minWidth: TAG_W,
                    maxWidth: TAG_W,
                    padding: cellPad,
                  }}
                >
                  {t("common.all")}
                </th>
              ) : null}
              {days.map((dayNum) => {
                const isToday = todayDay === dayNum;
                const isFuture = dateInMonth(month, dayNum) > today;
                return (
                  <th
                    key={dayNum}
                    className={cn(
                      "relative z-0 w-9 min-w-9 border-b border-r border-neutral-300 bg-neutral-100 px-0 py-2 text-center dark:border-neutral-700 dark:bg-neutral-900",
                      isToday && "bg-primary/15 text-primary dark:bg-primary/25",
                      isFuture &&
                        "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/50 dark:text-neutral-600",
                    )}
                  >
                    {dayNum}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const odd = index % 2 === 0;
              const stickyBg = odd
                ? "bg-white dark:bg-neutral-950"
                : "bg-neutral-50 dark:bg-neutral-900";
              const stickyTagBg = odd
                ? "bg-emerald-50 dark:bg-emerald-950"
                : "bg-emerald-100 dark:bg-emerald-900";

              return (
                <tr
                  key={row.user.id}
                  className={
                    odd
                      ? "bg-white dark:bg-neutral-950"
                      : "bg-neutral-50 dark:bg-neutral-900"
                  }
                  style={{ height: rowH }}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-30 border-b border-r border-neutral-200 text-center font-mono text-neutral-500 dark:border-neutral-800",
                      d.bodyMono,
                      stickyBg,
                      hideUserDetails &&
                        resultColCount === 0 &&
                        "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)]",
                    )}
                    style={{ width: SER_W, minWidth: SER_W, padding: cellPad }}
                  >
                    {index + 1}
                  </td>
                  {!hideUserDetails ? (
                    <>
                      <td
                        className={cn(
                          "sticky z-30 border-b border-r border-neutral-200 font-mono text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                          d.bodyMono,
                          stickyBg,
                        )}
                        style={{ left: SER_W, width: ID_W, minWidth: ID_W, padding: cellPad }}
                      >
                        {row.user.rab_id}
                      </td>
                      <td
                        className={cn(
                          "sticky z-30 truncate border-b border-r border-neutral-200 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                          d.bodyText,
                          stickyBg,
                        )}
                        style={{
                          left: SER_W + ID_W,
                          width: RANK_W,
                          minWidth: RANK_W,
                          maxWidth: RANK_W,
                          padding: cellPad,
                        }}
                      >
                        {row.user.rank || "—"}
                      </td>
                      <td
                        className={cn(
                          "sticky z-30 truncate border-b border-r border-neutral-200 font-medium text-neutral-900 dark:border-neutral-800 dark:text-white",
                          d.bodyText,
                          stickyBg,
                        )}
                        style={{
                          left: NAME_LEFT,
                          width: NAME_W,
                          minWidth: NAME_W,
                          maxWidth: NAME_W,
                          padding: cellPad,
                        }}
                      >
                        {row.user.name}
                      </td>
                    </>
                  ) : null}
                  {visibleTags.map((code, i) => {
                    const last = !showAllColumn && i === visibleTags.length - 1;
                    return (
                      <td
                        key={code}
                        className={cn(
                          "sticky z-30 box-border border-b border-r border-neutral-200 text-center font-mono font-semibold tabular-nums text-neutral-800 dark:border-neutral-800 dark:text-neutral-200",
                          d.bodyMono,
                          stickyTagBg,
                          last && "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)]",
                        )}
                        style={{
                          left: TAG_LEFT0 + i * TAG_W,
                          width: TAG_W,
                          minWidth: TAG_W,
                          maxWidth: TAG_W,
                          padding: cellPad,
                        }}
                      >
                        {row.tagCounts[code] ?? "—"}
                      </td>
                    );
                  })}
                  {showAllColumn ? (
                    <td
                      className={cn(
                        "sticky z-30 box-border border-b border-r border-neutral-200 text-center font-mono font-semibold tabular-nums text-neutral-900 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)] dark:border-neutral-800 dark:text-white",
                        d.bodyMono,
                        stickyTagBg,
                      )}
                      style={{
                        left: TAG_LEFT0 + visibleTags.length * TAG_W,
                        width: TAG_W,
                        minWidth: TAG_W,
                        maxWidth: TAG_W,
                        padding: cellPad,
                      }}
                    >
                      {row.totalDays || "—"}
                    </td>
                  ) : null}
                  {!hideDayColumns
                    ? days.map((dayNum, vi) => {
                        const di = dayNum - 1;
                        const tag = row.days[di] ?? "";
                        const date = dateInMonth(month, dayNum);
                        const future = date > today;
                        const isToday = todayDay === dayNum;

                        if (future) {
                          return (
                            <td
                              key={dayNum}
                              className="relative z-0 h-9 w-9 min-w-9 border-b border-r border-neutral-200 bg-neutral-50 p-0 dark:border-neutral-800 dark:bg-neutral-900"
                              aria-hidden
                            />
                          );
                        }

                        const prevDay = days[vi - 1];
                        const nextDay = days[vi + 1];
                        const prev =
                          prevDay != null ? row.days[prevDay - 1] : undefined;
                        const next =
                          nextDay != null ? row.days[nextDay - 1] : undefined;
                        const contL = Boolean(tag && prev === tag);
                        const contR = Boolean(tag && next === tag);
                        const title = tag
                          ? `${row.user.name} · ${date} · ${tag} ${tagLabel(tag, locale)}`
                          : `${row.user.name} · ${date}`;

                        return (
                          <td
                            key={dayNum}
                            title={title}
                            className={cn(
                              "relative z-0 h-9 w-9 min-w-9 border-b border-r border-neutral-200 bg-white p-0 dark:border-neutral-800 dark:bg-neutral-950",
                              isToday && "bg-primary/[0.04]",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-full w-full items-center justify-center font-mono text-[10px] font-bold leading-none",
                                tag
                                  ? cn(
                                      tagCellClass(tag),
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
                      })
                    : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
