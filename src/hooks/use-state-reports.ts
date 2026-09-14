"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import {
  fetchStateReportApi,
  fetchStateReportDraftApi,
  listStateReportsApi,
  normalizeStateReport,
  reviewStateReportApi,
  submitStateReportApi,
} from "@/lib/api/state-reports";
import { useToast } from "@/components/shared/toast-provider";
import type { DailyStateReport } from "@/lib/types";

export function useStateReportsApi() {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const [rows, setRows] = useState<DailyStateReport[]>([]);
  const [loading, setLoading] = useState(apiOn);

  const reload = useCallback(async () => {
    if (!apiOn) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listStateReportsApi();
      setRows(data.map(normalizeStateReport));
    } catch (err) {
      setRows([]);
      toast(
        err instanceof ApiClientError
          ? err.detail
          : "Could not load state reports from API.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [apiOn, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { apiOn, loading, rows, reload };
}

export function useStateReportDraft(date: string) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const [draft, setDraft] = useState<
    Pick<DailyStateReport, "date" | "boro_khana" | "members" | "totals"> | null
  >(null);
  const [loading, setLoading] = useState(apiOn);

  useEffect(() => {
    if (!apiOn || !date) {
      setDraft(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStateReportDraftApi(date)
      .then((row) => {
        if (!cancelled) setDraft(row);
      })
      .catch((err) => {
        if (cancelled) return;
        setDraft(null);
        toast(
          err instanceof ApiClientError
            ? err.detail
            : "Could not load state report draft.",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, date, toast]);

  return { apiOn, loading, draft };
}

export function useStateReportById(id: string) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const [report, setReport] = useState<DailyStateReport | null>(null);
  const [loading, setLoading] = useState(Boolean(apiOn && id));

  useEffect(() => {
    if (!apiOn || !id) {
      setReport(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStateReportApi(id)
      .then((row) => {
        if (!cancelled) setReport(normalizeStateReport(row));
      })
      .catch((err) => {
        if (cancelled) return;
        setReport(null);
        toast(
          err instanceof ApiClientError
            ? err.detail
            : "Could not load state report.",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, id, toast]);

  return { apiOn, loading, report };
}

export async function apiSubmitStateReport(date: string) {
  return normalizeStateReport(await submitStateReportApi(date));
}

export async function apiReviewStateReport(
  id: string,
  status: "approved" | "rejected",
  note = "",
) {
  return normalizeStateReport(await reviewStateReportApi(id, status, note));
}
