"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconArrowRight,
  IconCashBanknote,
  IconChartBar,
  IconChecklist,
  IconEye,
  IconEyeOff,
  IconLayoutDashboard,
  IconSoup,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_HOMES, VISIBLE_ROLE_KEYS } from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/components/shared/toast-provider";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_META: Record<
  Role,
  { icon: Icon; accent: string; chip: string }
> = {
  cc: {
    icon: IconUsers,
    accent: "from-sky-500/20 to-sky-600/5",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  daily: {
    icon: IconChecklist,
    accent: "from-amber-500/20 to-amber-600/5",
    chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  mess: {
    icon: IconSoup,
    accent: "from-rose-500/20 to-rose-600/5",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  consume: {
    icon: IconChartBar,
    accent: "from-violet-500/20 to-violet-600/5",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  ration: {
    icon: IconCashBanknote,
    accent: "from-teal-500/20 to-teal-600/5",
    chip: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  },
  admin: {
    icon: IconLayoutDashboard,
    accent: "from-emerald-500/20 to-emerald-600/5",
    chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState(() => t("login.demoUser"));
  const [password, setPassword] = useState("demo");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("cc");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast(t("login.nameRequired"), "error");
      return;
    }
    if (!password.trim()) {
      toast(t("login.passwordRequired"), "error");
      return;
    }
    login(role, name.trim());
    toast(t("login.loggedInAs", { role: roleLabel(role, locale) }), "success");
    router.replace(ROLE_HOMES[role]);
  }

  const fade = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-page-dark text-white md:grid md:grid-cols-[1.08fr_0.92fr]">
      {/* Ambient field — charcoal + green, not pastel orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(6,121,87,0.28),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(44,103,160,0.12),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      {/* Brand panel */}
      <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 md:min-h-dvh md:px-14 md:py-16">
        <div className="absolute left-0 top-0 hidden h-full w-1.5 bg-gradient-to-b from-primary-light via-primary to-primary-dark md:block" />

        <motion.div
          {...fade}
          transition={{ duration: 0.45 }}
          className="relative max-w-lg"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-sm font-bold shadow-lg shadow-primary/30">
              MD
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-page-dark bg-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                {t("common.rab")} · {t("common.prototype")}
              </p>
              <p className="text-xs text-white/40">{t("login.panelTag")}</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.15rem]">
            <span className="bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent">
              {t("common.productName")}
            </span>
          </h1>
          <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-primary-light to-primary" />

          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
            {t("login.panelBlurb")}
          </p>

          <ul className="mt-8 hidden gap-2 sm:flex sm:flex-wrap">
            {VISIBLE_ROLE_KEYS.map((r) => (
              <li
                key={r}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/55"
              >
                {roleLabel(r, locale)}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.p
          {...fade}
          transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.12 }}
          className="relative mt-10 text-xs text-white/35 md:mt-0"
        >
          {t("login.localOnly")}
        </motion.p>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center bg-white px-5 py-10 text-neutral-900 shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-neutral-950 dark:text-neutral-100 sm:px-8 md:min-h-dvh md:px-12 lg:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-nav-accent md:hidden"
        />

        <motion.form
          onSubmit={onSubmit}
          {...fade}
          transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.08 }}
          className="relative w-full max-w-md"
        >
          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {t("login.gateLabel")}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-title dark:text-white">
              {t("login.welcome")}
            </h2>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {t("login.subtitle")}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-neutral-700 dark:text-neutral-300">
                {t("login.displayName")}
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("login.namePlaceholder")}
                className="h-11 rounded-xl border-neutral-200 bg-neutral-50 px-3.5 text-base shadow-none focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-700 dark:text-neutral-300">
                {t("login.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  className="h-11 rounded-xl border-neutral-200 bg-neutral-50 px-3.5 pr-11 text-base shadow-none focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? t("login.hidePassword") : t("login.showPassword")
                  }
                >
                  {showPassword ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-neutral-400">{t("login.passwordHint")}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-neutral-700 dark:text-neutral-300">
                {t("login.chooseDuty")}
              </Label>
              <div
                role="radiogroup"
                aria-label={t("login.chooseDuty")}
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
              >
                {VISIBLE_ROLE_KEYS.map((r) => {
                  const meta = ROLE_META[r];
                  const Icon = meta.icon;
                  const selected = role === r;
                  return (
                    <motion.button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      onClick={() => setRole(r)}
                      className={cn(
                        "group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200",
                        selected
                          ? "border-primary bg-primary/[0.06] shadow-[0_0_0_1px_var(--primary)] dark:bg-primary/10"
                          : "border-neutral-200 bg-neutral-50/80 hover:border-neutral-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/80 dark:hover:border-neutral-600",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200",
                          meta.accent,
                          selected && "opacity-100",
                        )}
                      />
                      <span
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-xl transition",
                          selected
                            ? "bg-primary text-white shadow-md shadow-primary/25"
                            : cn(meta.chip, "group-hover:scale-105"),
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="relative text-xs font-semibold leading-snug text-neutral-800 dark:text-neutral-100">
                        {roleLabel(r, locale)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.01 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
            >
              <Button
                type="submit"
                variant="cta"
                size="lg"
                className="h-12 w-full rounded-xl text-sm font-semibold tracking-wide"
              >
                {t("login.enterSystem")}
                <IconArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
