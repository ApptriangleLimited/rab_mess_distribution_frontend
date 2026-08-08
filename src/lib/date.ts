export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** `YYYY-MM` → `July 2026` (en-US long month). */
export function formatMonthLong(month: string, locale = "en-US") {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });
}

/** `2026-06` → `Jun-2026` */
export function formatMonthBill(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const short = new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${short}-${y}`;
}

/** `2026-07-15` → `15 July 2026` */
export function formatDateLong(iso: string, locale = "en-GB") {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `2026-08-04` → `Jan 04, 2026`. Empty → `""`. */
export function formatDateDisplay(iso: string) {
  if (!iso.trim()) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Calendar month before `date`, as `YYYY-MM`. */
export function previousMonthKey(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

/** Shift `YYYY-MM` by `delta` months. */
export function shiftMonthKey(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return previousMonthKey();
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** days back from today within same calendar month as ISO date strings */
export function recentMonthDates(count: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(todayISOFrom(x));
  }
  return out;
}

function todayISOFrom(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseMonthInput(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  return monthKey();
}

/** Days in calendar month `YYYY-MM` (local). */
export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

/** ISO date `YYYY-MM-DD` for day-of-month within `YYYY-MM`. */
export function dateInMonth(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Previous calendar day as ISO `YYYY-MM-DD`. */
export function previousISODate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return todayISOFrom(d);
}

/** Next calendar day as ISO `YYYY-MM-DD`. */
export function nextISODate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return todayISOFrom(d);
}

/** All ISO dates from day 1 of current month through today. */
export function monthDatesThroughToday() {
  const today = todayISO();
  const month = monthKey();
  const last = Number(today.slice(8, 10));
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(dateInMonth(month, d));
  }
  return out;
}

/** First/last ISO date of calendar month (default: current). */
export function monthDateBounds(month = monthKey()) {
  return {
    from: dateInMonth(month, 1),
    to: dateInMonth(month, daysInMonth(month)),
  };
}

/** Inclusive ISO dates from `from` through `to` (order-safe). */
export function eachISODate(from: string, to: string): string[] {
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  if (!a || !b) return [];
  const out: string[] = [];
  let cur = a;
  while (cur <= b) {
    out.push(cur);
    cur = nextISODate(cur);
  }
  return out;
}

/** Distinct `YYYY-MM` keys covering inclusive date range. */
export function monthsCoveringRange(from: string, to: string): string[] {
  const a = (from <= to ? from : to).slice(0, 7);
  const b = (from <= to ? to : from).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) return [];
  const out: string[] = [];
  let m = a;
  while (m <= b) {
    out.push(m);
    m = shiftMonthKey(m, 1);
  }
  return out;
}
