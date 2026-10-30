import { canonicalRankName } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import {
  finalizePritibhojRow,
  isPritibhojAdminMainRow,
  pritibhojAdminLookupWings,
  pritibhojLookupWings,
  pritibhojWingDef,
} from "@/lib/pritibhoj-demo";
import { readPritibhojCell } from "@/lib/pritibhoj-roster";
import { canAssignOnDate } from "@/lib/store/daily";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import { registerCountedTag } from "@/lib/store/register-totals";
import {
  compareUsersByRankSerial,
  isCivilianMember,
  isCockpitMember,
} from "@/lib/store/users";
import type {
  DailyAssignment,
  DailyTag,
  PritibhojBucket,
  PritibhojColumn,
  PritibhojRoster,
  PritibhojRow,
  PritibhojSheetId,
  User,
} from "@/lib/types";

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
  const key = `${userWing}\0${sheetWing}`;
  const hit = wingMatchCache.get(key);
  if (hit !== undefined) return hit;
  const ok = sheetWingLabels(sheetWing).some((label) =>
    memberMatchesWingFilter(userWing, label),
  );
  wingMatchCache.set(key, ok);
  return ok;
}

type DayScan = {
  assignByUser: Map<string, DailyAssignment>;
  suppressed: Set<string>;
};

const dayScans = new WeakMap<PritibhojCountCtx, Map<string, DayScan>>();
const wingMatchCache = new Map<string, boolean>();

function dayScan(ctx: PritibhojCountCtx, date: string): DayScan {
  let byDate = dayScans.get(ctx);
  if (!byDate) {
    byDate = new Map();
    dayScans.set(ctx, byDate);
  }
  const cached = byDate.get(date);
  if (cached) return cached;
  const assignByUser = new Map<string, DailyAssignment>();
  for (const row of ctx.assignments) {
    if (row.date === date) assignByUser.set(row.user_id, row);
  }
  const suppressed = new Set<string>();
  const suffix = `|${date}`;
  for (const key of ctx.suppressed_carries ?? []) {
    if (key.endsWith(suffix)) suppressed.add(key.slice(0, -suffix.length));
  }
  const scan = { assignByUser, suppressed };
  byDate.set(date, scan);
  return scan;
}

function assignmentOnDate(
  ctx: PritibhojCountCtx,
  userId: string,
  date: string,
): DailyAssignment | null {
  return dayScan(ctx, date).assignByUser.get(userId) ?? null;
}

function isCarrySuppressed(
  ctx: PritibhojCountCtx,
  userId: string,
  date: string,
): boolean {
  return dayScan(ctx, date).suppressed.has(userId);
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

type AutoBuckets = {
  dad: User[];
  others: User[];
  civilian: User[];
  nonMuslim: User[];
};

function autoBucketUsers(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
  today: string,
): AutoBuckets {
  const key = wing.trim();
  const empty = { dad: [], others: [], civilian: [], nonMuslim: [] };
  if (!key) return empty;
  const specialTag = pritibhojWingDef(key)?.tag;
  const dad: User[] = [];
  const others: User[] = [];
  const civilian: User[] = [];

  for (const user of ctx.users) {
    if (!matchesPritibhojWing(user, date, key, ctx, today)) continue;

    if (
      !specialTag &&
      user.approval_status === "approved" &&
      user.status === "1" &&
      isCivilianMember(user)
    ) {
      civilian.push(user);
      continue;
    }

    if (!isOnDailyRr(user, date)) continue;

    if (isDadRank(user)) dad.push(user);
    else others.push(user);
  }

  return { dad, others, civilian, nonMuslim: [] };
}

function applyCellList(
  auto: User[],
  removed: string[],
  added: string[],
  byId: Map<string, User>,
): User[] {
  const drop = new Set(removed);
  const seen = new Set<string>();
  const out: User[] = [];
  for (const user of auto) {
    if (drop.has(user.id) || seen.has(user.id)) continue;
    seen.add(user.id);
    out.push(user);
  }
  for (const id of added) {
    if (drop.has(id) || seen.has(id)) continue;
    const user = byId.get(id);
    if (!user) continue;
    seen.add(id);
    out.push(user);
  }
  out.sort(compareUsersByRankSerial);
  return out;
}

export type PritibhojWingLists = Record<PritibhojBucket, User[]> & {
  officerManaged: boolean;
  azadHallManaged: boolean;
  azadHallDistManaged: boolean;
};

export function pritibhojWingMemberLists(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  today = todayISO(),
): PritibhojWingLists {
  const byId = new Map(ctx.users.map((user) => [user.id, user]));
  const auto = autoBucketUsers(date, wing, ctx, today);
  const cell = (bucket: PritibhojBucket) =>
    readPritibhojCell(roster, sheet, wing, bucket);
  const officer = cell("officer");
  const azadHall = cell("azadHall");
  const azadHallDist = cell("azadHallDist");
  const dad = cell("dad");
  const others = cell("others");
  const civilian = cell("civilian");
  const nonMuslim = cell("nonMuslim");
  const dadList = applyCellList(auto.dad, dad.removed, dad.added, byId);
  const othersList = applyCellList(auto.others, others.removed, others.added, byId);
  const nonMuslimAuto = [...dadList, ...othersList].filter((user) => {
    const religion = user.religion?.trim() ?? "";
    return Boolean(religion) && !isIslam(religion);
  });
  return {
    officer: applyCellList([], officer.removed, officer.added, byId),
    dad: dadList,
    azadHall: applyCellList([], azadHall.removed, azadHall.added, byId),
    others: othersList,
    civilian: applyCellList(auto.civilian, civilian.removed, civilian.added, byId),
    nonMuslim: applyCellList(
      nonMuslimAuto,
      nonMuslim.removed,
      nonMuslim.added,
      byId,
    ),
    azadHallDist: applyCellList(
      [],
      azadHallDist.removed,
      azadHallDist.added,
      byId,
    ),
    officerManaged: officer.managed === true,
    azadHallManaged: azadHall.managed === true,
    azadHallDistManaged: azadHallDist.managed === true,
  };
}

function uniqueUsers(groups: User[][]): User[] {
  const seen = new Set<string>();
  const out: User[] = [];
  for (const group of groups) {
    for (const user of group) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      out.push(user);
    }
  }
  return out;
}

