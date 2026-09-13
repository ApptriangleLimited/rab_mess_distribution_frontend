"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { onCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { tagRequestCounts } from "@/lib/api/tag-requests";
import {
  pendingRequestCountForHref,
  pendingRequestCounts,
  type PendingRequestCounts,
} from "@/lib/store/tag-requests";

const emptyCounts: PendingRequestCounts = { daily: 0, ration: 0, consume: 0 };

export function usePendingRequestCounts() {
  const { tag_requests } = useStore();
  const apiOn = isCcApiEnabled();
  const [apiCounts, setApiCounts] = useState<PendingRequestCounts>(emptyCounts);
  const [tick, setTick] = useState(0);

  useEffect(() => onCcDataChange(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!apiOn) return;
    let cancelled = false;
    tagRequestCounts()
      .then((data) => {
        if (!cancelled) setApiCounts(data);
      })
      .catch(() => {
        if (!cancelled) setApiCounts(emptyCounts);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, tick]);

  const demoCounts = useMemo(() => pendingRequestCounts(tag_requests), [tag_requests]);
  return apiOn ? apiCounts : demoCounts;
}

export function useRequestMenuBadge(href: string): number {
  const counts = usePendingRequestCounts();
  return pendingRequestCountForHref(href, counts);
}
