"use client";

import { useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateDisplay,
  formatDateRangeCompact,
  monthKey,
  shiftMonthKey,
} from "@/lib/date";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1, 12);
}

function formatShort(iso: string): string {
  return formatDateDisplay(iso) || iso;
}

function daysInMonthGrid(month: string): (string | null)[] {
  const first = startOfMonth(month);
  const y = first.getFullYear();
  const m = first.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= count; day++) {
    cells.push(
      `${month}-${String(day).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function inRange(iso: string, from: string, to: string) {
  if (!from || !to) return false;
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  return iso >= a && iso <= b;
}

/** Inclusive calendar-day count between two ISO dates. */
function inclusiveDaySpan(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return 0;
  const ms = Math.abs(db.getTime() - da.getTime());
  return Math.round(ms / 86_400_000) + 1;
}

type Props = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  min?: string;
  max?: string;
  /** Max inclusive days in a selection (e.g. 31). Omit = no span cap. */
  maxSpanDays?: number;
  label?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export function DateRangePicker({
  from,
  to,
  onChange,
  min,
  max,
  maxSpanDays,
  label,
  className,
  triggerClassName,
  contentClassName,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [leftMonth, setLeftMonth] = useState(() => {
    if (from) return from.slice(0, 7);
    if (min) return min.slice(0, 7);
    return monthKey();
  });

  const rightMonth = shiftMonthKey(leftMonth, 1);

  function syncOpen(next: boolean) {
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
      setHover(null);
      setLeftMonth(
        from
          ? from.slice(0, 7)
          : min
            ? min.slice(0, 7)
            : monthKey(),
      );
    }
    setOpen(next);
  }

  function isDisabled(iso: string) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    // Picking end date: keep within maxSpanDays of start (any month OK).
    if (
      maxSpanDays != null &&
      maxSpanDays > 0 &&
      draftFrom &&
      !draftTo &&
      inclusiveDaySpan(draftFrom, iso) > maxSpanDays
    ) {
      return true;
    }
    return false;
  }

  function pick(iso: string) {
    if (isDisabled(iso)) return;
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso);
      setDraftTo("");
      return;
    }
    const nextFrom = iso < draftFrom ? iso : draftFrom;
    const nextTo = iso < draftFrom ? draftFrom : iso;
    if (
      maxSpanDays != null &&
      maxSpanDays > 0 &&
      inclusiveDaySpan(nextFrom, nextTo) > maxSpanDays
    ) {
      return;
    }
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    onChange({ from: nextFrom, to: nextTo });
    setOpen(false);
  }

  function apply() {
    let nextFrom = draftFrom;
    let nextTo = draftTo;
    if (nextFrom && !nextTo) nextTo = nextFrom;
    if (nextTo && !nextFrom) nextFrom = nextTo;
    if (
      nextFrom &&
      nextTo &&
      maxSpanDays != null &&
      maxSpanDays > 0 &&
      inclusiveDaySpan(nextFrom, nextTo) > maxSpanDays
    ) {
      return;
    }
    onChange({ from: nextFrom, to: nextTo });
    setOpen(false);
  }

  function clear() {
    setDraftFrom("");
    setDraftTo("");
    onChange({ from: "", to: "" });
    setOpen(false);
  }

  const previewTo = draftTo || hover || "";
  const hasValue = Boolean(from || to);
  const display = useMemo(() => {
    if (from || to) return formatDateRangeCompact(from, to);
    return t("common.selectDates");
  }, [from, to, t]);
  const fullDisplay = useMemo(() => {
    if (from && to) return `${formatShort(from)} – ${formatShort(to)}`;
    if (from) return `${formatShort(from)} – …`;
    if (to) return `… – ${formatShort(to)}`;
    return t("common.selectDates");
  }, [from, to, t]);

  const leftLabel = startOfMonth(leftMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const rightLabel = startOfMonth(rightMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={syncOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm shadow-none transition hover:border-neutral-300 dark:border-neutral-600 dark:bg-neutral-950 dark:hover:border-neutral-500",
              hasValue
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-400",
              triggerClassName,
            )}
            aria-label={label ?? t("common.dateRange")}
            title={fullDisplay}
          >
            <IconCalendar className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-medium tracking-tight tabular-nums">
              {display}
            </span>
            {hasValue ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clear();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    clear();
                  }
                }}
                aria-label={t("common.clear")}
              >
                <IconX className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "z-[300] w-auto max-w-[calc(100vw-1.5rem)] border-neutral-200/90 p-0 shadow-xl dark:border-neutral-700",
            contentClassName,
          )}
        >
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {label ?? t("common.dateRange")}
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">
              {draftFrom && draftTo
                ? `${formatShort(draftFrom)} – ${formatShort(draftTo)}`
                : draftFrom
                  ? `${formatShort(draftFrom)} – ${t("common.pickEndDate")}`
                  : t("common.pickStartDate")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setLeftMonth(shiftMonthKey(leftMonth, -1))}
              aria-label={t("common.prevMonth")}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <div className="grid flex-1 grid-cols-1 gap-1 text-center text-sm font-semibold text-neutral-900 sm:grid-cols-2 dark:text-white">
              <span>{leftLabel}</span>
              <span className="hidden sm:inline">{rightLabel}</span>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setLeftMonth(shiftMonthKey(leftMonth, 1))}
              aria-label={t("common.nextMonth")}
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-3 sm:grid-cols-2">
            <MonthGrid
              month={leftMonth}
              from={draftFrom}
              to={previewTo}
              selecting={!draftTo && Boolean(draftFrom)}
              onPick={pick}
              onHover={setHover}
              isDisabled={isDisabled}
            />
            <MonthGrid
              month={rightMonth}
              from={draftFrom}
              to={previewTo}
              selecting={!draftTo && Boolean(draftFrom)}
              onPick={pick}
              onHover={setHover}
              isDisabled={isDisabled}
              className="hidden sm:block"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={clear}
            >
              {t("common.clear")}
            </Button>
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="rounded-lg"
              onClick={apply}
              disabled={!draftFrom && !draftTo}
            >
              {t("common.apply")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MonthGrid({
  month,
  from,
  to,
  selecting,
  onPick,
  onHover,
  isDisabled,
  className,
}: {
  month: string;
  from: string;
  to: string;
  selecting: boolean;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
  isDisabled: (iso: string) => boolean;
  className?: string;
}) {
  const cells = daysInMonthGrid(month);
  const rangeStart = from && to ? (from <= to ? from : to) : from;
  const rangeEnd = from && to ? (from <= to ? to : from) : to;

  return (
    <div className={cn("w-[17.5rem]", className)}>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((iso, i) => {
          if (!iso) {
            return <div key={`e-${month}-${i}`} className="h-9" />;
          }
          const disabled = isDisabled(iso);
          const isStart = iso === rangeStart;
          const isEnd = Boolean(rangeEnd) && iso === rangeEnd;
          const isSingle = isStart && (!rangeEnd || rangeStart === rangeEnd);
          const mid =
            Boolean(rangeStart) &&
            Boolean(rangeEnd) &&
            inRange(iso, rangeStart, rangeEnd) &&
            !isStart &&
            !isEnd;
          const inPreview =
            selecting &&
            from &&
            to &&
            inRange(iso, from, to);

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              onMouseEnter={() => selecting && onHover(iso)}
              onMouseLeave={() => selecting && onHover(null)}
              className={cn(
                "relative h-9 text-sm tabular-nums transition",
                disabled && "cursor-not-allowed opacity-30",
                !disabled && "hover:z-[1]",
                mid || inPreview
                  ? "bg-primary/10 text-neutral-900 dark:text-white"
                  : "text-neutral-800 dark:text-neutral-100",
                (isStart || isEnd || isSingle) &&
                  "bg-primary font-semibold text-white hover:bg-primary",
                isStart && rangeEnd && rangeStart !== rangeEnd && "rounded-l-full",
                isEnd && rangeStart !== rangeEnd && "rounded-r-full",
                isSingle && "rounded-full",
                !isStart &&
                  !isEnd &&
                  !isSingle &&
                  !mid &&
                  !inPreview &&
                  !disabled &&
                  "rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800",
              )}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
