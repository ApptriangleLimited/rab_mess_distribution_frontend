"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cellsToCountedAssignments,
  cellsToSuppressed,
  listAssignments,
} from "@/lib/api/assignments";
import { listMembersAllPages, memberToUser } from "@/lib/api/members";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { useStore } from "@/hooks/use-store";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";

const EMPTY_SUPPRESSED: string[] = [];
const countCache = new Map<string, PritibhojCountCtx>();
const countInflight = new Map<string, Promise<PritibhojCountCtx>>();

async function loadDailyRrCountCtx(date: string): Promise<PritibhojCountCtx> {
  const [members, assignRes] = await Promise.all([
    listMembersAllPages({
      approval: "approved",
      status: "1",
      page_size: 2000,
    }),
    listAssignments({ from: date, to: date }),
  ]);
  const byId = new Map<string, ReturnType<typeof memberToUser>>();
  for (const row of members.items ?? []) {
    const user = memberToUser(row);
    byId.set(user.id, user);
  }
  return {
    users: [...byId.values()],
    assignments: cellsToCountedAssignments(assignRes.items),
    suppressed_carries: cellsToSuppressed(assignRes.items),
  };
}

function fetchDailyRrCountCtx(
  date: string,
  force = false,
): Promise<PritibhojCountCtx> {
  if (!force) {
    const cached = countCache.get(date);
    if (cached) return Promise.resolve(cached);
    const pending = countInflight.get(date);
    if (pending) return pending;
  } else {
    countCache.delete(date);
  }
  const request = loadDailyRrCountCtx(date)
    .then((ctx) => {
      countCache.set(date, ctx);
      countInflight.delete(date);
      return ctx;
    })
    .catch((error) => {
      countInflight.delete(date);
      throw error;
    });
  countInflight.set(date, request);
  return request;
}

export function usePritibhojCountCtx(date: string): {
  ctx: PritibhojCountCtx | null;
  loading: boolean;
  refresh: () => Promise<PritibhojCountCtx | null>;
} {
  const apiOn = isDailyApiEnabled();
  const state = useStore();
  const [apiCtx, setApiCtx] = useState<PritibhojCountCtx | null>(() =>
    apiOn ? (countCache.get(date) ?? null) : null,
  );
  const [loading, setLoading] = useState(
    () => apiOn && !countCache.has(date),
  );

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
      const next = await fetchDailyRrCountCtx(date, true);
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
    const cached = countCache.get(date);
    if (cached) {
      setApiCtx(cached);
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
