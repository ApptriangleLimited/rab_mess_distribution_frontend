"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchZkDisplay,
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

export function DeviceBoard() {
  const t = useT();
  const [data, setData] = useState<ZkGateSnapshot | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchZkDisplay();
      setData(next);
      setError(next.error || "");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("common.tryAgain"));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      void load();
    }, 400);
    return () => window.clearInterval(poll);
  }, [load]);

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
      {error ? (
        <p className="mx-4 mt-4 shrink-0 rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {latest && latestStatus ? (
        <section
          className={cn(
            "m-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl px-6 py-8 text-center shadow-2xl",
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
        <section className="m-4 flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 text-center text-xl text-white/60">
          {t("zkGate.empty")}
        </section>
      )}
    </div>
  );
}
