"use client";

import { useEffect, useMemo, useState } from "react";
import { cellsToAssignments, cellsToSuppressed, listAssignments } from "@/lib/api/assignments";
import { listMembers, memberToUser } from "@/lib/api/members";
import { isApiEnabled } from "@/lib/api/mode";
import { useStore } from "@/hooks/use-store";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";

const EMPTY_SUPPRESSED: string[] = [];

export function usePritibhojCountCtx(date: string): {
  ctx: PritibhojCountCtx | null;
  loading: boolean;
} {
  const apiOn = isApiEnabled();
  const state = useStore();
  const [apiCtx, setApiCtx] = useState<PritibhojCountCtx | null>(null);
  const [loading, setLoading] = useState(false);

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
      listMembers({
        approval: "approved",
        status: "1",
        page: 1,
        page_size: 500,
      }),
      listAssignments({ from: date, to: date }),
    ])
      .then(([memberRes, assignRes]) => {
        if (cancelled) return;
        setApiCtx({
          users: memberRes.items.map(memberToUser),
          assignments: cellsToAssignments(assignRes.items),
          suppressed_carries: cellsToSuppressed(assignRes.items),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setApiCtx({ users: [], assignments: [], suppressed_carries: [] });
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
