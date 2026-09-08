"use client";

import { useMemo } from "react";
import { useStore } from "@/hooks/use-store";
import {
  pendingRequestCountForHref,
  pendingRequestCounts,
} from "@/lib/store/tag-requests";

export function usePendingRequestCounts() {
  const { tag_requests } = useStore();
  return useMemo(() => pendingRequestCounts(tag_requests), [tag_requests]);
}

export function useRequestMenuBadge(href: string): number {
  const counts = usePendingRequestCounts();
  return pendingRequestCountForHref(href, counts);
}
