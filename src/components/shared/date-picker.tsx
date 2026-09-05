"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateDisplay,
  formatDateLong,
  monthKey,
  shiftMonthKey,
  todayISO,
} from "@/lib/date";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const MONTH_KEYS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject invalid calendar days (e.g. 2026-02-31 → Mar)
  if (toISO(d) !== iso) return null;
  return d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Accept `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`. */
function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseISO(s) ? s : null;
  }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseISO(iso) ? iso : null;
}

function startOfMonth(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1, 12);
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
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function yearOptions(min?: string, max?: string): number[] {
  const now = new Date().getFullYear();
  const lo = min ? Number(min.slice(0, 4)) : now - 80;
  const hi = max ? Number(max.slice(0, 4)) : now + 20;
  const start = Math.min(lo, hi);
  const end = Math.max(lo, hi);
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  allowClear?: boolean;
};

/** Single-day calendar popover — ISO `YYYY-MM-DD` in/out. */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  label,
  placeholder,
  className,
  triggerClassName,
  allowClear = true,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(value);
  const [textError, setTextError] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return value.slice(0, 7);
    if (min) return min.slice(0, 7);
    return monthKey();
  });

  useEffect(() => {
    if (!open) setDraftText(value);
  }, [value, open]);

  const viewYear = Number(viewMonth.slice(0, 4));
  const viewMon = viewMonth.slice(5, 7);
  const years = useMemo(() => yearOptions(min, max), [min, max]);

  const monthNames = useMemo(() => {
    const loc = locale === "bn" ? "bn-BD" : "en-US";
    return MONTH_KEYS.map((mm, i) =>
      new Date(2000, i, 1).toLocaleString(loc, { month: "short" }),
    );
  }, [locale]);

  function syncOpen(next: boolean) {
    if (next) {
      setViewMonth(
        value ? value.slice(0, 7) : min ? min.slice(0, 7) : monthKey(),
      );
      setDraftText(value);
      setTextError(false);
    }
    setOpen(next);
  }

  function isDisabled(iso: string) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function pick(iso: string) {
    if (isDisabled(iso)) return;
    onChange(iso);
    setDraftText(iso);
    setTextError(false);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setDraftText("");
    setTextError(false);
    setOpen(false);
  }

  function goToday() {
    const today = todayISO();
    if (isDisabled(today)) {
      setViewMonth(today.slice(0, 7));
      return;
    }
    onChange(today);
    setDraftText(today);
    setTextError(false);
    setOpen(false);
  }

  function applyTyped() {
    const iso = parseFlexibleDate(draftText);
    if (!iso) {
      setTextError(Boolean(draftText.trim()));
      return;
    }
    if (isDisabled(iso)) {
      setTextError(true);
      return;
    }
    onChange(iso);
    setViewMonth(iso.slice(0, 7));
    setDraftText(iso);
    setTextError(false);
    setOpen(false);
  }

  function setMonthPart(mm: string) {
    setViewMonth(`${viewYear}-${mm}`);
  }

  function setYearPart(y: number) {
    setViewMonth(`${y}-${viewMon}`);
  }

  const hasValue = Boolean(value);
  const display = hasValue
    ? formatDateDisplay(value)
    : (placeholder ?? t("common.selectDate"));
  const headerLine = hasValue
    ? formatDateLong(value, dateLocale)
    : t("common.selectDate");

  const cells = daysInMonthGrid(viewMonth);
  const today = todayISO();
  const selectClass =
    "h-8 rounded-lg border border-neutral-200 bg-white px-1.5 text-xs font-semibold tabular-nums shadow-none focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={syncOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 text-left text-sm shadow-none transition hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-neutral-600 dark:bg-neutral-900/80 dark:hover:border-neutral-500",
              hasValue
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-400",
              triggerClassName,
            )}
            aria-label={label ?? t("common.selectDate")}
          >
            <IconCalendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="min-w-0 flex-1 truncate font-medium tabular-nums">
              {display}
            </span>
            {allowClear && hasValue ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-neutral-800"
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
          className="w-auto border-neutral-200/90 p-0 shadow-xl dark:border-neutral-700"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-neutral-100 bg-gradient-to-br from-primary/[0.06] via-white to-sky-50/40 px-4 py-3 dark:border-neutral-800 dark:from-primary/10 dark:via-neutral-950 dark:to-neutral-950">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {label ?? t("common.selectDate")}
            </p>
            <p className="mt-1 text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              {headerLine}
            </p>
          </div>

          <div className="space-y-2 border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {t("common.typeDate")}
            </label>
            <div className="flex gap-1.5">
              <Input
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  setTextError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyTyped();
                  }
                }}
                placeholder={t("common.dateInputHint")}
                className={cn(
                  "h-8 flex-1 rounded-lg border-neutral-200 bg-white px-2 text-xs tabular-nums shadow-none dark:border-neutral-700 dark:bg-neutral-900",
                  textError &&
                    "border-rose-400 focus-visible:ring-rose-400/40",
                )}
                aria-invalid={textError}
                aria-label={t("common.typeDate")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-lg px-2.5 text-xs"
                onClick={applyTyped}
              >
                {t("common.apply")}
              </Button>
            </div>
            {textError ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {t("common.invalidDate")}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-1.5 px-3 pt-3">
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setViewMonth(shiftMonthKey(viewMonth, -1))}
              aria-label={t("common.prevMonth")}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
              <select
                value={viewMon}
                onChange={(e) => setMonthPart(e.target.value)}
                className={cn(selectClass, "min-w-[4.5rem]")}
                aria-label={t("common.month")}
              >
                {MONTH_KEYS.map((mm, i) => (
                  <option key={mm} value={mm}>
                    {monthNames[i]}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setYearPart(Number(e.target.value))}
                className={cn(selectClass, "min-w-[4.25rem]")}
                aria-label={t("common.year")}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setViewMonth(shiftMonthKey(viewMonth, 1))}
              aria-label={t("common.nextMonth")}
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="w-[17.5rem] p-3">
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
                  return <div key={`e-${viewMonth}-${i}`} className="h-9" />;
                }
                const disabled = isDisabled(iso);
                const selected = iso === value;
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(iso)}
                    className={cn(
                      "relative h-9 rounded-full text-sm tabular-nums transition",
                      disabled && "cursor-not-allowed opacity-30",
                      selected &&
                        "bg-primary font-semibold text-white hover:bg-primary",
                      !selected &&
                        !disabled &&
                        "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800",
                      !selected &&
                        isToday &&
                        "ring-1 ring-inset ring-primary/40 font-semibold text-primary",
                    )}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
            {allowClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={clear}
              >
                {t("common.clear")}
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="rounded-lg"
              onClick={goToday}
              disabled={isDisabled(today)}
            >
              {t("common.today")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Native date control with day-month-year text, e.g. `26 Sep 2026`. */
export function FormattedDateInput({
  value,
  onChange,
  min,
  max,
  className,
  overlayClassName,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
  overlayClassName?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "text-transparent caret-transparent [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-text]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent",
          className,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-2 right-8 flex items-center truncate text-[11px] font-medium",
          value
            ? "text-neutral-800 dark:text-neutral-100"
            : "text-neutral-400",
          overlayClassName,
        )}
      >
        {value ? formatDateDisplay(value) : "dd MMM yyyy"}
      </span>
    </div>
  );
}
