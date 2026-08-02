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