export function pritibhojColumnMembersFromLists(
  column: PritibhojColumn,
  lists: PritibhojWingLists,
): User[] {
  const azadIds = new Set(lists.azadHall.map((user) => user.id));
  const distribution = lists.azadHallManaged
    ? lists.dad.filter((user) => !azadIds.has(user.id))
    : lists.dad;
  const totalPeople = uniqueUsers([lists.others, lists.civilian, lists.nonMuslim]);
  const distIds = new Set(lists.azadHallDist.map((user) => user.id));
  const distribution2 = lists.azadHallDistManaged
    ? totalPeople.filter((user) => !distIds.has(user.id))
    : totalPeople;
  switch (column) {
    case "officer":
      return lists.officer;
    case "dad":
      return lists.dad;
    case "azadHall":
      return lists.azadHall;
    case "distribution":
      return distribution;
    case "others":
      return lists.others;
    case "civilian":
      return lists.civilian;
    case "nonMuslim":
      return lists.nonMuslim;
    case "total":
      return totalPeople;
    case "azadHallDist":
      return lists.azadHallDist;
    case "distribution2":
      return distribution2;
    case "totalDistribution":
      return uniqueUsers([distribution, distribution2]);
  }
}

export function pritibhojColumnMembers(
  date: string,
  wing: string,
  column: PritibhojColumn,
  ctx: PritibhojCountCtx,
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
): User[] {
  return pritibhojColumnMembersFromLists(
    column,
    pritibhojWingMemberLists(date, wing, ctx, roster, sheet),
  );
}

export function pritibhojSheetColumnMembers(
  date: string,
  rows: PritibhojRow[],
  column: PritibhojColumn,
  ctx: PritibhojCountCtx,
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
): User[] {
  return uniqueUsers(
    rows.map((row) =>
      pritibhojColumnMembers(date, row.wing, column, ctx, roster, sheet),
    ),
  );
}

export function pritibhojBucketsHolding(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  memberId: string,
  buckets: PritibhojBucket[],
): PritibhojBucket[] {
  const lists = pritibhojWingMemberLists(date, wing, ctx, roster, sheet);
  return buckets.filter((bucket) =>
    lists[bucket].some((user) => user.id === memberId),
  );
}

export function memberFitsPritibhojBucket(
  user: User,
  bucket: PritibhojBucket,
): boolean {
  if (user.approval_status !== "approved") return false;
  switch (bucket) {
    case "dad":
    case "azadHall":
      return isDadRank(user);
    case "others":
      return isCockpitMember(user) && !isDadRank(user);
    case "civilian":
      return isCivilianMember(user);
    case "nonMuslim": {
      const religion = user.religion?.trim() ?? "";
      return Boolean(religion) && !isIslam(religion);
    }
    case "officer":
    case "azadHallDist":
      return true;
  }
}

export function pritibhojWingCounts(
  date: string,
  wing: string,
  ctx: PritibhojCountCtx,
  today = todayISO(),
): PritibhojWingCounts {
  const lists = pritibhojWingMemberLists(date, wing, ctx, undefined, "main", today);
  return {
    dad: lists.dad.length,
    others: lists.others.length,
    civilian: lists.civilian.length,
    nonMuslim: lists.nonMuslim.length,
  };
}

export function applyPritibhojLookups(
  rows: PritibhojRow[],
  date: string,
  ctx: PritibhojCountCtx,
  roster?: PritibhojRoster,
  sheet: PritibhojSheetId = "main",
): PritibhojRow[] {
  return rows.map((row) => {
    const lists = pritibhojWingMemberLists(date, row.wing, ctx, roster, sheet);
    return finalizePritibhojRow({
      ...row,
      dad: lists.dad.length,
      others: lists.others.length,
      civilian: lists.civilian.length,
      nonMuslim: lists.nonMuslim.length,
      officer: lists.officerManaged ? lists.officer.length : row.officer,
      azadHall: lists.azadHallManaged ? lists.azadHall.length : row.azadHall,
      azadHallDist: lists.azadHallDistManaged
        ? lists.azadHallDist.length
        : row.azadHallDist,
    });
  });
}

export function applyPritibhojInputLookups<
  T extends {
    date: string;
    main_rows: PritibhojRow[];
    admin_rows: PritibhojRow[];
    roster?: PritibhojRoster;
  },
>(input: T, ctx: PritibhojCountCtx): T {
  return {
    ...input,
    main_rows: applyPritibhojLookups(
      input.main_rows,
      input.date,
      ctx,
      input.roster,
      "main",
    ),
    admin_rows: applyPritibhojLookups(
      input.admin_rows,
      input.date,
      ctx,
      input.roster,
      "admin",
    ),
  };
}
