"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconArrowRight, IconEye, IconEyeOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROLE_HOMES,
  ROLE_KEYS,
  REMEMBER_EMAIL_KEY,
  SEED_STAFF_EMAIL,
  VISIBLE_ROLE_KEYS,
} from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/components/shared/toast-provider";
import { useI18n, useT } from "@/i18n/provider";
import { roleLabel } from "@/i18n";
import { ApiClientError } from "@/lib/api/client";
import { changePasswordAtLogin, loginStaff } from "@/lib/api/auth";
import { StaffPasswordPolicy } from "@/components/settings/staff-password-policy";
import { staffPasswordReady } from "@/lib/staff-password";
import { isApiEnabled, isCcApiEnabled } from "@/lib/api/mode";
import type { Role } from "@/lib/types";

function isRole(value: string): value is Role {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  revealed,
  onToggleReveal,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-neutral-700 dark:text-neutral-300">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border-neutral-200 bg-neutral-50 px-3.5 pr-11 text-base shadow-none focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          onClick={onToggleReveal}
          aria-label={revealed ? hideLabel : showLabel}
        >
          {revealed ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useSession();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const apiOn = isApiEnabled() || isCcApiEnabled();
  const [mode, setMode] = useState<"signin" | "change">("signin");
  const [rabId, setRabId] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setRabId(saved);
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
        data.staff.srb_id || data.staff.rab_id || data.staff.email,
      );
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, nextEmail.trim());
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

  function resetChangeFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function openChangePassword() {
    setMode("change");
    setCurrentPassword(password);
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(showPassword);
    setShowNew(false);
    setShowConfirm(false);
  }

  function backToSignIn() {
    setMode("signin");
    resetChangeFields();
  }

  async function updatePassword() {
    if (busy) return;
    if (!rabId.trim()) {
      toast(t("login.srbIdRequired"), "error");
      return;
    }
    if (!currentPassword.trim()) {
      toast(t("login.passwordRequired"), "error");
      return;
    }
    if (!newPassword.trim()) {
      toast(t("profile.passwordRequired"), "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t("profile.passwordMismatch"), "error");
      return;
    }
    if (newPassword === currentPassword) {
      toast(t("login.passwordSame"), "error");
      return;
    }
    if (!staffPasswordReady(newPassword)) {
      toast(t("settings.staffPasswordWeak"), "error");
      return;
    }
    if (!apiOn) {
      toast(t("settings.staffApiOff"), "error");
      return;
    }
    setBusy(true);
    try {
      await changePasswordAtLogin(rabId.trim(), currentPassword, newPassword);
      setPassword("");
      backToSignIn();
      toast(t("login.changePasswordDone"), "success");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "AUTH_INVALID_CREDENTIALS") {
        toast(t("login.invalidCredentials"), "error");
      } else if (err instanceof ApiClientError && err.code === "AUTH_INACTIVE") {
        toast(t("login.inactive"), "error");
      } else if (err instanceof ApiClientError && err.code === "AUTH_PASSWORD_SAME") {
        toast(t("login.passwordSame"), "error");
      } else if (err instanceof ApiClientError) {
        toast(err.detail, "error");
      } else {
        toast(t("login.changePasswordFail"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "change") {
      await updatePassword();
      return;
    }
    if (apiOn) {
      if (!rabId.trim()) {
        toast(t("login.srbIdRequired"), "error");
        return;
      }
      if (!password.trim()) {
        toast(t("login.passwordRequired"), "error");
        return;
      }
      await signIn(rabId.trim(), password);
      return;
    }
    if (!rabId.trim()) {
      toast(t("login.srbIdRequired"), "error");
      return;
    }
    if (!password.trim()) {
      toast(t("login.passwordRequired"), "error");
      return;
    }
    const nextUser = rabId.trim();
    const matched = VISIBLE_ROLE_KEYS.find(
      (r) => nextUser.toLowerCase() === SEED_STAFF_EMAIL(r).toLowerCase(),
    );
    finishDemo(
      matched ?? "cc",
      matched ? roleLabel(matched, locale) : nextUser,
      nextUser,
    );
  }

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
              {t(mode === "change" ? "login.changePassword" : "login.gateLabel")}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-title dark:text-white">
              {t(mode === "change" ? "login.changePasswordTitle" : "login.welcome")}
            </h2>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {mode === "change"
                ? t("login.changePasswordSubtitle")
                : t(apiOn ? "login.subtitle" : "login.subtitleDemo")}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identity" className="text-neutral-700 dark:text-neutral-300">
                {t("login.srbId")}
              </Label>
              <Input
                id="identity"
                type="text"
                value={rabId}
                onChange={(e) => setRabId(e.target.value)}
                placeholder={t("login.srbIdPlaceholder")}
                className="h-11 rounded-xl border-neutral-200 bg-neutral-50 px-3.5 text-base shadow-none focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
                autoComplete="username"
                disabled={busy}
              />
            </div>

            {mode === "change" ? (
              <>
                <PasswordField
                  id="current-password"
                  label={t("login.currentPassword")}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="current-password"
                  disabled={busy}
                  revealed={showCurrent}
                  onToggleReveal={() => setShowCurrent((v) => !v)}
                  showLabel={t("login.showPassword")}
                  hideLabel={t("login.hidePassword")}
                />
                <PasswordField
                  id="new-password"
                  label={t("login.newPassword")}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="new-password"
                  disabled={busy}
                  revealed={showNew}
                  onToggleReveal={() => setShowNew((v) => !v)}
                  showLabel={t("login.showPassword")}
                  hideLabel={t("login.hidePassword")}
                />
                <PasswordField
                  id="confirm-password"
                  label={t("login.confirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="new-password"
                  disabled={busy}
                  revealed={showConfirm}
                  onToggleReveal={() => setShowConfirm((v) => !v)}
                  showLabel={t("login.showPassword")}
                  hideLabel={t("login.hidePassword")}
                />
                <StaffPasswordPolicy password={newPassword} />
              </>
            ) : (
              <PasswordField
                id="password"
                label={t("login.password")}
                value={password}
                onChange={setPassword}
                placeholder={t("login.passwordPlaceholder")}
                autoComplete="current-password"
                disabled={busy}
                revealed={showPassword}
                onToggleReveal={() => setShowPassword((v) => !v)}
                showLabel={t("login.showPassword")}
                hideLabel={t("login.hidePassword")}
              />
            )}

            {mode === "signin" ? (
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
            ) : null}

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
                {mode === "change" ? t("login.changePasswordSubmit") : t("login.enterSystem")}
                <IconArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>

            {mode === "change" ? (
              <button
                type="button"
                disabled={busy}
                onClick={backToSignIn}
                className="w-full text-center text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {t("login.changePasswordBack")}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={openChangePassword}
                className="w-full text-center text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {t("login.changePassword")}
              </button>
            )}
            <Link
              href="/device"
              className="block w-full text-center text-sm font-medium text-neutral-500 hover:text-primary hover:underline"
            >
              {t("zkGate.openDisplay")}
            </Link>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
