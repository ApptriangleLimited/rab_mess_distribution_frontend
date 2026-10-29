import { canonicalRankName } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import {
  finalizePritibhojRow,
  isPritibhojAdminMainRow,
  pritibhojAdminLookupWings,
  pritibhojLookupWings,
  pritibhojWingDef,
} from "@/lib/pritibhoj-demo";
import { canAssignOnDate } from "@/lib/store/daily";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import { registerCountedTag } from "@/lib/store/register-totals";
import { isCivilianMember, isCockpitMember } from "@/lib/store/users";
import type { DailyAssignment, DailyTag, PritibhojRow, User } from "@/lib/types";

export type PritibhojCountCtx = {
  users: User[];
  assignments: DailyAssignment[];
  suppressed_carries?: string[];
};

export type PritibhojWingCounts = {
  dad: number;
  others: number;
  civilian: number;
  nonMuslim: number;
};

function isDadRank(user: User): boolean {
  return canonicalRankName(user.rank) === "DAD";
}

function sheetWingLabels(sheetWing: string): string[] {
  return isPritibhojAdminMainRow(sheetWing)
    ? pritibhojAdminLookupWings()
    : pritibhojLookupWings(sheetWing);
}

/** Member wing belongs to this sheet row, including child / related catalog wings. */
function matchesRelatedWing(userWing: string, sheetWing: string): boolean {
  return sheetWingLabels(sheetWing).some((label) =>
    memberMatchesWingFilter(userWing, label),
  );
}

function assignmentOnDate(
  ctx: PritibhojCountCtx,
  userId: string,
  date: string,
): DailyAssignment | null {
  return (
    ctx.assignments.find((row) => row.user_id === userId && row.date === date) ??
    null
  );
}

function isCarrySuppressed(
  ctx: PritibhojCountCtx,
  userId: string,
  date: string,
): boolean {
  return (ctx.suppressed_carries ?? []).includes(`${userId}|${date}`);
}

/** Same tag Daily RR totals use for a member on `date`. */
export function projectedCockpitTag(
  user: User,
  date: string,
  ctx: PritibhojCountCtx,
  today = todayISO(),
): DailyTag | "" {
  return registerCountedTag(
    user,
    date,
    assignmentOnDate(ctx, user.id, date)?.tag,
    isCarrySuppressed(ctx, user.id, date),
    today,
  );
}

/** Same people Daily RR lists: approved, active, cockpit, assignable that day. */
function isOnDailyRr(user: User, date: string): boolean {
  return (
    user.approval_status === "approved" &&
    user.status === "1" &&
    isCockpitMember(user) &&
    canAssignOnDate(user, date)
  );
}

function isIslam(religion: string): boolean {
  return religion.trim().toLowerCase() === "islam";
}

function matchesPritibhojWing(
  user: User,
  date: string,
  sheetWing: string,
  ctx: PritibhojCountCtx,
  today: string,
) {
  const def = pritibhojWingDef(sheetWing);
  if (def?.tag) {
    return projectedCockpitTag(user, date, ctx, today) === def.tag;
  }
  return matchesRelatedWing(user.wing, sheetWing);
}

export function pritibhojWingCounts(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
  today = todayISO(),
): PritibhojWingCounts {
  const key = wing.trim();
  if (!key) return { dad: 0, others: 0, civilian: 0, nonMuslim: 0 };

  const specialTag = pritibhojWingDef(key)?.tag;
  let dad = 0;
  let others = 0;
  let civilian = 0;
  let nonMuslim = 0;

  for (const user of ctx.users) {
    if (!matchesPritibhojWing(user, date, key, ctx, today)) continue;

    if (
      !specialTag &&
      user.approval_status === "approved" &&
      user.status === "1" &&
      isCivilianMember(user)
    ) {
      civilian += 1;
      continue;
    }

    if (!isOnDailyRr(user, date)) continue;

    if (isDadRank(user)) dad += 1;
    else others += 1;

    const religion = user.religion?.trim() ?? "";
    if (religion && !isIslam(religion)) nonMuslim += 1;
  }

  return { dad, others, civilian, nonMuslim };
}

export function applyPritibhojLookups(
  rows: PritibhojRow[],
  date: string,
  ctx: PritibhojCountCtx,
): PritibhojRow[] {
  const today = todayISO();
  return rows.map((row) => {
    const counts = pritibhojWingCounts(date, row.wing, ctx, today);
    return finalizePritibhojRow({
      ...row,
      dad: counts.dad,
      others: counts.others,
      civilian: counts.civilian,
      nonMuslim: counts.nonMuslim,
    });
  });
}

export function applyPritibhojInputLookups<
  T extends { date: string; main_rows: PritibhojRow[]; admin_rows: PritibhojRow[] },
>(input: T, ctx: PritibhojCountCtx): T {
  return {
    ...input,
    main_rows: applyPritibhojLookups(input.main_rows, input.date, ctx),
    admin_rows: applyPritibhojLookups(input.admin_rows, input.date, ctx),
  };
}
