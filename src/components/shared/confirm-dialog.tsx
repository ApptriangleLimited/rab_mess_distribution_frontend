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
  compact,
  children,
  panelClassName,
  rootClassName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  tone?: Tone;
  /** Tighter chrome so a full preview still fits one viewport. */
  compact?: boolean;
  children?: React.ReactNode;
  panelClassName?: string;
  /** Applied to fixed overlay root (e.g. no-print). */
  rootClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const reduceMotion = useReducedMotion();
  const resolvedTone: Tone = tone ?? (danger ? "danger" : "default");
  const meta = TONE[resolvedTone];
  const ToneIcon = meta.Icon;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className={cn(
            "fixed inset-0 z-[200] flex items-center justify-center p-4",
            rootClassName,
          )}
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
              "relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
              "dark:border-neutral-700 dark:bg-neutral-950",
              "ring-1",
              meta.ring,
              panelClassName,
            )}
          >
            <div className={cn("h-1 w-full shrink-0 bg-gradient-to-r", meta.bar)} />

            <div className={cn("flex min-h-0 flex-col", compact ? "p-3.5 sm:p-4" : "p-5 sm:p-6")}>
              <div className="flex shrink-0 items-start gap-3">
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-2xl",
                    compact ? "h-9 w-9 rounded-xl" : "h-11 w-11",
                    meta.chip,
                  )}
                >
                  <ToneIcon className={compact ? "h-4 w-4" : "h-5 w-5"} stroke={2.25} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2
                    id={titleId}
                    className={cn(
                      "font-semibold tracking-tight text-neutral-900 dark:text-white",
                      compact ? "text-base" : "text-lg",
                    )}
                  >
                    {title}
                  </h2>
                  <p
                    className={cn(
                      "text-neutral-500 dark:text-neutral-400",
                      compact
                        ? "mt-0.5 text-xs leading-snug"
                        : "mt-1 text-sm leading-relaxed",
                    )}
                  >
                    {body}
                  </p>
                </div>
              </div>

              {children ? (
                <div className={compact ? "mt-3 min-h-0" : "mt-5"}>{children}</div>
              ) : null}

              <div
                className={cn(
                  "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                  compact ? "mt-3" : "mt-6",
                )}
              >
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
