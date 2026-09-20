"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cellsToCountedAssignments,
  cellsToSuppressed,
  listAssignments,
} from "@/lib/api/assignments";
import { listAllApprovedMembers, memberToUser } from "@/lib/api/members";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { useStore } from "@/hooks/use-store";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";

const EMPTY_SUPPRESSED: string[] = [];

export function usePritibhojCountCtx(date: string): {
  ctx: PritibhojCountCtx | null;
  loading: boolean;
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

  useEffect(() => {
    if (!apiOn || !date) {
      setApiCtx(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listAllApprovedMembers(),
      listAssignments({ from: date, to: date }),
    ])
      .then(([members, assignRes]) => {
        if (cancelled) return;
        setApiCtx({
          users: members.map(memberToUser),
          assignments: cellsToCountedAssignments(assignRes.items),
          suppressed_carries: cellsToSuppressed(assignRes.items),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setApiCtx((prev) => prev);
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
  };
}
