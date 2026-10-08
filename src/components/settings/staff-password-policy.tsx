"use client";

import { IconCheck, IconCircle } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { staffPasswordChecks, staffPasswordLevel } from "@/lib/staff-password";
import { cn } from "@/lib/utils";

const SEGMENTS = [1, 2, 3, 4] as const;

export function StaffPasswordPolicy({ password }: { password: string }) {
  const t = useT();
  const checks = staffPasswordChecks(password);
  const level = staffPasswordLevel(password);
  const rules = [
    { ok: checks.length, label: t("settings.staffPasswordRuleLength") },
    { ok: checks.mix, label: t("settings.staffPasswordRuleMix") },
    { ok: checks.uncommon, label: t("settings.staffPasswordRuleCommon") },
  ];
  const levelLabel =
    level <= 1
      ? t("settings.staffPasswordLevelWeak")
      : level === 2
        ? t("settings.staffPasswordLevelFair")
        : level === 3
          ? t("settings.staffPasswordLevelGood")
          : t("settings.staffPasswordStrong");

  return (
    <div className="space-y-2.5 rounded-xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-wide text-neutral-400">
          {t("settings.staffPasswordMeter")}
        </span>
        {level > 0 ? (
          <span
            className={cn(
              "text-[11px] font-semibold tracking-wide",
              level === 1 && "text-rose-600",
              level === 2 && "text-amber-600",
              level === 3 && "text-emerald-600",
              level >= 4 && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {levelLabel}
          </span>
        ) : null}
      </div>
      <div
        className="grid grid-cols-4 gap-1.5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        aria-label={t("settings.staffPasswordMeter")}
      >
        {SEGMENTS.map((segment) => {
          const filled = level >= segment;
          return (
            <span
              key={segment}
              className="relative h-1.5 overflow-hidden rounded-full bg-neutral-200 shadow-[inset_0_1px_1px_rgba(15,23,42,0.14)] dark:bg-neutral-800"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-500 ease-out",
                  filled ? "scale-x-100" : "scale-x-0",
                  level <= 1 && "bg-gradient-to-r from-rose-500 to-orange-400",
                  level === 2 && "bg-gradient-to-r from-amber-400 to-amber-500",
                  level === 3 && "bg-gradient-to-r from-lime-400 to-emerald-500",
                  level >= 4 &&
                    "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 shadow-[0_0_10px_rgba(16,185,129,0.55)]",
                )}
              />
              {filled && level >= 4 ? (
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
              ) : null}
            </span>
          );
        })}
      </div>
      <ul className="space-y-1">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              rule.ok ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-500",
            )}
          >
            {rule.ok ? (
              <IconCheck className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <IconCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
