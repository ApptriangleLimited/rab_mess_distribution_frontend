import { apiJson } from "@/lib/api/client";
import {
  isApiFeatureMissing,
  rememberMissingRoute,
} from "@/lib/api/compat";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import type {
  DailyTag,
  TagRequest,
  TagRequestQueue,
  TagRequestStatus,
  TrgTone,
  User,
} from "@/lib/types";

export type TagRequestApiRow = {
  id: string;
  user_id: string;
  date: string;
  from_date: string;
  to_date: string;
  from_tag: string;
  to_tag: string;
  trg_tone?: TrgTone | null;
  trg_sarda?: boolean | null;
  queue: TagRequestQueue;
  status: TagRequestStatus;
  requested_by: string;
  requested_at: string;
  updated_by?: string | null;
  updated_at?: string | null;
  member?: MemberApiRow | null;
};

export type TagRequestListData = {
  items: TagRequestApiRow[];
  total: number;
  page: number;
  page_size: number;
  counts: { daily: number; ration: number; consume: number };
  status_counts: {
    all: number;
    requested: number;
    updated: number;
    rejected: number;
  };
};

export type TagRequestListParams = {
  queue?: TagRequestQueue;
  status?: string;
  q?: string;
  wing?: string;
  rank?: string;
  tag?: string;
  member_status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

export function requestToTagRequest(row: TagRequestApiRow): TagRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    from_date: row.from_date,
    to_date: row.to_date,
    from_tag: (row.from_tag || "") as DailyTag | "",
    to_tag: row.to_tag as DailyTag,
    trg_tone: row.trg_tone ?? undefined,
    trg_sarda: row.trg_sarda ?? undefined,
    queue: row.queue,
    status: row.status,
    requested_by: row.requested_by,
    requested_at: row.requested_at,
    updated_by: row.updated_by ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export function requestMember(row: TagRequestApiRow): User | null {
  return row.member ? memberToUser(row.member) : null;
}

function emptyTagRequestList(params: TagRequestListParams = {}): TagRequestListData {
  return {
    items: [],
    total: 0,
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    counts: { daily: 0, ration: 0, consume: 0 },
    status_counts: { all: 0, requested: 0, updated: 0, rejected: 0 },
  };
}

export async function listTagRequests(params: TagRequestListParams = {}) {
  if (isApiFeatureMissing("tag-requests")) return emptyTagRequestList(params);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    return await apiJson<TagRequestListData>(`/api/v1/tag-requests${suffix}`);
  } catch (err) {
    if (rememberMissingRoute("tag-requests", err)) {
      return emptyTagRequestList(params);
    }
    throw err;
  }
}

export async function tagRequestCounts() {
  if (isApiFeatureMissing("tag-requests")) {
    return { daily: 0, ration: 0, consume: 0 };
  }
  try {
    return await apiJson<{ daily: number; ration: number; consume: number }>(
      "/api/v1/tag-requests/counts",
    );
  } catch (err) {
    if (rememberMissingRoute("tag-requests", err)) {
      return { daily: 0, ration: 0, consume: 0 };
    }
    throw err;
  }
}

export function createTagRequestApi(input: {
  userId: string;
  toTag: DailyTag;
  from?: string;
  to?: string;
  queue?: TagRequestQueue;
  trg_tone?: TrgTone;
  trg_sarda?: boolean;
}) {
  return apiJson<TagRequestApiRow>("/api/v1/tag-requests", {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      to_tag: input.toTag,
      from_date: input.from || null,
      to_date: input.to || null,
      queue: input.queue ?? "daily",
      trg_tone: input.trg_tone ?? null,
      trg_sarda: input.trg_sarda ?? null,
    }),
  });
}

export function changeTagRequest(id: string, toTag: DailyTag) {
  return apiJson<TagRequestApiRow>(`/api/v1/tag-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ to_tag: toTag }),
  });
}

export function acceptTagRequest(id: string) {
  return apiJson<TagRequestApiRow>(`/api/v1/tag-requests/${id}/accept`, {
    method: "PATCH",
  });
}

export function rejectTagRequestApi(id: string) {
  return apiJson<TagRequestApiRow>(`/api/v1/tag-requests/${id}/reject`, {
    method: "PATCH",
  });
}
