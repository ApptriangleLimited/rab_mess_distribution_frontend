import { apiJson } from "@/lib/api/client";
import { memberToUser, type MemberApiRow } from "@/lib/api/members";
import type { DailyTag } from "@/lib/types";
import type { LedgerDayCell, LedgerRow } from "@/lib/reports";
import type { MessEater, MessEaterReason } from "@/lib/store/mess";

export type MessEaterApiRow = MemberApiRow & {
  assignment_id: string;
  mess_reason: MessEaterReason;
};

export type MessEatersData = {
  date: string;
  boro_khana: boolean;
  items: MessEaterApiRow[];
  total: number;
};

export type MessLedgerRowApi = {
  member: MemberApiRow;
  days: string[];
  tag_counts: Record<string, number>;
  total_days: number;
};

export type MessLedgerData = {
  from: string;
  to: string;
  dates: string[];
  tag_codes: string[];
  rows: MessLedgerRowApi[];
  boro_khana_days: { date: string; eater_count: number }[];
};

export type MessQuery = {
  rank?: string;
  wing?: string;
  q?: string;
};

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    search.set(key, value);
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export function listMessEaters(date: string, params: MessQuery = {}) {
  return apiJson<MessEatersData>(
    `/api/v1/mess/eaters${qs({
      date,
      rank: params.rank,
      wing: params.wing,
      q: params.q,
    })}`,
  );
}

export function listMessLedger(
  from: string,
  to: string,
  params: MessQuery & { preview_future?: boolean } = {},
) {
  return apiJson<MessLedgerData>(
    `/api/v1/mess/ledger${qs({
      from,
      to,
      rank: params.rank,
      wing: params.wing,
      q: params.q,
      preview_future:
        params.preview_future === false ? "false" : undefined,
    })}`,
  );
}

export function eaterApiToMessEater(row: MessEaterApiRow): MessEater {
  return {
    ...memberToUser(row),
    assignment_id: row.assignment_id,
    mess_reason: row.mess_reason,
  };
}

export function ledgerRowApiToLedgerRow(row: MessLedgerRowApi): LedgerRow {
  return {
    user: memberToUser(row.member),
    days: row.days.map((day) => (day || "") as LedgerDayCell),
    tagCounts: row.tag_counts as Partial<Record<DailyTag, number>>,
    totalDays: row.total_days,
  };
}
