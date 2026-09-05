import {
  finalizePritibhojRow,
  pritibhojLookupWings,
  pritibhojWingDef,
} from "@/lib/pritibhoj-demo";
import { canAssignOnDate, isMfrLocked, MFR_TAG } from "@/lib/store/daily";
import { isCockpitMember } from "@/lib/store/users";
import type { DailyAssignment, DailyTag, PritibhojRow, User } from "@/lib/types";

export type PritibhojCountCtx = {
  users: User[];
  assignments: DailyAssignment[];
  suppressed_carries?: string[];
};

export type PritibhojWingCounts = {
  dad: number;
  civilian: number;
  nonMuslim: number;
};

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

/** Same projection Daily Cockpit uses for a member on `date`. */
export function projectedCockpitTag(
  user: User,
  date: string,
  ctx: PritibhojCountCtx,
): DailyTag | "" {
  if (!canAssignOnDate(user, date)) return "";
  if (isMfrLocked(user)) return MFR_TAG;
  const stored = assignmentOnDate(ctx, user.id, date)?.tag;
  if (stored) return stored;
  if (isCarrySuppressed(ctx, user.id, date)) return "";
  return user.default_tag || "";
}

function isOnCockpit(user: User, date: string): boolean {
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

function matchesPritibhojWing(user: User, date: string, sheetWing: string, ctx: PritibhojCountCtx) {
  const def = pritibhojWingDef(sheetWing);
  if (def?.tag) {
    return projectedCockpitTag(user, date, ctx) === def.tag;
  }
  const keys = new Set(pritibhojLookupWings(sheetWing));
  return keys.has(user.wing);
}

export function pritibhojWingCounts(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
): PritibhojWingCounts {
  const key = wing.trim();
  if (!key) return { dad: 0, civilian: 0, nonMuslim: 0 };

  const specialTag = pritibhojWingDef(key)?.tag;
  let dad = 0;
  let civilian = 0;
  let nonMuslim = 0;

  for (const user of ctx.users) {
    if (!matchesPritibhojWing(user, date, key, ctx)) continue;

    if (
      !specialTag &&
      user.approval_status === "approved" &&
      user.status === "1" &&
      user.member_type === "civilian"
    ) {
      civilian += 1;
    }

    if (!isOnCockpit(user, date)) continue;

    if (specialTag) {
      dad += 1;
      if (user.member_type === "civilian") civilian += 1;
    } else if (projectedCockpitTag(user, date, ctx) === MFR_TAG) {
      dad += 1;
    }

    const religion = user.religion?.trim() ?? "";
    if (religion && !isIslam(religion)) nonMuslim += 1;
  }

  return { dad, civilian, nonMuslim };
}

export function applyPritibhojLookups(
  rows: PritibhojRow[],
  date: string,
  ctx: PritibhojCountCtx,
): PritibhojRow[] {
  return rows.map((row) => {
    const counts = pritibhojWingCounts(date, row.wing, ctx);
    return finalizePritibhojRow({
      ...row,
      dad: counts.dad,
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
