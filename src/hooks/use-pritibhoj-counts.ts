"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cellsToCountedAssignments,
  cellsToSuppressed,
  listAssignments,
} from "@/lib/api/assignments";
import {
  listAllApprovedMembers,
  listMembersAllPages,
  memberToUser,
} from "@/lib/api/members";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { useStore } from "@/hooks/use-store";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";

const EMPTY_SUPPRESSED: string[] = [];

async function fetchDailyRrCountCtx(date: string): Promise<PritibhojCountCtx> {
  const [cockpit, civilians, assignRes] = await Promise.all([
    listMembersAllPages({
      approval: "approved",
      status: "1",
      page_size: 2000,
    }),
    listAllApprovedMembers({ member_type: "civilian" }),
    listAssignments({ from: date, to: date }),
  ]);
  const byId = new Map<string, ReturnType<typeof memberToUser>>();
  for (const row of [...(cockpit.items ?? []), ...civilians]) {
    const user = memberToUser(row);
    byId.set(user.id, user);
  }
  return {
    users: [...byId.values()],
    assignments: cellsToCountedAssignments(assignRes.items),
    suppressed_carries: cellsToSuppressed(assignRes.items),
  };
}

export function usePritibhojCountCtx(date: string): {
  ctx: PritibhojCountCtx | null;
  loading: boolean;
  refresh: () => Promise<PritibhojCountCtx | null>;
} {
  const apiOn = isDailyApiEnabled();
  const state = useStore();
  const [apiCtx, setApiCtx] = useState<PritibhojCountCtx | null>(null);
  const [loading, setLoading] = useState(apiOn);

  const storeCtx = useMemo<PritibhojCountCtx>(
    () => ({
      users: state.users,
      assignments: state.assignments,
      suppressed_carries: state.suppressed_carries ?? EMPTY_SUPPRESSED,
    }),
    [state.users, state.assignments, state.suppressed_carries],
  );

  const refresh = useCallback(async () => {
    if (!date) return apiOn ? null : storeCtx;
    if (!apiOn) return storeCtx;
    setLoading(true);
    try {
      const next = await fetchDailyRrCountCtx(date);
      setApiCtx(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [apiOn, date, storeCtx]);

  useEffect(() => {
    if (!apiOn || !date) {
      setApiCtx(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchDailyRrCountCtx(date)
      .then((next) => {
        if (!cancelled) setApiCtx(next);
      })
      .catch(() => {
        if (!cancelled) setApiCtx((prev) => prev);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, date]);

  return {
    ctx: apiOn ? apiCtx : storeCtx,
    loading: apiOn ? loading : false,
    refresh,
  };
}
