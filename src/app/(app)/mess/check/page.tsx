"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  IconClockHour4,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { MessTabs } from "@/components/layout/mess-tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/provider";
import {
  checkInGuest,
  checkInMeal,
  fetchCheckerBoard,
  type CheckerBoard,
  type CheckerResult,
} from "@/lib/api/mess-checker";
import { ApiClientError } from "@/lib/api/client";

function clock(total: number) {
  const safe = Math.max(0, total);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function MessCheckPage() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [board, setBoard] = useState<CheckerBoard | null>(null);
  const [left, setLeft] = useState(0);
  const [srbId, setSrbId] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestInfo, setGuestInfo] = useState("");
  const [guestRef, setGuestRef] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchCheckerBoard();
      setBoard(next);
      setLeft(next.shift?.seconds_left ?? 0);
      setError("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("common.loading"));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!board?.shift) {
      setLeft(0);
      return;
    }
    const openedAt = Date.parse(board.now);
    const endsAt = (Number.isNaN(openedAt) ? Date.now() : openedAt) + board.shift.seconds_left * 1000;
    const tick = () => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [board?.shift?.id, board?.now, board?.shift?.seconds_left]);

  useEffect(() => {
    if (!board?.shift || left > 0) return;
    const refresh = window.setTimeout(() => void load(), 400);
    return () => window.clearTimeout(refresh);
  }, [board?.shift, left, load]);

  function explain(result: CheckerResult) {
    const name = result.name || result.guest_name || "";
    const shift = result.shift_name || "";
    if (result.ok && result.guest_name) {
      return `${t("mess.checker.accepted")}\n${t("mess.checker.guestAccepted", { name })}`;
    }
    if (result.ok) {
      return `${t("mess.checker.accepted")}\n${t("mess.checker.acceptedBody", { name, shift })}`;
    }
    if (result.code === "has_rfid") return t("mess.checker.hasRfid", { name });
    if (result.code === "not_ms") return t("mess.checker.notMs", { name });
    if (result.code === "duplicate") return t("mess.checker.duplicate", { name, shift });
    if (result.code === "no_shift") return t("mess.checker.noShiftNow");
    return t("mess.checker.notFound");
  }

  async function submitMeal() {
    const id = srbId.trim();
    if (!id || busy) return;
    setBusy(true);
    try {
      const result = await checkInMeal(id);
      window.alert(explain(result));
      if (result.ok) setSrbId("");
      await load();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.detail : t("mess.checker.notFound"));
    } finally {
      setBusy(false);
    }
  }

  async function submitGuest() {
    if (!guestName.trim() || busy) return;
    setBusy(true);
    try {
      const result = await checkInGuest({
        guest_name: guestName.trim(),
        guest_info: guestInfo.trim(),
        ref_info: guestRef.trim(),
      });
      window.alert(explain(result));
      if (result.ok) {
        setGuestOpen(false);
        setGuestName("");
        setGuestInfo("");
        setGuestRef("");
      }
      await load();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.detail : t("mess.checker.notFound"));
    } finally {
      setBusy(false);
    }
  }

  const shiftName = board?.shift?.name || t("mess.checker.noShift");
  const stats = board?.stats;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none"
      >
        <PageHeader title={t("mess.checker.title")} center={<MessTabs />} />
      </motion.div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">{t("mess.checker.branch")}</p>
              <p className="text-lg font-semibold">{board?.branch_label || "—"}</p>
              <p className="text-sm text-neutral-500">
                {t("mess.checker.manager")}: {board?.manager || "—"}
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              {t("mess.checker.online")}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-sky-100 px-4 py-3 text-neutral-950 dark:bg-sky-950/40 dark:text-sky-50">
            <div>
              <p className="text-sm font-semibold">{t("mess.checker.currentShift")}</p>
              <p
                className={
                  board?.shift
                    ? "mt-0.5 font-mono text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400"
                    : "mt-0.5 font-mono text-2xl font-semibold tabular-nums"
                }
              >
                {board?.shift ? clock(left) : board?.next_shift?.start_time || "—"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-sky-200/70">
                {board?.shift
                  ? t("mess.checker.timeLeft")
                  : board?.next_shift
                    ? t("mess.checker.shiftStarts")
                    : t("mess.checker.noShift")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
              {shiftName}
            </span>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("mess.checker.todaysStats")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<IconUsers className="h-4 w-4" />} label={t("mess.checker.planned")} value={stats?.planned} />
            <Stat icon={<IconClockHour4 className="h-4 w-4" />} label={t("mess.checker.consumptions")} value={stats?.consumptions} />
            <Stat label={t("mess.checker.duplicates")} value={stats?.duplicates} />
            <Stat icon={<IconUserPlus className="h-4 w-4" />} label={t("mess.checker.guests")} value={stats?.guests} />
          </div>
        </section>

        <form
          className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMeal();
          }}
        >
          <Label htmlFor="checker-srb">{t("mess.checker.srbId")}</Label>
          <Input
            id="checker-srb"
            value={srbId}
            autoFocus
            placeholder={t("mess.checker.srbPlaceholder")}
            onChange={(event) => setSrbId(event.target.value)}
          />
          <Button type="submit" className="h-11 w-full" disabled={busy || !srbId.trim()}>
            {t("mess.checker.checkInMeal")}
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setGuestOpen(true)}>
            {t("mess.checker.checkInGuest")}
          </Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>

      <ConfirmDialog
        open={guestOpen}
        title={t("mess.checker.guestTitle")}
        body={t("mess.checker.guestName")}
        confirmLabel={busy ? t("common.saving") : t("mess.checker.checkInGuest")}
        confirmDisabled={!guestName.trim()}
        busy={busy}
        onCancel={() => setGuestOpen(false)}
        onConfirm={() => void submitGuest()}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">{t("mess.checker.guestName")}</Label>
            <Input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-info">
              {t("mess.checker.guestInfo")} ({t("mess.checker.optional")})
            </Label>
            <Input id="guest-info" value={guestInfo} onChange={(event) => setGuestInfo(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-ref">
              {t("mess.checker.reference")} ({t("mess.checker.optional")})
            </Label>
            <Input id="guest-ref" value={guestRef} onChange={(event) => setGuestRef(event.target.value)} />
          </div>
        </div>
      </ConfirmDialog>
    </PagePane>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value?: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-1 text-xs text-neutral-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}
