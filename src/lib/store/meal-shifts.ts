import type { MessageKey } from "@/i18n";
import { persistAppStateNow } from "@/lib/api/app-sync";
import { nowISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import type { MealShift, MealShiftId } from "@/lib/types";

export const CANONICAL_MEAL_SHIFT_IDS = [
  "breakfast",
  "lunch",
  "dinner",
] as const;

export type CanonicalMealShiftId = (typeof CANONICAL_MEAL_SHIFT_IDS)[number];

export const CANONICAL_MEAL_SHIFT_NAMES: Record<CanonicalMealShiftId, string> =
  {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };

export function isCanonicalMealShift(
  id: string,
): id is CanonicalMealShiftId {
  return id === "breakfast" || id === "lunch" || id === "dinner";
}

export function mealShiftLabelKey(id: string): MessageKey | null {
  if (id === "breakfast") return "mess.shifts.breakfast";
  if (id === "lunch") return "mess.shifts.lunch";
  if (id === "dinner") return "mess.shifts.dinner";
  return null;
}

export function mealShiftLabel(
  id: string,
  fallback: string,
  t: (key: MessageKey) => string,
) {
  const key = mealShiftLabelKey(id);
  return key ? t(key) : fallback;
}

export type MealShiftFailCode =
  | "EMPTY_NAME"
  | "BAD_TIME"
  | "OVERLAP"
  | "NAME_TAKEN"
  | "IN_USE"
  | "BUILTIN"
  | "NOT_FOUND";

export class MealShiftFail extends Error {
  code: MealShiftFailCode;

  constructor(code: MealShiftFailCode) {
    super(code);
    this.code = code;
    this.name = "MealShiftFail";
  }
}

const TIME_RE = /^\d{2}:\d{2}$/;

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function intervals(start: string, end: string): [number, number][] {
  const a = toMin(start);
  const b = toMin(end);
  if (a === b) return [];
  if (b > a) return [[a, b]];
  return [
    [a, 24 * 60],
    [0, b],
  ];
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  const left = intervals(aStart, aEnd);
  const right = intervals(bStart, bEnd);
  for (const [s1, e1] of left) {
    for (const [s2, e2] of right) {
      if (s1 < e2 && s2 < e1) return true;
    }
  }
  return false;
}

export function listMealShifts() {
  return [...(getState().meal_shifts ?? [])].sort((a, b) => {
    const byStart = a.start_time.localeCompare(b.start_time);
    if (byStart !== 0) return byStart;
    return a.name.localeCompare(b.name);
  });
}

export function getMealShift(id: MealShiftId) {
  return getState().meal_shifts.find((s) => s.id === id) ?? null;
}

export function shiftDurationMin(start: string, end: string) {
  const parts = intervals(start, end);
  return parts.reduce((sum, [a, b]) => sum + (b - a), 0);
}

export function isCurrentShift(shift: MealShift, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  return intervals(shift.start_time, shift.end_time).some(
    ([a, b]) => mins >= a && mins < b,
  );
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) throw new MealShiftFail("BAD_TIME");
  return `${match[1]}:${match[2]}`;
}

function assertWindow(start: string, end: string) {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
    throw new MealShiftFail("BAD_TIME");
  }
  if (intervals(start, end).length === 0) throw new MealShiftFail("BAD_TIME");
}

function assertUniqueName(name: string, exceptId?: string) {
  const key = name.toLowerCase();
  const taken = getState().meal_shifts.some(
    (s) => s.id !== exceptId && s.name.toLowerCase() === key,
  );
  if (taken) throw new MealShiftFail("NAME_TAKEN");
}

function assertNoOverlap(start: string, end: string, exceptId?: string) {
  const clash = getState().meal_shifts.some(
    (s) => s.id !== exceptId && overlaps(start, end, s.start_time, s.end_time),
  );
  if (clash) throw new MealShiftFail("OVERLAP");
}

export type MealShiftInput = {
  name: string;
  start_time: string;
  end_time: string;
  description: string;
};

export function createMealShift(input: MealShiftInput): MealShift {
  const name = normalizeName(input.name);
  if (!name) throw new MealShiftFail("EMPTY_NAME");
  const start_time = normalizeTime(input.start_time);
  const end_time = normalizeTime(input.end_time);
  assertWindow(start_time, end_time);
  assertUniqueName(name);
  assertNoOverlap(start_time, end_time);
  const now = nowISO();
  const shift: MealShift = {
    id: `sh_${Math.random().toString(36).slice(2, 10)}`,
    name,
    start_time,
    end_time,
    description: input.description.trim(),
    created_at: now,
    updated_at: now,
  };
  setState((prev) => ({
    ...prev,
    meal_shifts: [...(prev.meal_shifts ?? []), shift],
  }));
  persistAppStateNow();
  return shift;
}

export function updateMealShift(
  id: MealShiftId,
  input: MealShiftInput,
): MealShift {
  const existing = getMealShift(id);
  if (!existing) throw new MealShiftFail("NOT_FOUND");
  const name = isCanonicalMealShift(id)
    ? CANONICAL_MEAL_SHIFT_NAMES[id]
    : normalizeName(input.name);
  if (!name) throw new MealShiftFail("EMPTY_NAME");
  const start_time = normalizeTime(input.start_time);
  const end_time = normalizeTime(input.end_time);
  assertWindow(start_time, end_time);
  assertUniqueName(name, id);
  assertNoOverlap(start_time, end_time, id);
  const next: MealShift = {
    ...existing,
    name,
    start_time,
    end_time,
    description: input.description.trim(),
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    meal_shifts: prev.meal_shifts.map((s) => (s.id === id ? next : s)),
  }));
  persistAppStateNow();
  return next;
}

export function deleteMealShift(id: MealShiftId) {
  if (!getMealShift(id)) throw new MealShiftFail("NOT_FOUND");
  if (isCanonicalMealShift(id)) throw new MealShiftFail("BUILTIN");
  const state = getState();
  const inPlans = state.meal_plans.some((p) =>
    p.meals.some((m) => m.shift_id === id),
  );
  const inAssigns = (state.meal_assigns ?? []).some((a) => a.shift_id === id);
  const inGuests = (state.guest_meals ?? []).some((g) => g.shift_id === id);
  if (inPlans || inAssigns || inGuests) throw new MealShiftFail("IN_USE");
  setState((prev) => ({
    ...prev,
    meal_shifts: prev.meal_shifts.filter((s) => s.id !== id),
  }));
  persistAppStateNow();
}
