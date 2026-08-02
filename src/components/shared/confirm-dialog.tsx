"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  IconAlertTriangle,
  IconCheck,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "danger";

const TONE: Record<
  Tone,
  { Icon: Icon; chip: string; ring: string; bar: string }
> = {
  default: {
    Icon: IconAlertTriangle,
    chip: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
    ring: "ring-neutral-200 dark:ring-neutral-700",
    bar: "from-neutral-800 to-neutral-600",
  },
  success: {
    Icon: IconCheck,
    chip: "bg-primary text-white shadow-md shadow-primary/25",
    ring: "ring-primary/20",
    bar: "from-primary via-primary-light to-secondary",
  },
  danger: {
    Icon: IconX,
    chip: "bg-red-600 text-white shadow-md shadow-red-600/25",
    ring: "ring-red-200 dark:ring-red-900/50",
    bar: "from-red-600 to-rose-500",
  },
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  tone,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  tone?: Tone;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const resolvedTone: Tone = tone ?? (danger ? "danger" : "default");
  const meta = TONE[resolvedTone];
  const ToneIcon = meta.Icon;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="presentation"
        >
          <motion.button
            type="button"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="absolute inset-0 bg-page-dark/55 backdrop-blur-sm"
            aria-label={t("common.cancel")}
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
              "dark:border-neutral-700 dark:bg-neutral-950",
              "ring-1",
              meta.ring,
            )}
          >
            <div className={cn("h-1 w-full bg-gradient-to-r", meta.bar)} />

            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    meta.chip,
                  )}
                >
                  <ToneIcon className="h-5 w-5" stroke={2.25} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white"
                  >
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {body}
                  </p>
                </div>
              </div>

              {children ? <div className="mt-5">{children}</div> : null}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  ref={cancelRef}
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={onCancel}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant={resolvedTone === "danger" ? "danger" : "cta"}
                  className="rounded-xl"
                  onClick={onConfirm}
                >
                  {confirmLabel ?? t("common.confirm")}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
