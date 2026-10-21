"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
import { ApiClientError } from "@/lib/api/client";
import {
  cellsToAssignments,
  cellsToCountedAssignments,
  cellsToSuppressed,
  deleteAssignment,
  listAssignments,
  putAssignment,
  putAssignmentRange,
  type AssignmentCell,
} from "@/lib/api/assignments";
import { approveDay, listLockedDates } from "@/lib/api/days";
import { listBoroKhanaDates, setBoroKhanaDate } from "@/lib/api/boro-khana";
import { listMembersAllPages, memberToUser } from "@/lib/api/members";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { onCcDataChange } from "@/lib/api/cc-events";
import { listTagRequests, requestToTagRequest } from "@/lib/api/tag-requests";
import { useToast } from "@/components/shared/toast-provider";
import {
  TAG_CHANGE_APPROVAL_ENABLED,
  replaceQueueRequests,
} from "@/lib/store/tag-requests";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";

/**
 * Merge updated cells from an API response into the existing cell array.
 * Replaces any cell with the same member_id+date; appends new ones.
 */
function mergeUpdatedCells(
  prev: AssignmentCell[],
  updated: AssignmentCell[],
): AssignmentCell[] {
  if (!updated.length) return prev;
  const keys = new Set(updated.map((c) => `${c.member_id}|${c.date}`));
  return [
    ...prev.filter((c) => !keys.has(`${c.member_id}|${c.date}`)),
    ...updated,
  ];
}

function countsFromCells(cells: AssignmentCell[]): Record<string, number> {
  const byTag: Record<string, number> = {};
  for (const cell of cells) {
    if ((cell.source === "stored" || cell.source === "carry") && cell.tag) {
      byTag[cell.tag] = (byTag[cell.tag] || 0) + 1;
    }
  }
  return byTag;
}

type Params = {
  dateFrom: string;
  dateTo: string;
  q: string;
  rank: string;
  wing: string;
  memberType?: string;
  /** Member duty status: `1` active, `0` inactive. Default active. */
  status?: "0" | "1";
};

