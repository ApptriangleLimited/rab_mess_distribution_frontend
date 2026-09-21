"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { getStaffMe, staffSrbId, updateStaffProfile } from "@/lib/api/auth";
import { isCcApiEnabled } from "@/lib/api/mode";
import { SEED_STAFF_EMAIL } from "@/lib/constants";
import { setProfileAvatar } from "@/lib/session";
import type { Role, Session } from "@/lib/types";
import { useT } from "@/i18n/provider";

const MAX_BYTES = 800 * 1024;

type Mode = "view" | "edit" | "password";

export function ProfileDialog({
  open,
  session,
  avatarUrl,
  onClose,
  onSaved,
}: {
  open: boolean;
  session: Session;
  avatarUrl: string | null;
  onClose: () => void;
  onSaved: (name: string, avatar: string | null, username?: string) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(session.name);
  const [username, setUsername] = useState(
    session.username || SEED_STAFF_EMAIL(session.role),
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);

  function fallbackUsername(nextUser = session.username) {
    return nextUser || SEED_STAFF_EMAIL(session.role);
  }

  function resetFromSession(
    nextName = session.name,
    nextUser = fallbackUsername(),
    nextAvatar = avatarUrl,
  ) {
    setName(nextName);
    setUsername(nextUser);
    setPassword("");
    setConfirmPassword("");
    setPreview(nextAvatar);
  }

  useEffect(() => {
    if (!open) {
      setMode("view");
      return;
    }
    resetFromSession();
    if (isCcApiEnabled()) {
      void getStaffMe()
        .then((me) => {
          setUsername(staffSrbId(me));
          setName(me.display_name || session.name);
          if (me.avatar) setPreview(me.avatar);
        })
        .catch(() => {
          /* keep session values */
        });
    }
  }, [open, session.name, session.username, session.role, avatarUrl]);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast(t("profile.imageType"), "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast(t("profile.imageTooBig"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    const nextName = name.trim();
    const nextUser = username.trim();
    if (nextName.length < 2) {
      toast(t("profile.nameRequired"), "error");
      return;
    }
    if (!nextUser) {
      toast(t("profile.usernameRequired"), "error");
      return;
    }
    setBusy(true);
    try {
      if (isCcApiEnabled()) {
        await updateStaffProfile({
          display_name: nextName,
          avatar: preview,
        });
      }
      setProfileAvatar(session.role as Role, preview, nextUser);
      onSaved(nextName, preview, nextUser);
      setMode("view");
      toast(t("profile.saved"), "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("profile.saveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!password.trim()) {
      toast(t("profile.passwordRequired"), "error");
      return;
    }
    if (password !== confirmPassword) {
      toast(t("profile.passwordMismatch"), "error");
      return;
    }
    setBusy(true);
    try {
      if (isCcApiEnabled()) {
        await updateStaffProfile({
          display_name: name.trim() || session.name,
          username: username.trim() || fallbackUsername(),
          password,
        });
      }
      setPassword("");
      setConfirmPassword("");
      setMode("view");
      toast(t("profile.passwordChanged"), "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("profile.saveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    if (mode !== "view") {
      resetFromSession();
      setMode("view");
      return;
    }
    onClose();
  }

  function onConfirm() {
    if (mode === "view") {
      setMode("edit");
      return;
    }
    if (mode === "password") {
      void savePassword();
      return;
    }
    void saveProfile();
  }

  const title =
    mode === "edit"
      ? t("profile.titleEdit")
      : mode === "password"
        ? t("profile.titlePassword")
        : t("profile.title");
  const body =
    mode === "edit"
      ? t("profile.bodyEdit")
      : mode === "password"
        ? t("profile.bodyPassword")
        : t("profile.body");
  const confirmLabel =
    mode === "view"
      ? t("common.edit")
      : busy
        ? t("common.saving")
        : t("common.save");

  return (
    <ConfirmDialog
      open={open}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      cancelLabel={mode === "view" ? t("common.done") : t("common.back")}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        {mode !== "password" ? (
          <div className="flex items-center gap-4">
            {mode === "edit" ? (
              <button
                type="button"
                className="relative rounded-full ring-2 ring-primary/20 transition hover:ring-primary/40"
                onClick={() => fileRef.current?.click()}
                aria-label={t("profile.changePhoto")}
              >
                <UserAvatar name={name.trim() || session.name} src={preview} size="lg" />
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow">
                  <IconCamera className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : (
              <UserAvatar name={name.trim() || session.name} src={preview} size="lg" />
            )}
            <div className="min-w-0 text-sm text-neutral-600">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {t("profile.photo")}
              </p>
              {mode === "edit" ? <p className="text-xs">{t("profile.photoHint")}</p> : null}
            </div>
            {mode === "edit" ? (
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            ) : null}
          </div>
        ) : null}

        {mode === "edit" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">{t("profile.name")}</Label>
              <Input
                id="profile-name"
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-username">{t("profile.srbId")}</Label>
              <Input
                id="profile-username"
                value={username}
                maxLength={120}
                autoComplete="username"
                readOnly
                disabled
              />
              <p className="text-xs text-neutral-500">{t("profile.srbIdFixed")}</p>
            </div>
          </>
        ) : null}

        {mode === "password" ? (
          <>
            <div className="space-y-1.5">
              <Label>{t("profile.srbId")}</Label>
              <Input value={username} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-password">{t("profile.newPassword")}</Label>
              <Input
                id="profile-password"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-password-confirm">{t("profile.confirmPassword")}</Label>
              <Input
                id="profile-password-confirm"
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </>
        ) : null}

        {mode === "view" ? (
          <>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-neutral-500">{t("profile.srbId")}</dt>
                <dd className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
                  {username || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">{t("profile.password")}</dt>
                <dd className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
                  {t("profile.passwordHidden")}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => {
                setPassword("");
                setConfirmPassword("");
                setMode("password");
              }}
            >
              {t("profile.changePassword")}
            </Button>
          </>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
