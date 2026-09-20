"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import {
  loadLiveReportSource,
  peekLiveReportSource,
} from "@/lib/api/report-source";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import type { ReportSource } from "@/lib/reports";

export function useReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const rates = useStore().rates;
  const [source, setSource] = useState<ReportSource | undefined>(() =>
    apiOn
      ? peekLiveReportSource(
          params.month
            ? { month: params.month }
            : { from: params.from, to: params.to },
          { allowStale: true },
        )
      : undefined,
  );
  const [loading, setLoading] = useState(
    apiOn &&
      !peekLiveReportSource(
        params.month
          ? { month: params.month }
          : { from: params.from, to: params.to },
        { allowStale: true },
      ),
  );
  const [focusTick, setFocusTick] = useState(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const rangeKey = useMemo(
    () => params.month || `${params.from ?? ""}|${params.to ?? ""}`,
    [params.month, params.from, params.to],
  );

  const ratesKey = useMemo(
    () =>
      rates
        .map((r) => `${r.tag}:${r.amount_per_day}`)
        .sort()
        .join("|"),
    [rates],
  );
  const prevRatesKey = useRef(ratesKey);

  useEffect(() => {
    if (prevRatesKey.current === ratesKey) return;
    prevRatesKey.current = ratesKey;
    setSource((prev) => (prev ? { ...prev, rates } : prev));
  }, [rates, ratesKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setFocusTick((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!apiOn || !rangeKey) {
      setSource(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const query = params.month
      ? { month: params.month }
      : { from: params.from, to: params.to };
    const cached = peekLiveReportSource(query, { allowStale: true });
    if (cached) {
      setSource(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (peekLiveReportSource(query)) {
      return () => {
        cancelled = true;
      };
    }
    loadLiveReportSource(query)
      .then((data) => {
        if (!cancelled) setSource(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!sourceRef.current) {
          setSource(undefined);
          toast(
            err instanceof ApiClientError
              ? err.detail
              : "Could not load report data from API.",
            "error",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiOn, rangeKey, ratesKey, focusTick, toast]);

  return {
    apiOn,
    loading: apiOn && loading && !source,
    source: apiOn ? source : undefined,
  };
}
