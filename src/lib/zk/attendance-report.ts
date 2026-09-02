import type { MealAssignStatus, MealShift, MealShiftId, User } from "@/lib/types";
import type { ZkAttendanceRow, ZkUserRow } from "@/lib/api/zk-demo";

export type ZkReportRow = {
  id: string;
  kind: "member";
  date: string;
  check_in_time: string;
  shift_id: MealShiftId | null;
  name: string;
  rab_id: string;
  wing: string;
  rank: string;
  status: MealAssignStatus;
  info: string;
  ref: string;
  zk_user_id: string;
  member_id: string | null;
};

/** Demo-only labels — device names like "office badge" useless for client. */
const DEMO_NAMES = [
  "Karim Hossain",
  "Rahim Uddin",
  "Fatema Begum",
  "Nasrin Akter",
  "Jamal Sheikh",
  "Sajjad Khan",
  "Mita Rahman",
  "Arif Chowdhury",
  "Sumaiya Islam",
  "Tanvir Ahmed",
  "Rashedul Hasan",
  "Nusrat Jahan",
  "Imran Kabir",
  "Shila Khatun",
  "Mahbub Alam",
  "Farhana Yasmin",
  "Shahidul Islam",
  "Lamia Sultana",
  "Anisul Haque",
  "Rokeya Khatun",
  "Parvez Mahmud",
  "Sabina Yasmin",
  "Golam Mostafa",
  "Ayesha Siddiqua",
  "Habibullah",
  "Mousumi Akter",
];

const DEMO_WINGS = [
  "Admin",
  "Ops-1",
  "Ops-2",
  "Intel",
  "HQ Br",
  "Logistics",
  "Training",
  "Security",
];

const DEMO_RANKS = [
  "ASI",
  "SI",
  "Inspector",
  "Sergeant",
  "Constable",
  "Officer",
];

const DEMO_SHIFT_FALLBACK: MealShiftId[] = ["breakfast", "lunch", "dinner"];

function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(pool: readonly T[], key: string, salt = ""): T {
  const h = hashKey(`${salt}:${key}`);
  return pool[h % pool.length]!;
}

/** Stable fake persona per device user id (same id → same name/wing/rank). */
export function demoPersona(zkUserId: string): {
  name: string;
  wing: string;
  rank: string;
} {
  return {
    name: pick(DEMO_NAMES, zkUserId, "name"),
    wing: pick(DEMO_WINGS, zkUserId, "wing"),
    rank: pick(DEMO_RANKS, zkUserId, "rank"),
  };
}

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

function punchMinutes(iso: string): number | null {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Match punch clock time to a meal shift window. */
export function resolveShiftId(
  punchedAt: string,
  shifts: MealShift[],
): MealShiftId | null {
  const mins = punchMinutes(punchedAt);
  if (mins == null) return null;
  for (const s of shifts) {
    if (
      intervals(s.start_time, s.end_time).some(
        ([a, b]) => mins >= a && mins < b,
      )
    ) {
      return s.id;
    }
  }
  return null;
}

/**
 * Demo shift for client display — stable per user+date when clock
 * does not fall in a configured window.
 */
function demoShiftId(
  zkUserId: string,
  date: string,
  punchedAt: string,
  shifts: MealShift[],
): MealShiftId {
  const resolved = resolveShiftId(punchedAt, shifts);
  if (resolved) return resolved;
  const ids =
    shifts.length > 0
      ? shifts.map((s) => s.id)
      : DEMO_SHIFT_FALLBACK;
  return pick(ids, `${zkUserId}|${date}`, "shift");
}

function matchMember(
  zkUserId: string,
  usersByZkHint: Map<string, User>,
): User | undefined {
  return (
    usersByZkHint.get(zkUserId) ??
    usersByZkHint.get(zkUserId.replace(/^0+/, ""))
  );
}

/**
 * Build meal-report rows from ZK punches.
 * First punch per (zk_user_id, date, shift) → Consume (1);
 * later punches same bucket → Duplicate (2).
 * Display name/wing/rank/shift use stable demo persona (device labels junk).
 */
export function zkAttendanceToReportRows(
  punches: ZkAttendanceRow[],
  _zkUsers: ZkUserRow[],
  members: User[],
  shifts: MealShift[],
): ZkReportRow[] {
  const usersByZkHint = new Map<string, User>();
  for (const m of members) {
    if (m.rab_id) usersByZkHint.set(m.rab_id, m);
    const digits = m.rab_id.replace(/\D/g, "");
    if (digits) usersByZkHint.set(digits, m);
  }

  type Draft = {
    punched_at: string;
    date: string;
    shift_id: MealShiftId;
    zk_user_id: string;
    uid: number | null;
  };

  const drafts: Draft[] = [];
  for (const p of punches) {
    if (!p.punched_at || !p.user_id) continue;
    const date = p.punched_at.slice(0, 10);
    const zk_user_id = String(p.user_id);
    drafts.push({
      punched_at: p.punched_at,
      date,
      shift_id: demoShiftId(zk_user_id, date, p.punched_at, shifts),
      zk_user_id,
      uid: p.uid,
    });
  }

  drafts.sort((a, b) => a.punched_at.localeCompare(b.punched_at));

  const seen = new Map<string, true>();
  const out: ZkReportRow[] = [];

  for (const d of drafts) {
    const bucket = `${d.zk_user_id}|${d.date}|${d.shift_id}`;
    const isFirst = !seen.has(bucket);
    if (isFirst) seen.set(bucket, true);
    const status: MealAssignStatus = isFirst ? 1 : 2;
    const member = matchMember(d.zk_user_id, usersByZkHint);
    const persona = demoPersona(d.zk_user_id);

    out.push({
      id: `zk-${d.uid ?? d.punched_at}-${d.zk_user_id}`,
      kind: "member",
      date: d.date,
      check_in_time: d.punched_at,
      shift_id: d.shift_id,
      name: persona.name,
      // Punch record uid under name (not device user_id).
      rab_id: d.uid != null ? String(d.uid) : d.zk_user_id,
      wing: persona.wing,
      rank: persona.rank,
      status,
      info: "",
      ref: "",
      zk_user_id: d.zk_user_id,
      member_id: member?.id ?? null,
    });
  }

  out.sort((a, b) => b.check_in_time.localeCompare(a.check_in_time));
  return out;
}
