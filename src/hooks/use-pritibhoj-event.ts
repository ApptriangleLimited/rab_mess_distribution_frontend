"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { isCcApiEnabled } from "@/lib/api/mode";
import { fetchPritibhojEvent } from "@/lib/api/pritibhoj";
import {
  getPritibhojEvent,
  upsertLocalPritibhojEvent,
} from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";

export function usePritibhojEvent(id: string | undefined) {
  const state = useStore();
  const local = id ? getPritibhojEvent(id) : null;
  const [remote, setRemote] = useState<PritibhojEvent | null>(null);
  const [loading, setLoading] = useState(Boolean(id && isCcApiEnabled()));

  useEffect(() => {
    void state.pritibhoj_events;
  }, [state.pritibhoj_events]);

  useEffect(() => {
    if (!id || !isCcApiEnabled()) {
      setLoading(false);
      return;
    }
    if (id.startsWith("pb_demo_")) {
      setRemote(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPritibhojEvent(id)
      .then((row) => {
        if (cancelled) return;
        upsertLocalPritibhojEvent(row);
        setRemote(row);
      })
      .catch(() => {
        if (!cancelled) setRemote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isCcApiEnabled()) {
    return { event: remote, loading };
  }
  return { event: local, loading: false };
}
