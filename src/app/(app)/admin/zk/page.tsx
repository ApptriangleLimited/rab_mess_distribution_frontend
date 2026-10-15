"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconFingerprint, IconRefresh } from "@tabler/icons-react";
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
import { mealShiftLabel } from "@/lib/store/meal-shifts";
import { cn } from "@/lib/utils";

function rowStatus(row: ZkGateRow): ZkGateStatus {
  if (
    row.status === "accepted" ||
    row.status === "already_accepted" ||
    row.status === "not_allowed" ||
    row.status === "rfid_not_found"
  ) {
    return row.status;
  }
  return row.allowed ? "accepted" : "not_allowed";
}

function statusTone(status: ZkGateStatus) {
  if (status === "accepted") return "bg-emerald-600";
  if (status === "already_accepted") return "bg-sky-600";
  if (status === "rfid_not_found") return "bg-amber-600";
  return "bg-red-600";
}

function punchClock(value: string) {
  const clock = value.slice(11).trim();
  return clock.length >= 5 ? clock.slice(0, 8) : value;
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

  useEffect(() => {
    void load();
    void syncZkGate().catch(() => undefined);
    const poll = window.setInterval(() => {
      void load();
    }, 400);
    const sync = window.setInterval(() => {
      void syncZkGate().catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(sync);
    };
  }, [load]);

  const reachable = Boolean(data?.reachable);
  const syncing = Boolean(data?.syncing);
  const rows = data?.rows ?? [];
  const latest = rows[0] ?? null;
  const latestStatus = latest ? rowStatus(latest) : null;

  const statusLabel = (status: ZkGateStatus) => {
    if (status === "accepted") return t("zkGate.accepted");
    if (status === "already_accepted") return t("zkGate.alreadyAccepted");
    if (status === "rfid_not_found") return t("zkGate.rfidNotFound");
    return t("zkGate.notAllowed");
  };

  const shiftLabel = (row: ZkGateRow) => {
    if (row.shift_id) {
      return mealShiftLabel(row.shift_id, row.shift_name || row.shift_id, t);
    }
    return t("zkGate.noShift");
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Link href="/admin">
              <IconArrowLeft className="h-4 w-4" />
              {t("zkGate.back")}
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t("zkGate.title")}</p>
            <p className="truncate text-xs text-white/60">{t("zkGate.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              reachable && !syncing
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-amber-500/20 text-amber-100",
            )}
          >
            <IconFingerprint className="h-3.5 w-3.5" />
            {syncing
              ? t("zkGate.syncing")
              : reachable
                ? t("zkGate.deviceUp")
                : t("zkGate.deviceDown")}
          </span>
          {data?.host ? (
            <span className="hidden text-xs tabular-nums text-white/50 sm:inline">
              {data.host}:{data.port}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={() => {
              setLoading(true);
              void load();
              void syncZkGate().catch(() => undefined);
            }}
            disabled={loading}
          >
            <IconRefresh className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("zkGate.refresh")}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="mx-4 mb-3 shrink-0 rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {latest && latestStatus ? (
        <section
          className={cn(
            "mx-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl px-6 py-8 text-center shadow-2xl",
            statusTone(latestStatus),
          )}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/90">
            {statusLabel(latestStatus)}
          </p>
          {latestStatus === "rfid_not_found" ? (
            <>
              <p className="mt-5 text-6xl font-semibold leading-tight sm:text-7xl">
                {t("zkGate.rfidNotFound")}
              </p>
              <p className="mt-3 text-3xl font-medium tabular-nums tracking-wide">
                {latest.rfid || latest.rab_id}
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-5xl font-semibold leading-tight sm:text-6xl">
                {latestStatus === "accepted"
                  ? latest.name
                  : statusLabel(latestStatus)}
              </p>
              {latestStatus !== "accepted" && latest.name ? (
                <p className="mt-4 text-3xl font-semibold leading-tight">{latest.name}</p>
              ) : null}
              <p className="mt-3 text-3xl font-medium tabular-nums tracking-wide">
                {latest.rab_id}
              </p>
            </>
          )}
          <p className="mt-6 text-2xl font-semibold text-white/95">{shiftLabel(latest)}</p>
          <p className="mt-2 text-lg tabular-nums text-white/80">
            {punchClock(latest.punched_at)}
          </p>
        </section>
      ) : (
        <section className="mx-4 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 text-center text-xl text-white/60">
          {t("zkGate.empty")}
        </section>
      )}

      {rows.length > 1 ? (
        <div className="mt-3 grid max-h-36 shrink-0 gap-2 overflow-y-auto px-4 pb-4">
          {rows.slice(1, 8).map((row) => {
            const status = rowStatus(row);
            return (
              <div
                key={`${row.rab_id}-${row.rfid || ""}-${row.punched_at}-${row.shift_id || ""}`}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl px-4 py-2.5 text-white",
                  statusTone(status),
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {status === "accepted" ? row.name : statusLabel(status)}
                  </p>
                  <p className="truncate text-sm text-white/90">
                    {[status === "accepted" ? row.rab_id : row.name || row.rab_id, shiftLabel(row)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-white/80">
                  {punchClock(row.punched_at)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-4 shrink-0" />
      )}
    </div>
  );
}
