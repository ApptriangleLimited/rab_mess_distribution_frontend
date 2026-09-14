"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import {
  fetchReportSource,
  reportSourceFromApi,
} from "@/lib/api/report-source";
import { useToast } from "@/components/shared/toast-provider";
import type { ReportSource } from "@/lib/reports";

export function useReportSource(params: {
  month?: string;
  from?: string;
  to?: string;
}) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const [source, setSource] = useState<ReportSource | undefined>(undefined);
  const [loading, setLoading] = useState(apiOn);

  const key = useMemo(
    () => params.month || `${params.from ?? ""}|${params.to ?? ""}`,
    [params.month, params.from, params.to],
  );

  useEffect(() => {
    if (!apiOn || !key) {
      setSource(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchReportSource(
      params.month
        ? { month: params.month }
        : { from: params.from, to: params.to },
    )
      .then((data) => {
        if (!cancelled) setSource(reportSourceFromApi(data));
      })
      .catch((err) => {
        if (cancelled) return;
        setSource(undefined);
        toast(
          err instanceof ApiClientError
            ? err.detail
            : "Could not load report data from API.",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiOn, key, toast]);

  return {
    apiOn,
    loading: apiOn && loading,
    source: apiOn ? source : undefined,
  };
}
