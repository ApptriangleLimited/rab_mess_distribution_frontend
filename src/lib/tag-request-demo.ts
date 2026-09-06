/** Demo tag-change requests for Daily / CC / Ration / Consume lists. */

import { previousISODate, todayISO } from "@/lib/date";
import type {
  DailyTag,
  TagRequest,
  TagRequestQueue,
  TagRequestStatus,
  User,
} from "@/lib/types";

/** Each request section should list more than four rows. */
export const MIN_TAG_REQUESTS_PER_QUEUE = 6;

type DemoSpec = {
  queue: TagRequestQueue;
  to_tag: DailyTag;
  from_tag: DailyTag | "";
  status: TagRequestStatus;
  dayOffset: number;
  requestedBy: string;
};

const DAILY_SPECS: DemoSpec[] = [
  { queue: "daily", to_tag: "FR", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "cc" },
  { queue: "daily", to_tag: "TRG", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "cc" },
  { queue: "daily", to_tag: "CL", from_tag: "FR", status: "requested", dayOffset: 0, requestedBy: "cc" },
  { queue: "daily", to_tag: "MED", from_tag: "MS", status: "requested", dayOffset: 1, requestedBy: "cc" },
  { queue: "daily", to_tag: "WIT", from_tag: "TRG", status: "requested", dayOffset: 1, requestedBy: "cc" },
  { queue: "daily", to_tag: "CD", from_tag: "MS", status: "requested", dayOffset: 2, requestedBy: "cc" },
  { queue: "daily", to_tag: "PL", from_tag: "MS", status: "updated", dayOffset: 2, requestedBy: "cc" },
  { queue: "daily", to_tag: "WR", from_tag: "FR", status: "updated", dayOffset: 3, requestedBy: "cc" },
  { queue: "daily", to_tag: "MOL", from_tag: "MS", status: "rejected", dayOffset: 3, requestedBy: "cc" },
];

const RATION_SPECS: DemoSpec[] = [
  { queue: "ration", to_tag: "FR", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "daily" },
  { queue: "ration", to_tag: "CD", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "daily" },
  { queue: "ration", to_tag: "FR", from_tag: "CL", status: "requested", dayOffset: 1, requestedBy: "daily" },
  { queue: "ration", to_tag: "CD", from_tag: "FR", status: "requested", dayOffset: 1, requestedBy: "daily" },
  { queue: "ration", to_tag: "FR", from_tag: "MS", status: "requested", dayOffset: 2, requestedBy: "daily" },
  { queue: "ration", to_tag: "CD", from_tag: "MS", status: "requested", dayOffset: 2, requestedBy: "daily" },
  { queue: "ration", to_tag: "FR", from_tag: "TRG", status: "updated", dayOffset: 3, requestedBy: "daily" },
  { queue: "ration", to_tag: "CD", from_tag: "MS", status: "updated", dayOffset: 3, requestedBy: "daily" },
  { queue: "ration", to_tag: "FR", from_tag: "MS", status: "rejected", dayOffset: 4, requestedBy: "daily" },
];

const CONSUME_SPECS: DemoSpec[] = [
  { queue: "consume", to_tag: "TRG", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "daily" },
  { queue: "consume", to_tag: "MED", from_tag: "MS", status: "requested", dayOffset: 0, requestedBy: "daily" },
  { queue: "consume", to_tag: "WIT", from_tag: "FR", status: "requested", dayOffset: 1, requestedBy: "daily" },
  { queue: "consume", to_tag: "CL", from_tag: "MS", status: "requested", dayOffset: 1, requestedBy: "daily" },
  { queue: "consume", to_tag: "PL", from_tag: "MS", status: "requested", dayOffset: 2, requestedBy: "daily" },
  { queue: "consume", to_tag: "WR", from_tag: "TRG", status: "requested", dayOffset: 2, requestedBy: "daily" },
  { queue: "consume", to_tag: "MOL", from_tag: "MS", status: "updated", dayOffset: 3, requestedBy: "daily" },
  { queue: "consume", to_tag: "CMH", from_tag: "MED", status: "updated", dayOffset: 3, requestedBy: "daily" },
  { queue: "consume", to_tag: "AWL", from_tag: "MS", status: "rejected", dayOffset: 4, requestedBy: "daily" },
];

