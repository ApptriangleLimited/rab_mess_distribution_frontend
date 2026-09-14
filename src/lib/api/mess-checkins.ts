import { apiJson } from "@/lib/api/client";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import type { GuestMeal, MealAssign, MealShift, User } from "@/lib/types";

export type MessCheckinsData = {
  from: string;
  to: string;
  assigns: MealAssign[];
  guests: GuestMeal[];
  shifts: MealShift[];
  members: MemberApiRow[];
  boro_khana_dates?: string[];
};

export function fetchMessCheckins(from: string, to: string) {
  const search = new URLSearchParams({ from, to });
  return apiJson<MessCheckinsData>(`/api/v1/mess/checkins?${search}`);
}

export function messCheckinMembers(data: MessCheckinsData): User[] {
  return data.members.map(memberToUser);
}
