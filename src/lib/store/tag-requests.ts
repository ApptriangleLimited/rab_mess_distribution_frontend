import { eachISODate, nowISO, todayISO } from "@/lib/date";
import { getState, setState } from "@/lib/store";
import {
  getAssignment,
  isCarrySuppressed,
  setTag,
  setTagRange,
} from "@/lib/store/assignments";
import {
  canAssignOnDate,
  isMfrLocked,
  isUserInactiveOnDate,
  MFR_TAG,
} from "@/lib/store/daily";
import {
  isTrgTag,
  needsTrgSardaPrompt,
  resolveTrgTone,
} from "@/lib/trg-tone";
import type {
  DailyTag,
  TagRequest,
  TagRequestQueue,
  TrgTone,
  User,
} from "@/lib/types";

function newId() {
  return `tr_${Math.random().toString(36).slice(2, 10)}`;
}

/** MS + MFR apply now. FR/CD → Ration. All other tags → Consume. */
export function dutyTagQueue(
  tag: DailyTag | "",
): "immediate" | "ration" | "consume" {
  if (!tag || tag === "MS" || tag === MFR_TAG) return "immediate";
  if (tag === "FR" || tag === "CD") return "ration";
  return "consume";
}

export function normalizeTagRequest(raw: TagRequest): TagRequest {
  const queue: TagRequestQueue =
    raw.queue === "ration" || raw.queue === "consume" ? raw.queue : "daily";
  const from_date = raw.from_date || raw.date;
  const to_date = raw.to_date || raw.date || from_date;
  return { ...raw, queue, from_date, to_date };
}

/** Same tag Daily cockpit shows for this member on `date`. */
export function getCockpitTagOnDate(user: User, date: string): DailyTag | "" {
  if (isUserInactiveOnDate(user, date)) return "";
  if (isMfrLocked(user) && canAssignOnDate(user, date)) return MFR_TAG;
  const stored = getAssignment(user.id, date)?.tag;
  if (stored) return stored;
  if (!canAssignOnDate(user, date)) return "";
  if (isCarrySuppressed(user.id, date)) return "";
  return user.default_tag || "";
}

/** TRG color Daily cockpit would show for this member on `date`. */
export function getCockpitToneOnDate(user: User, date: string): TrgTone | undefined {
  const tag = getCockpitTagOnDate(user, date);
  if (!isTrgTag(tag)) return undefined;
  const stored = getAssignment(user.id, date);
  if (
    stored?.tag === "TRG" &&
    (stored.trg_tone === "black" || stored.trg_tone === "red")
  ) {
    return stored.trg_tone;
  }
  return resolveTrgTone(user.force);
}

export function canRequestTag(user: User, date = todayISO()): boolean {
  if (isMfrLocked(user)) return false;
  return user.approval_status === "approved" && canAssignOnDate(user, date);
}

export function getPendingTagRequest(
  userId: string,
  queue: TagRequestQueue = "daily",
): TagRequest | null {
  return (
    getState().tag_requests.find(
      (r) =>
        r.user_id === userId &&
        r.status === "requested" &&
        (r.queue ?? "daily") === queue,
    ) ?? null
  );
}

export function listTagRequests(): TagRequest[] {
  return getState().tag_requests;
}

export function createTagRequest(
  userId: string,
  toTag: DailyTag,
  requestedBy = "cc",
): TagRequest | null {
  const user = getState().users.find((u) => u.id === userId);
  if (!user || !toTag) return null;
  const date = todayISO();
  if (!canRequestTag(user, date)) return null;
  const fromTag = getCockpitTagOnDate(user, date);
  if (fromTag === toTag) return null;

  const existing = getPendingTagRequest(userId, "daily");
  const ts = nowISO();
  const row: TagRequest = {
    id: existing?.id ?? newId(),
    user_id: userId,
    date,
    from_date: date,
    to_date: date,
    from_tag: fromTag,
    to_tag: toTag,
    queue: "daily",
    status: "requested",
    requested_by: requestedBy,
    requested_at: existing?.requested_at ?? ts,
  };

  setState((prev) => ({
    ...prev,
    tag_requests: [
      row,
      ...prev.tag_requests.filter(
        (r) =>
          !(
            r.user_id === userId &&
            r.status === "requested" &&
            (r.queue ?? "daily") === "daily"
          ),
      ),
    ],
  }));
  return row;
}

export function createDutyTagRequest(input: {
  userId: string;
  toTag: DailyTag;
  fromDate: string;
  toDate: string;
  queue: "ration" | "consume";
  requestedBy?: string;
  trg_tone?: TrgTone;
  trg_sarda?: boolean;
}): TagRequest | null {
  const user = getState().users.find((u) => u.id === input.userId);
  if (!user || !input.toTag) return null;
  if (isMfrLocked(user)) return null;
  const fromDate = input.fromDate || todayISO();
  const toDate = input.toDate || fromDate;
  const fromTag = getCockpitTagOnDate(user, fromDate);
  const ts = nowISO();
  const existing = getPendingTagRequest(input.userId, input.queue);
  const trg_tone = isTrgTag(input.toTag)
    ? (input.trg_tone ?? resolveTrgTone(user.force, Boolean(input.trg_sarda)))
    : undefined;
  const trg_sarda = isTrgTag(input.toTag) && needsTrgSardaPrompt(user.force)
    ? Boolean(input.trg_sarda)
    : undefined;
  const row: TagRequest = {
    id: existing?.id ?? newId(),
    user_id: input.userId,
    date: fromDate,
    from_date: fromDate,
    to_date: toDate,
    from_tag: fromTag,
    to_tag: input.toTag,
    trg_tone,
    trg_sarda,
    queue: input.queue,
    status: "requested",
    requested_by: input.requestedBy ?? "daily",
    requested_at: existing?.requested_at ?? ts,
  };
  if (!trg_tone) delete row.trg_tone;
  if (trg_sarda === undefined) delete row.trg_sarda;

  setState((prev) => ({
    ...prev,
    tag_requests: [
      row,
      ...prev.tag_requests.filter(
        (r) =>
          !(
            r.user_id === input.userId &&
            r.status === "requested" &&
            r.queue === input.queue
          ),
      ),
    ],
  }));
  return row;
}

export function applyTagRequest(
  requestId: string,
  updatedBy?: string,
): boolean {
  const req = getState().tag_requests.find((r) => r.id === requestId);
  if (!req || req.status !== "requested") return false;
  const user = getState().users.find((u) => u.id === req.user_id);
  if (!user) return false;

  const from = req.from_date || req.date;
  const to = req.to_date || req.date;
  const dates = eachISODate(from, to).filter((d) => canAssignOnDate(user, d));
  if (dates.length === 0) return false;

  const actor =
    updatedBy ??
    (req.queue === "ration"
      ? "ration"
      : req.queue === "consume"
        ? "consume"
        : "daily");

  const meta =
    isTrgTag(req.to_tag)
      ? { trg_tone: req.trg_tone ?? resolveTrgTone(user.force, Boolean(req.trg_sarda)) }
      : undefined;

  if (dates.length === 1) {
    const assigned = setTag(req.user_id, dates[0], req.to_tag, actor, meta);
    if (!assigned) return false;
  } else {
    const n = setTagRange(req.user_id, dates, req.to_tag, actor, meta);
    if (!n) return false;
  }

  const ts = nowISO();
  setState((prev) => ({
    ...prev,
    tag_requests: prev.tag_requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: "updated" as const,
            updated_by: actor,
            updated_at: ts,
          }
        : r,
    ),
  }));
  return true;
}
