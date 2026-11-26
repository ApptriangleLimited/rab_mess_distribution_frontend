"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  IconAlertCircle,
  IconCheck,
  IconClockHour4,
  IconUserPlus,
  IconUsers,
  IconX,
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
import { useSession } from "@/hooks/use-session";
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
  const { session } = useSession();
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
  const [notice, setNotice] = useState<CheckNotice | null>(null);
  const srbRef = useRef<HTMLInputElement>(null);

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

  const countdownSeconds = board?.shift
    ? board.shift.seconds_left
    : board?.next_shift?.seconds_until;

  useEffect(() => {
    if (countdownSeconds == null) {
      setLeft(0);
      return;
    }
    const openedAt = board ? Date.parse(board.now) : Number.NaN;
    const endsAt = (Number.isNaN(openedAt) ? Date.now() : openedAt) + countdownSeconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [board, countdownSeconds]);

  useEffect(() => {
    if (countdownSeconds == null || countdownSeconds <= 0) return;
    const openedAt = board ? Date.parse(board.now) : Number.NaN;
    const endsAt = (Number.isNaN(openedAt) ? Date.now() : openedAt) + countdownSeconds * 1000;
    const refresh = window.setInterval(() => {
      if (Date.now() >= endsAt) void load();
    }, 1000);
    return () => window.clearInterval(refresh);
  }, [board, countdownSeconds, load]);

  function showResult(result: CheckerResult, enteredId: string) {
    const name = result.name || result.guest_name || "";
    const shift = result.shift_name || "";
    const title = result.ok
      ? t("mess.checker.accepted")
      : result.code === "duplicate"
        ? t("mess.checker.duplicate", { name, shift })
        : result.code === "has_rfid"
          ? t("mess.checker.hasRfid", { name })
          : result.code === "not_ms"
            ? t("mess.checker.notMs", { name })
            : result.code === "no_shift"
              ? t("mess.checker.noShiftNow")
              : t("mess.checker.notFound");
    let body = t("mess.checker.notFound");
    if (result.ok && result.guest_name) body = t("mess.checker.guestAccepted", { name });
    else if (result.ok) body = t("mess.checker.acceptedBody", { name, shift });
    else if (result.code === "has_rfid") body = t("mess.checker.hasRfid", { name });
    else if (result.code === "not_ms") body = t("mess.checker.notMs", { name });
    else if (result.code === "duplicate") body = t("mess.checker.duplicate", { name, shift });
    else if (result.code === "no_shift") body = t("mess.checker.noShiftNow");
    setNotice({
      ok: result.ok,
      code: result.code,
      title,
      body,
      name,
      shift,
      srbId: enteredId,
    });
  }

  const closeNotice = useCallback(() => {
    setNotice(null);
    srbRef.current?.focus();
  }, []);

  async function submitMeal() {
    const id = srbId.trim();
    if (!id || busy) return;
    setBusy(true);
    try {
      const result = await checkInMeal(id);
      showResult(result, id);
      if (result.ok) setSrbId("");
      await load();
    } catch (err) {
      setNotice({
        ok: false,
        code: "not_found",
        title: t("mess.checker.notFound"),
        body: err instanceof ApiClientError ? err.detail : t("mess.checker.notFound"),
        name: "",
        shift: "",
        srbId: id,
      });
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
      showResult(result, "");
      if (result.ok) {
        setGuestOpen(false);
        setGuestName("");
        setGuestInfo("");
        setGuestRef("");
      }
      await load();
    } catch (err) {
      setNotice({
        ok: false,
        code: "not_found",
        title: t("mess.checker.notFound"),
        body: err instanceof ApiClientError ? err.detail : t("mess.checker.notFound"),
        name: guestName.trim(),
        shift: "",
        srbId: "",
      });
    } finally {
      setBusy(false);
    }
  }

  const shiftName = board?.shift?.name || board?.next_shift?.name || t("mess.checker.noShift");
  const branchName =
    board?.branch_label ||
    (session?.desk === "haji" ? "Haji Camp" : session?.desk === "hq" ? "SRB HQ" : "");
  const counting = Boolean(board?.shift || board?.next_shift);
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
            <div className="flex flex-col items-end gap-1.5">
              {branchName ? (
                <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
                  {branchName}
                </span>
              ) : null}
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {t("mess.checker.online")}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-sky-100 px-4 py-3 text-neutral-950 dark:bg-sky-950/40 dark:text-sky-50">
            <div>
              <p className="text-sm font-semibold">{t("mess.checker.currentShift")}</p>
              <p
                className={
                  counting
                    ? "mt-0.5 font-mono text-3xl font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400"
                    : "mt-0.5 font-mono text-3xl font-semibold tabular-nums tracking-tight"
                }
              >
                {counting ? clock(left) : "—"}
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
            ref={srbRef}
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
      <CheckNoticeDialog
        notice={notice}
        closeLabel={t("common.done")}
        onClose={closeNotice}
        srbLabel={t("mess.checker.srbId")}
        shiftLabel={t("mess.checker.colShift")}
      />
    </PagePane>
  );
}

type CheckNotice = {
  ok: boolean;
  code: CheckerResult["code"];
  title: string;
  body: string;
  name: string;
  shift: string;
  srbId: string;
};

function CheckNoticeDialog({
  notice,
  closeLabel,
  onClose,
  srbLabel,
  shiftLabel,
}: {
  notice: CheckNotice | null;
  closeLabel: string;
  onClose: () => void;
  srbLabel: string;
  shiftLabel: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const tone = notice?.ok
    ? "success"
    : notice?.code === "duplicate"
      ? "warn"
      : "danger";

  useEffect(() => {
    if (!notice) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [notice, onClose]);

  if (!notice || typeof document === "undefined") return null;

  const Icon = tone === "success" ? IconCheck : tone === "warn" ? IconAlertCircle : IconX;
  const chip =
    tone === "success"
      ? "bg-emerald-600 text-white"
      : tone === "warn"
        ? "bg-amber-500 text-white"
        : "bg-red-600 text-white";
  const bar =
    tone === "success"
      ? "from-emerald-600 to-emerald-400"
      : tone === "warn"
        ? "from-amber-500 to-orange-400"
        : "from-red-600 to-rose-500";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/55 backdrop-blur-sm"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="checker-notice-title"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] dark:bg-neutral-950"
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${bar}`} />
        <div className="px-6 pb-6 pt-7">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${chip}`}>
            <Icon className="h-7 w-7" stroke={2.25} />
          </span>
          <h2 id="checker-notice-title" className="mt-4 text-xl font-semibold text-neutral-950 dark:text-white">
            {notice.title}
          </h2>
          {notice.body !== notice.title ? (
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{notice.body}</p>
          ) : null}
          {notice.srbId || notice.shift ? (
            <dl className="mt-4 space-y-2 rounded-xl bg-neutral-50 px-4 py-3 text-left text-sm dark:bg-neutral-900">
              {notice.srbId ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">{srbLabel}</dt>
                  <dd className="font-mono font-semibold text-neutral-950 dark:text-white">{notice.srbId}</dd>
                </div>
              ) : null}
              {notice.shift ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">{shiftLabel}</dt>
                  <dd className="font-semibold text-neutral-950 dark:text-white">{notice.shift}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <Button ref={closeRef} type="button" className="mt-5 h-11 w-full rounded-xl" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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
