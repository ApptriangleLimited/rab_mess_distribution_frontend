"use client";

import { useCallback, useEffect, useState } from "react";
import { IconFingerprint, IconRefresh } from "@tabler/icons-react";
import { RationTabs } from "@/components/layout/ration-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchZkGate,
  syncZkGate,
  type ZkGateRow,
  type ZkGateSnapshot,
  type ZkGateStatus,
} from "@/lib/api/zk-gate";
import { cn } from "@/lib/utils";

function rowStatus(row: ZkGateRow): ZkGateStatus {
  if (row.status === "accepted" || row.status === "not_allowed" || row.status === "rfid_not_found") {
    return row.status;
  }
  return row.allowed ? "accepted" : "not_allowed";
}

function statusTone(status: ZkGateStatus) {
  if (status === "accepted") return "bg-emerald-600";
  if (status === "rfid_not_found") return "bg-amber-600";
  return "bg-red-600";
}

export default function AdminZkPage() {
  const t = useT();
  const [data, setData] = useState<ZkGateSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await fetchZkGate();
      setData(next);
      setError(next.error || "");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("common.tryAgain"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchZkGate();
      setData(next);
      setError(next.error || "");
      void syncZkGate().catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("common.tryAgain"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => {
      void load();
    }, 3000);
    const sync = window.setInterval(() => {
      void syncZkGate().catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(sync);
    };
  }, [load, refresh]);

  const reachable = Boolean(data?.reachable);
  const syncing = Boolean(data?.syncing);
  const rows = data?.rows ?? [];
  const latest = rows[0] ?? null;
  const latestStatus = latest ? rowStatus(latest) : null;

  const statusLabel = (status: ZkGateStatus) => {
    if (status === "accepted") return t("zkGate.accepted");
    if (status === "rfid_not_found") return t("zkGate.rfidNotFound");
    return t("zkGate.notAllowed");
  };

  return (
    <PagePane className="gap-4">
      <PageHeader
        title={t("zkGate.title")}
        subtitle={t("zkGate.subtitle")}
        center={<RationTabs />}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <IconRefresh className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("zkGate.refresh")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            reachable && !syncing && !loading
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
          )}
        >
          <IconFingerprint className="h-3.5 w-3.5" />
          {syncing || loading
            ? t("zkGate.syncing")
            : reachable
              ? t("zkGate.deviceUp")
              : t("zkGate.deviceDown")}
        </span>
        {data && !syncing ? (
          <span className="text-neutral-600 dark:text-neutral-400">
            {t("zkGate.enrolled", { count: data.enrolled })}
          </span>
        ) : null}
        {data?.host ? (
          <span className="text-xs tabular-nums text-neutral-500">
            {data.host}:{data.port}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </p>
      ) : null}

      {latest && latestStatus ? (
        <section
          className={cn(
            "flex min-h-72 flex-col items-center justify-center rounded-2xl px-6 py-10 text-center text-white shadow-lg",
            statusTone(latestStatus),
          )}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">{statusLabel(latestStatus)}</p>
          {latestStatus === "rfid_not_found" ? (
            <>
              <p className="mt-4 text-5xl font-semibold leading-tight">{t("zkGate.rfidNotFound")}</p>
              <p className="mt-2 text-2xl font-medium tabular-nums tracking-wide">
                {latest.rfid || latest.rab_id}
              </p>
            </>
          ) : latestStatus === "accepted" ? (
            <>
              <p className="mt-4 text-4xl font-semibold leading-tight">{latest.name}</p>
              <p className="mt-2 text-2xl font-medium tabular-nums tracking-wide">{latest.rab_id}</p>
            </>
          ) : (
            <>
              <p className="mt-4 text-5xl font-semibold leading-tight">{t("zkGate.notAllowed")}</p>
              {latest.name ? (
                <p className="mt-4 text-2xl font-semibold leading-tight">{latest.name}</p>
              ) : null}
              <p className="mt-2 text-2xl font-medium tabular-nums tracking-wide">{latest.rab_id}</p>
            </>
          )}
          <p className="mt-6 text-sm text-white/80">{latest.punched_at.slice(11) || latest.punched_at}</p>
        </section>
      ) : (
        <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
          {t("zkGate.empty")}
        </section>
      )}

      {rows.length > 1 ? (
        <div className="grid gap-2">
          {rows.slice(1).map((row) => {
            const status = rowStatus(row);
            return (
              <div
                key={`${row.rab_id}-${row.rfid || ""}-${row.punched_at}`}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-white",
                  statusTone(status),
                )}
              >
                {status === "accepted" ? (
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{row.name}</p>
                    <p className="text-sm tabular-nums text-white/90">{row.rab_id}</p>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{statusLabel(status)}</p>
                    <p className="truncate text-sm text-white/90">
                      {[row.name, row.rab_id || row.rfid].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                )}
                <p className="shrink-0 text-sm text-white/80">{row.punched_at.slice(11) || row.punched_at}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </PagePane>
  );
}
