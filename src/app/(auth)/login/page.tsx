"use client";

import { useEffect, useState } from "react";
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
import {
  ROLE_HOMES,
  ROLE_KEYS,
  REMEMBER_EMAIL_KEY,
  SEED_STAFF_EMAIL,
  SEED_STAFF_PASSWORD,
  VISIBLE_ROLE_KEYS,
} from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/components/shared/toast-provider";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { ApiClientError } from "@/lib/api/client";
import { loginStaff } from "@/lib/api/auth";
import { isApiEnabled, isCcApiEnabled } from "@/lib/api/mode";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

function isRole(value: string): value is Role {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

const ROLE_META: Record<Role, { icon: Icon; accent: string; chip: string }> = {
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
  const { login } = useSession();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const apiOn = isApiEnabled() || isCcApiEnabled();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoRole, setDemoRole] = useState<Role>("cc");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function finishDemo(role: Role, name: string, username?: string) {
    login(
      role,
      name,
      undefined,
      rememberMe,
      undefined,
      username || SEED_STAFF_EMAIL(role),
    );
    toast(t("login.loggedInAs", { role: roleLabel(role, locale) }), "success");
    window.location.replace(ROLE_HOMES[role]);
  }

  async function signIn(nextEmail: string, nextPassword: string) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await loginStaff(nextEmail, nextPassword);
      if (!isRole(data.staff.role)) {
        toast(t("login.fail"), "error");
        return;
      }
      login(
        data.staff.role,
        data.staff.display_name,
        data.access_token,
        rememberMe,
        data.refresh_token,
        data.staff.email,
      );
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, nextEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        /* ignore */
      }
      toast(
        t("login.loggedInAs", { role: roleLabel(data.staff.role, locale) }),
        "success",
      );
      window.location.replace(ROLE_HOMES[data.staff.role]);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "AUTH_INVALID_CREDENTIALS") {
        toast(t("login.invalidCredentials"), "error");
      } else if (err instanceof ApiClientError && err.code === "AUTH_INACTIVE") {
        toast(t("login.inactive"), "error");
      } else if (err instanceof ApiClientError) {
        toast(err.detail, "error");
      } else {
        toast(t("login.fail"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (apiOn) {
      if (!email.trim()) {
        toast(t(apiOn ? "login.emailRequired" : "login.usernameRequired"), "error");
        return;
      }
      if (!password.trim()) {
        toast(t("login.passwordRequired"), "error");
        return;
      }
      await signIn(email.trim().toLowerCase(), password);
      return;
    }
    if (!email.trim()) {
      toast(t("login.usernameRequired"), "error");
      return;
    }
    if (!password.trim()) {
      toast(t("login.passwordRequired"), "error");
      return;
    }
    const nextUser = email.trim().toLowerCase();
    const matched = VISIBLE_ROLE_KEYS.find((r) => nextUser === SEED_STAFF_EMAIL(r));
    finishDemo(
      matched ?? demoRole,
      matched ? roleLabel(matched, locale) : email.trim(),
      nextUser,
    );
  }

  async function onQuickRole(role: Role) {
    if (apiOn) {
      const nextEmail = SEED_STAFF_EMAIL(role);
      setEmail(nextEmail);
      setPassword(SEED_STAFF_PASSWORD);
      try {
        await signIn(nextEmail, SEED_STAFF_PASSWORD);
        return;
      } catch {
        if (isApiEnabled()) return;
      }
    }
    setDemoRole(role);
    setEmail(SEED_STAFF_EMAIL(role));
    setPassword(SEED_STAFF_PASSWORD);
    finishDemo(role, roleLabel(role, locale), SEED_STAFF_EMAIL(role));
  }

  const selectedRole = apiOn
    ? VISIBLE_ROLE_KEYS.find((r) => email.trim().toLowerCase() === SEED_STAFF_EMAIL(r))
    : demoRole;

  const fade = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  const productWords = t("common.productName").split(/\s+/).filter(Boolean);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-page-dark text-white md:grid md:grid-cols-[1.08fr_0.92fr]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,rgba(6,121,87,0.32),transparent_48%),radial-gradient(ellipse_at_80%_100%,rgba(5,107,75,0.18),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_20%,black_10%,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45"
      />

      <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 md:min-h-dvh md:px-16 md:py-16 lg:px-20">
        <div className="absolute left-0 top-0 hidden h-full w-px bg-gradient-to-b from-primary-light/90 via-primary/70 to-transparent md:block" />
        <div className="absolute left-0 top-16 hidden h-24 w-px bg-primary-light shadow-[0_0_18px_rgba(10,156,111,0.7)] md:block" />

        <motion.div
          {...fade}
          transition={{ duration: 0.45 }}
          className="relative max-w-lg"
        >
          <div className="mb-10 flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-primary-light to-primary-dark text-[11px] font-semibold tracking-[0.18em] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_rgba(6,121,87,0.35)]">
              MD
              <span className="absolute inset-[2px] rounded-full border border-white/10" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
                {t("common.rab")}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-primary-light/80">
                {t("login.panelTag")}
              </p>
            </div>
          </div>

          <h1 className="text-[2.35rem] font-semibold leading-[1.02] tracking-[0.08em] sm:text-5xl md:text-[3.15rem]">
            {productWords.map((word) => (
              <span
                key={word}
                className="block bg-gradient-to-b from-white via-white to-white/65 bg-clip-text text-transparent"
              >
                {word}
              </span>
            ))}
          </h1>
          <div className="mt-6 h-px w-24 bg-gradient-to-r from-primary-light via-primary to-transparent" />

          <p className="mt-7 max-w-md text-[15px] leading-7 text-white/58">
            {t("login.panelBlurb")}
          </p>

          <ul className="mt-10 hidden items-center gap-x-3 gap-y-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 sm:flex sm:flex-wrap">
            {VISIBLE_ROLE_KEYS.map((r, i) => (
              <li key={r} className="flex items-center gap-3">
                {i > 0 ? (
                  <span aria-hidden className="h-px w-3 bg-white/15" />
                ) : null}
                {roleLabel(r, locale)}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

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
              {t(apiOn ? "login.subtitle" : "login.subtitleDemo")}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identity" className="text-neutral-700 dark:text-neutral-300">
                {t(apiOn ? "login.email" : "login.username")}
              </Label>
              <Input
                id="identity"
                type={apiOn ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t(apiOn ? "login.emailPlaceholder" : "login.usernamePlaceholder")}
                className="h-11 rounded-xl border-neutral-200 bg-neutral-50 px-3.5 text-base shadow-none focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
                autoComplete="username"
                disabled={busy}
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
                  disabled={busy}
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
              <p className="text-xs text-neutral-400">
                {t(apiOn ? "login.passwordHint" : "login.passwordHintDemo")}
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-neutral-700 dark:text-neutral-300">
                {t("login.quickAccess")}
              </Label>
              <div
                role="group"
                aria-label={t("login.quickAccess")}
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
              >
                {VISIBLE_ROLE_KEYS.map((r) => {
                  const meta = ROLE_META[r];
                  const Icon = meta.icon;
                  const selected = selectedRole === r;
                  return (
                    <motion.button
                      key={r}
                      type="button"
                      disabled={busy}
                      whileHover={reduceMotion || busy ? undefined : { y: -2 }}
                      whileTap={reduceMotion || busy ? undefined : { scale: 0.98 }}
                      onClick={() => void onQuickRole(r)}
                      className={cn(
                        "group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 disabled:opacity-60",
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
                      <span className="relative space-y-0.5 font-mono text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
                        <span className="block truncate">{SEED_STAFF_EMAIL(r)}</span>
                        <span className="block truncate">{SEED_STAFF_PASSWORD}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={busy}
                className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                {t("login.rememberMe")}
              </span>
            </label>

            <motion.div
              whileHover={reduceMotion || busy ? undefined : { scale: 1.01 }}
              whileTap={reduceMotion || busy ? undefined : { scale: 0.99 }}
            >
              <Button
                type="submit"
                variant="cta"
                size="lg"
                className="h-12 w-full rounded-xl text-sm font-semibold tracking-wide"
                disabled={busy}
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
