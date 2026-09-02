"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import {
  assignmentSummary,
  cellsToAssignments,
  cellsToSuppressed,
  deleteAssignment,
  listAssignments,
  putAssignment,
  putAssignmentRange,
  type AssignmentCell,
} from "@/lib/api/assignments";
import { approveDay, listLockedDates } from "@/lib/api/days";
import { listBoroKhanaDates, setBoroKhanaDate } from "@/lib/api/boro-khana";
import { listMembers, memberToUser } from "@/lib/api/members";
import { isApiEnabled } from "@/lib/api/mode";
import { useToast } from "@/components/shared/toast-provider";
import { compareUsers, filterCockpitMembers } from "@/lib/store/users";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";

type Params = {
  dateFrom: string;
  dateTo: string;
  q: string;
  rank: string;
  wing: string;
  /** Member duty status: `1` active, `0` inactive, `all`. Default active. */
  status?: "all" | "0" | "1";
};

export function useDailyCockpit({
  dateFrom,
  dateTo,
  q,
  rank,
  wing,
  status = "1",
}: Params) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [cells, setCells] = useState<AssignmentCell[]>([]);
  const [boroKhanaDates, setBoroKhanaDates] = useState<string[]>([]);
  const [approvedDates, setApprovedDates] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [memberRes, assignRes, summaryRes, bkRes, locksRes] =
        await Promise.all([
        listMembers({
          approval: "approved",
          q: q.trim() || undefined,
          rank: rank !== "all" ? rank : undefined,
          wing: wing !== "all" ? wing : undefined,
          status: status !== "all" ? status : undefined,
          page: 1,
          page_size: 500,
        }),
        listAssignments({
          from: dateFrom,
          to: dateTo,
          q: q.trim() || undefined,
          rank: rank !== "all" ? rank : undefined,
          wing: wing !== "all" ? wing : undefined,
        }),
        assignmentSummary({
          from: dateFrom,
          to: dateTo,
          q: q.trim() || undefined,
          rank: rank !== "all" ? rank : undefined,
          wing: wing !== "all" ? wing : undefined,
        }),
        listBoroKhanaDates(dateFrom, dateTo),
        listLockedDates(dateFrom, dateTo),
      ]);
      setUsers(
        filterCockpitMembers(memberRes.items.map(memberToUser)).sort(
          compareUsers,
        ),
      );
      setCells(assignRes.items);
      setTagCounts(summaryRes.by_tag);
      setBoroKhanaDates(bkRes.dates);
      setApprovedDates(locksRes.dates);
    } catch (err) {
      setUsers([]);
      setCells([]);
      setTagCounts({});
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
  }, [apiOn, dateFrom, dateTo, q, rank, wing, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignments = useMemo(
    () => cellsToAssignments(cells),
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
    async (userId: string, date: string, tag: DailyTag | "") => {
      try {
        if (!tag) await deleteAssignment(userId, date);
        else await putAssignment({ member_id: userId, date, tag });
        await load();
      } catch (err) {
        const detail =
          err instanceof ApiClientError ? err.detail : "Could not save tag.";
        toast(detail, "error");
      }
    },
    [load, toast],
  );

  const onPaintRange = useCallback(
    async (userId: string, dates: string[], tag: DailyTag | "") => {
      try {
        await putAssignmentRange({
          member_id: userId,
          dates,
          tag: tag || "",
        });
        await load();
      } catch (err) {
        const detail =
          err instanceof ApiClientError ? err.detail : "Could not paint range.";
        toast(detail, "error");
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
    users,
    cells,
    assignments,
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