export function useDailyCockpit({
  dateFrom,
  dateTo,
  q,
  rank,
  wing,
  memberType = "all",
  status = "1",
}: Params) {
  const apiOn = isDailyApiEnabled();
  const { toast } = useToast();
  const qDebounced = useDebouncedValue(q, 280);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [cells, setCells] = useState<AssignmentCell[]>([]);
  const [boroKhanaDates, setBoroKhanaDates] = useState<string[]>([]);
  const [approvedDates, setApprovedDates] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const wingFilter = wing !== "all" ? wing : undefined;
      const wingFamily = wingFilter ? "1" : undefined;
      const [memberRes, assignRes, bkRes, locksRes, requestRes] =
        await Promise.all([
        listMembersAllPages({
          approval: "approved",
          q: qDebounced.trim() || undefined,
          rank: rank !== "all" ? rank : undefined,
          wing: wingFilter,
          wing_family: wingFamily,
          member_type: memberType !== "all" ? memberType : undefined,
          status,
          page_size: 2000,
        }),
        listAssignments({
          from: dateFrom,
          to: dateTo,
          q: qDebounced.trim() || undefined,
          rank: rank !== "all" ? rank : undefined,
          wing: wingFilter,
          wing_family: wingFamily,
        }),
        listBoroKhanaDates(dateFrom, dateTo),
        listLockedDates(dateFrom, dateTo),
        TAG_CHANGE_APPROVAL_ENABLED
          ? listTagRequests({
              queue: "daily",
              status: "requested",
              page: 1,
              page_size: 500,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setUsers(
        memberRes.items
          .map(memberToUser)
          .filter(isCockpitMember)
          .sort(compareUsers),
      );
      setCells(assignRes.items);
      setBoroKhanaDates(bkRes.dates);
      setApprovedDates(locksRes.dates);
      if (requestRes) {
        replaceQueueRequests(
          "daily",
          requestRes.items.map(requestToTagRequest),
        );
      }
    } catch (err) {
      setUsers([]);
      setCells([]);
      setBoroKhanaDates([]);
      setApprovedDates([]);
      const detail =
        err instanceof ApiClientError
          ? err.detail
          : "Could not load daily cockpit from API.";
      toast(detail, "error");
    } finally {
      setLoading(false);
    }
  }, [apiOn, dateFrom, dateTo, qDebounced, rank, wing, memberType, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onCcDataChange(() => { void load(); }), [load]);

  const assignments = useMemo(
    () => cellsToAssignments(cells),
    [cells],
  );

  const tagCounts = useMemo(() => countsFromCells(cells), [cells]);

  /** Stored + carry — Daily RR must show default MFR, not only saved paints. */
  const displayAssignments = useMemo(
    () => cellsToCountedAssignments(cells),
    [cells],
  );

  const suppressedCarries = useMemo(
    () => cellsToSuppressed(cells),
    [cells],
  );

  const priorByUser = useMemo(() => {
    const map = new Map<string, DailyTag>();
    for (const user of users) {
      if (user.status === "1" && user.default_tag) {
        map.set(user.id, user.default_tag);
      }
    }
    return map;
  }, [users]);

  const projectedTagMembers = useCallback(
    (tag: DailyTag, date: string) => {
      const ids = new Set<string>();
      for (const cell of cells) {
        if (cell.date !== date || cell.tag !== tag) continue;
        if (cell.source === "stored" || cell.source === "carry") {
          ids.add(cell.member_id);
        }
      }
      return users.filter((user) => ids.has(user.id));
    },
    [cells, users],
  );

  const onTagChange = useCallback(
    async (
      userId: string,
      date: string,
      tag: DailyTag | "",
      trgTone?: "black" | "red",
    ) => {
      try {
        if (!tag) {
          const res = await deleteAssignment(userId, date);
          // Optimistically drop the cell so the row clears immediately.
          setCells((prev) =>
            mergeUpdatedCells(
              prev.filter((c) => !(c.member_id === userId && c.date === date)),
              res.items,
            ),
          );
        } else {
          const res = await putAssignment({
            member_id: userId,
            date,
            tag,
            trg_tone: trgTone,
          });
          // Apply the server's canonical cell(s) right away — no loading flash.
          setCells((prev) => mergeUpdatedCells(prev, res.items));
        }
      } catch (err) {
        const detail =
          err instanceof ApiClientError ? err.detail : "Could not save tag.";
        toast(detail, "error");
        // Reload to restore consistent state after a failed write.
        void load();
      }
    },
    [load, toast],
  );

  const onPaintRange = useCallback(
    async (
      userId: string,
      dates: string[],
      tag: DailyTag | "",
      trgTone?: "black" | "red",
    ) => {
      try {
        const res = await putAssignmentRange({
          member_id: userId,
          dates,
          tag: tag || "",
          trg_tone: trgTone,
        });
        // Merge all returned cells immediately so every day in the range
        // shows the new tag without waiting for the background reload.
        setCells((prev) => mergeUpdatedCells(prev, res.items));
      } catch (err) {
        const detail =
          err instanceof ApiClientError ? err.detail : "Could not paint range.";
        toast(detail, "error");
        void load();
      }
    },
    [load, toast],
  );

  const onBoroKhanaToggle = useCallback(
    async (date: string, on: boolean) => {
      try {
        await setBoroKhanaDate(date, on);
        await load();
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not update Boro Khana.";
        toast(detail, "error");
      }
    },
    [load, toast],
  );

  const onApproveDay = useCallback(
    async (date: string) => {
      try {
        const res = await approveDay(date);
        await load();
        return res;
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not approve day.";
        toast(detail, "error");
        return null;
      }
    },
    [load, toast],
  );

  return {
    loading,
    refreshing: loading && users.length > 0,
    users,
    cells,
    assignments,
    displayAssignments,
    suppressedCarries,
    boroKhanaDates,
    approvedDates,
    tagCounts,
    priorByUser,
    projectedTagMembers,
    refresh: load,
    onTagChange,
    onPaintRange,
    onBoroKhanaToggle,
    onApproveDay,
  };
}

export type DailyCockpitApi = ReturnType<typeof useDailyCockpit>;
