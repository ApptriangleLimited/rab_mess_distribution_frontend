import { nowISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import { listMealShifts } from "@/lib/store/meal-shifts";
import type { MealPlan, MealPlanMeal, MealShiftId } from "@/lib/types";

export type MealPlanFailCode = "EMPTY" | "CONFLICT" | "NOT_FOUND";

export class MealPlanFail extends Error {
  code: MealPlanFailCode;

  constructor(code: MealPlanFailCode) {
    super(code);
    this.code = code;
    this.name = "MealPlanFail";
  }
}

function idFor(date: string) {
  return `mp_${date.replaceAll("-", "")}`;
}

function cleanMeals(meals: MealPlanMeal[]): MealPlanMeal[] {
  const byShift = new Map<MealShiftId, number>();
  for (const row of meals) {
    const n = Math.floor(Number(row.count));
    if (!Number.isFinite(n) || n <= 0) continue;
    byShift.set(row.shift_id, n);
  }
  const known = listMealShifts().map((s) => s.id);
  const order = known.length > 0 ? known : [...byShift.keys()];
  return order
    .map((id) => {
      const count = byShift.get(id);
      return count ? { shift_id: id, count } : null;
    })
    .filter((row): row is MealPlanMeal => row !== null);
}

export function mealCountFor(plan: MealPlan, shiftId: MealShiftId) {
  return plan.meals.find((m) => m.shift_id === shiftId)?.count ?? 0;
}

export function planTotal(plan: MealPlan) {
  return plan.meals.reduce((sum, m) => sum + m.count, 0);
}

export function listMealPlans() {
  return [...getState().meal_plans].sort((a, b) => b.date.localeCompare(a.date));
}

export function getMealPlanByDate(date: string) {
  return getState().meal_plans.find((p) => p.date === date) ?? null;
}

export function createMealPlan(date: string, meals: MealPlanMeal[]): MealPlan {
  const cleaned = cleanMeals(meals);
  if (cleaned.length === 0) throw new MealPlanFail("EMPTY");
  if (getMealPlanByDate(date)) throw new MealPlanFail("CONFLICT");
  const now = nowISO();
  const plan: MealPlan = {
    id: idFor(date),
    date,
    meals: cleaned,
    created_at: now,
    updated_at: now,
  };
  setState((prev) => ({ ...prev, meal_plans: [...prev.meal_plans, plan] }));
  return plan;
}

export function updateMealPlan(date: string, meals: MealPlanMeal[]): MealPlan {
  const existing = getMealPlanByDate(date);
  if (!existing) throw new MealPlanFail("NOT_FOUND");
  const cleaned = cleanMeals(meals);
  if (cleaned.length === 0) throw new MealPlanFail("EMPTY");
  const next: MealPlan = {
    ...existing,
    meals: cleaned,
    updated_at: nowISO(),
  };
  setState((prev) => ({
    ...prev,
    meal_plans: prev.meal_plans.map((p) => (p.date === date ? next : p)),
  }));
  return next;
}

export function deleteMealPlan(date: string) {
  if (!getMealPlanByDate(date)) throw new MealPlanFail("NOT_FOUND");
  setState((prev) => ({
    ...prev,
    meal_plans: prev.meal_plans.filter((p) => p.date !== date),
  }));
}