function dateDaysAgo(offset: number): string {
  let day = todayISO();
  for (let i = 0; i < offset; i++) day = previousISODate(day);
  return day;
}

function stamp(isoDate: string, hour: number): string {
  const h = (hour % 5) + 1;
  return `${isoDate}T${String(h).padStart(2, "0")}:18:00.000Z`;
}

function normalizeRequest(raw: TagRequest): TagRequest {
  const queue: TagRequestQueue =
    raw.queue === "ration" || raw.queue === "consume" ? raw.queue : "daily";
  const from_date = raw.from_date || raw.date;
  const to_date = raw.to_date || raw.date || from_date;
  const status: TagRequestStatus =
    raw.status === "updated" || raw.status === "rejected"
      ? raw.status
      : "requested";
  let requested_at = raw.requested_at || "";
  if (raw.id?.startsWith("tr_demo_") && requested_at.includes("T")) {
    const [d] = requested_at.split("T");
    if (d === todayISO()) {
      requested_at = `${d}T02:18:00.000Z`;
    }
  }
  return { ...raw, queue, from_date, to_date, status, requested_at };
}

function buildRows(users: User[], specs: DemoSpec[], idPrefix: string): TagRequest[] {
  return specs.flatMap((spec, i) => {
    const user = users[i];
    if (!user) return [];
    const day = dateDaysAgo(spec.dayOffset);
    const requested_at = stamp(day, 8 + (i % 8));
    const row: TagRequest = {
      id: `tr_demo_${idPrefix}_${i}`,
      user_id: user.id,
      date: day,
      from_date: day,
      to_date: day,
      from_tag: spec.from_tag,
      to_tag: spec.to_tag,
      queue: spec.queue,
      status: spec.status,
      requested_by: spec.requestedBy,
      requested_at,
    };
    if (spec.status !== "requested") {
      row.updated_by =
        spec.queue === "ration"
          ? "ration"
          : spec.queue === "consume"
            ? "consume"
            : "daily";
      row.updated_at = stamp(day, 14 + (i % 4));
    }
    return [row];
  });
}

export function demoTagRequests(users: User[]): TagRequest[] {
  const roster = users.filter(
    (u) => u.approval_status === "approved" && u.status === "1",
  );
  if (roster.length < MIN_TAG_REQUESTS_PER_QUEUE) return [];

  const rationUsers = roster.slice(6);
  const consumeUsers = roster.slice(12).concat(roster.slice(0, 6));

  return [
    ...buildRows(roster, DAILY_SPECS, "daily"),
    ...buildRows(rationUsers.length ? rationUsers : roster, RATION_SPECS, "ration"),
    ...buildRows(consumeUsers, CONSUME_SPECS, "consume"),
  ];
}

export function ensureTagRequests(
  existing: unknown,
  users: User[],
): TagRequest[] {
  const current = Array.isArray(existing)
    ? existing
        .filter((row): row is TagRequest => Boolean(row && typeof row === "object"))
        .map((row) => normalizeRequest(row))
    : [];
  const demos = demoTagRequests(users);
  if (current.length === 0) return demos;

  const queues: TagRequestQueue[] = ["daily", "ration", "consume"];
  const ids = new Set(current.map((r) => r.id));
  const extra: TagRequest[] = [];

  for (const queue of queues) {
    const have = current.filter((r) => (r.queue ?? "daily") === queue).length;
    if (have >= MIN_TAG_REQUESTS_PER_QUEUE) continue;
    const pendingUsers = new Set(
      current
        .filter(
          (r) =>
            (r.queue ?? "daily") === queue && r.status === "requested",
        )
        .map((r) => r.user_id),
    );
    let added = 0;
    for (const demo of demos) {
      if (demo.queue !== queue || ids.has(demo.id)) continue;
      if (demo.status === "requested" && pendingUsers.has(demo.user_id)) {
        continue;
      }
      extra.push(demo);
      ids.add(demo.id);
      if (demo.status === "requested") pendingUsers.add(demo.user_id);
      added += 1;
      if (have + added >= MIN_TAG_REQUESTS_PER_QUEUE) break;
    }
  }

  return extra.length ? [...current, ...extra] : current;
}
