"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconKey,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { isCcApiEnabled } from "@/lib/api/mode";
import {
  createStaffAccount,
  listStaffAccounts,
  revealStaffPassword,
  staffLoginId,
  updateStaffAccount,
  type StaffAccount,
} from "@/lib/api/staff";
import { listMembers, type MemberApiRow } from "@/lib/api/members";
import { ROLE_KEYS } from "@/lib/constants";
import {
  recalledStaffPassword,
  rememberStaffPassword,
} from "@/lib/staff-password-vault";
import { useSession } from "@/hooks/use-session";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  srbId: "",
  password: "",
  confirmPassword: "",
  role: "cc" as Role,
};

function looksLikeSrbId(value: string) {
  const next = value.trim();
  if (next.length < 2 || next.includes("@")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next);
}

function staffIdKeys(value: string) {
  const raw = value.trim();
  if (!raw) return [] as string[];
  const upper = raw.toUpperCase();
  const bare = upper.replace(/^SRB-?/, "");
  return [
    ...new Set(
      [raw, upper, bare, bare ? `SRB-${bare}` : ""]
        .filter(Boolean)
        .map((item) => item.toLowerCase()),
    ),
  ];
}

function memberMatchesStaffId(member: MemberApiRow, srbId: string) {
  const keys = new Set(staffIdKeys(srbId));
  return (
    staffIdKeys(member.rab_id).some((key) => keys.has(key)) ||
    staffIdKeys(member.personal_id || "").some((key) => keys.has(key))
  );
}

export function StaffAccountsSection({
  static: staticPanel = false,
  layout = "section",
}: {
  static?: boolean;
  layout?: "section" | "page";
} = {}) {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const { session } = useSession();
  const apiOn = isCcApiEnabled();
  const [rows, setRows] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [toggleRow, setToggleRow] = useState<StaffAccount | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [viewRow, setViewRow] = useState<StaffAccount | null>(null);
  const [viewPassword, setViewPassword] = useState("");
  const [viewMissing, setViewMissing] = useState(false);
  const [viewRevealed, setViewRevealed] = useState(false);
  const [passwordRow, setPasswordRow] = useState<StaffAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [memberMatch, setMemberMatch] = useState<MemberApiRow | null>(null);
  const [memberLookupError, setMemberLookupError] = useState("");
  const [memberLookupBusy, setMemberLookupBusy] = useState(false);
  const isAdmin = session?.role === "admin";
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return ROLE_KEYS.map((role) => ({
      role,
      items: rows.filter((row) => row.role === role),
    })).filter((group) => group.items.length > 0);
  }, [rows]);

  async function reload() {
    if (!apiOn) return;
    setLoading(true);
    try {
      const data = await listStaffAccounts();
      setRows(data.items);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.staffLoadFail"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [apiOn]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowFormPassword(false);
    setMemberMatch(null);
    setMemberLookupError("");
    setFormOpen(true);
  }

  function openEdit(row: StaffAccount) {
    setEditing(row);
    setForm({
      name: row.display_name,
      srbId: staffLoginId(row),
      password: "",
      confirmPassword: "",
      role: row.role,
    });
    setShowFormPassword(false);
    setMemberMatch(null);
    setMemberLookupError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowFormPassword(false);
    setMemberMatch(null);
    setMemberLookupError("");
  }

  async function lookupAcceptedMember(srbId: string) {
    if (!apiOn) return null;
    const key = srbId.trim();
    if (!looksLikeSrbId(key)) {
      setMemberMatch(null);
      setMemberLookupError("");
      return null;
    }
    if (ROLE_KEYS.some((role) => `SRB-${role.toUpperCase()}` === key.toUpperCase()) || key.toUpperCase() === "SRB-SUPERADMIN") {
      setMemberMatch(null);
      setMemberLookupError("");
      return "system";
    }
    setMemberLookupBusy(true);
    try {
      const data = await listMembers({ q: key, page: 1, page_size: 50 });
      const match = data.items.find((row) => memberMatchesStaffId(row, key));
      if (!match) {
        setMemberMatch(null);
        setMemberLookupError(t("settings.staffMustBeMember"));
        return null;
      }
      if (match.approval_status === "pending") {
        setMemberMatch(null);
        setMemberLookupError(t("settings.staffMemberPending"));
        return "pending";
      }
      if (match.approval_status !== "approved") {
        setMemberMatch(null);
        setMemberLookupError(t("settings.staffMustBeMember"));
        return null;
      }
      setMemberMatch(match);
      setMemberLookupError("");
      setForm((prev) =>
        prev.name.trim().length >= 2
          ? prev
          : { ...prev, name: match.name || prev.name },
      );
      return match;
    } catch {
      setMemberMatch(null);
      setMemberLookupError(t("settings.staffMustBeMember"));
      return null;
    } finally {
      setMemberLookupBusy(false);
    }
  }

  async function saveForm() {
    const name = form.name.trim();
    const srbId = form.srbId.trim();
    if (name.length < 2) {
      toast(t("profile.nameRequired"), "error");
      return;
    }
    if (!looksLikeSrbId(srbId)) {
      toast(t("settings.staffSrbIdRequired"), "error");
      return;
    }
    const member = await lookupAcceptedMember(srbId);
    if (apiOn && member === "pending") {
      toast(t("settings.staffMemberPending"), "error");
      return;
    }
    if (apiOn && member !== "system" && !member) {
      toast(t("settings.staffMustBeMember"), "error");
      return;
    }
    if (!editing && !form.password) {
      toast(t("settings.staffPasswordRequired"), "error");
      return;
    }
    if (form.password && !form.confirmPassword) {
      toast(t("profile.confirmPasswordRequired"), "error");
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast(t("profile.passwordMismatch"), "error");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        const updated = await updateStaffAccount(editing.id, {
          display_name: name,
          srb_id: srbId,
          role: form.role,
          password: form.password || undefined,
        });
        if (form.password) rememberStaffPassword(updated.id, form.password);
        setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        toast(t("settings.staffUpdated"), "success");
      } else {
        const created = await createStaffAccount({
          display_name: name,
          srb_id: srbId,
          password: form.password,
          role: form.role,
        });
        rememberStaffPassword(created.id, form.password);
        setRows((prev) => [...prev, created]);
        toast(t("settings.staffAdded"), "success");
      }
      closeForm();
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.staffSaveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(row: StaffAccount, role: Role) {
    if (row.role === role) return;
    setRoleBusyId(row.id);
    try {
      const updated = await updateStaffAccount(row.id, { role });
      setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast(t("settings.staffUpdated"), "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.staffSaveFail"),
        "error",
      );
    } finally {
      setRoleBusyId(null);
    }
  }

  async function confirmToggle() {
    if (!toggleRow) return;
    setBusy(true);
    try {
      const updated = await updateStaffAccount(toggleRow.id, {
        active: !toggleRow.active,
      });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast(t("settings.staffUpdated"), "success");
      setToggleRow(null);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.staffSaveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openViewPassword(row: StaffAccount) {
    setViewRow(row);
    setViewPassword("");
    setViewMissing(false);
    setViewRevealed(false);
    const local = recalledStaffPassword(row.id);
    try {
      const data = await revealStaffPassword(row.id);
      setViewPassword(data.password);
      rememberStaffPassword(row.id, data.password);
    } catch {
      if (local) setViewPassword(local);
      else setViewMissing(true);
    }
  }

  async function saveNewPassword() {
    if (!passwordRow) return;
    if (!newPassword) {
      toast(t("settings.staffPasswordRequired"), "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast(t("profile.passwordMismatch"), "error");
      return;
    }
    setBusy(true);
    try {
      const updated = await updateStaffAccount(passwordRow.id, {
        password: newPassword,
      });
      rememberStaffPassword(updated.id, newPassword);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast(t("profile.passwordChanged"), "success");
      setPasswordRow(null);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.staffSaveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const addButton = apiOn ? (
    <Button
      type="button"
      size="sm"
      variant="cta"
      className="h-8 rounded-xl"
      onClick={openCreate}
    >
      <IconPlus className="h-3.5 w-3.5" />
      {t("settings.staffAdd")}
    </Button>
  ) : null;

  const list = !apiOn ? (
    <p className="px-1 py-6 text-sm text-neutral-500">{t("settings.staffApiOff")}</p>
  ) : loading && rows.length === 0 ? (
    <p className="px-1 py-6 text-sm text-neutral-500">{t("common.loading")}</p>
  ) : rows.length === 0 ? (
    <p className="px-1 py-6 text-sm text-neutral-500">{t("settings.staffEmpty")}</p>
  ) : (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.role}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {roleLabel(group.role, locale)}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {group.items.length}
            </span>
          </h3>
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {group.items.map((row) => {
              const mine =
                session?.username?.toLowerCase() === staffLoginId(row).toLowerCase();
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {row.display_name}
                      {mine ? (
                        <span className="ml-2 text-[11px] font-semibold text-primary">
                          {t("settings.staffSelf")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{staffLoginId(row)}</p>
                    {isAdmin && row.password ? (
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-neutral-700 dark:text-neutral-200">
                        <span className="text-neutral-500">{t("profile.password")}:</span>
                        <span className="font-semibold">{row.password}</span>
                        <button
                          type="button"
                          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                          onClick={() => {
                            void navigator.clipboard.writeText(row.password ?? "");
                            toast(t("settings.staffPasswordCopied"), "success");
                          }}
                          aria-label={t("settings.staffCopyPassword")}
                        >
                          <IconCopy className="h-3.5 w-3.5" />
                        </button>
                      </p>
                    ) : isAdmin ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {t("settings.staffPasswordMissing")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={row.role}
                      disabled={mine || roleBusyId === row.id}
                      onValueChange={(value) => void changeRole(row, value as Role)}
                    >
                      <SelectTrigger
                        className="h-8 w-[8.5rem] rounded-xl text-xs"
                        aria-label={t("profile.role")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_KEYS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleLabel(role, locale)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        row.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
                      )}
                    >
                      {row.active
                        ? t("settings.staffActive")
                        : t("settings.staffInactive")}
                    </span>
                    {!isAdmin || !row.password ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl"
                        onClick={() => void openViewPassword(row)}
                      >
                        <IconEye className="h-3.5 w-3.5" />
                        {t("settings.staffViewPassword")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl"
                      onClick={() => {
                        setPasswordRow(row);
                        setNewPassword("");
                        setConfirmNewPassword("");
                        setShowNewPassword(false);
                      }}
                    >
                      <IconKey className="h-3.5 w-3.5" />
                      {t("settings.staffChangePassword")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl"
                      onClick={() => openEdit(row)}
                    >
                      {t("common.edit")}
                    </Button>
                    {!mine ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={row.active ? "outline" : "cta"}
                        className="h-8 rounded-xl"
                        onClick={() => setToggleRow(row)}
                      >
                        {row.active
                          ? t("settings.staffDeactivate")
                          : t("settings.staffActivate")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={formOpen}
        title={editing ? t("settings.staffEditTitle") : t("settings.staffAddTitle")}
        body={editing ? t("settings.staffEditBody") : t("settings.staffAddBody")}
        confirmLabel={busy ? t("common.saving") : editing ? t("common.save") : t("common.create")}
        busy={busy}
        onCancel={closeForm}
        onConfirm={() => void saveForm()}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">{t("profile.role")}</Label>
            <Select
              value={form.role}
              onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as Role }))}
            >
              <SelectTrigger id="staff-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_KEYS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel(role, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500">{t("settings.staffRoleAccess")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">{t("profile.name")}</Label>
            <Input
              id="staff-name"
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-srb-id">{t("settings.staffSrbId")}</Label>
            <Input
              id="staff-srb-id"
              type="text"
              inputMode="text"
              value={form.srbId}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => {
                setForm((prev) => ({ ...prev, srbId: e.target.value }));
                setMemberMatch(null);
                setMemberLookupError("");
              }}
              onBlur={() => {
                if (form.srbId.trim()) void lookupAcceptedMember(form.srbId);
              }}
            />
            {memberLookupBusy ? (
              <p className="text-xs text-neutral-500">{t("common.loading")}</p>
            ) : memberLookupError ? (
              <p className="text-xs font-medium text-red-600">{memberLookupError}</p>
            ) : memberMatch ? (
              <p className="text-xs font-medium text-emerald-700">
                {t("settings.staffMemberFound", { name: memberMatch.name })}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">{t("settings.staffSrbIdHint")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">{t("profile.password")}</Label>
            <div className="relative">
              <Input
                id="staff-password"
                type={showFormPassword ? "text" : "password"}
                value={form.password}
                autoComplete="new-password"
                className="pr-10"
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-neutral-500"
                onClick={() => setShowFormPassword((prev) => !prev)}
                aria-label={
                  showFormPassword
                    ? t("settings.staffHidePassword")
                    : t("settings.staffViewPassword")
                }
              >
                {showFormPassword ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {editing ? t("profile.passwordHint") : t("settings.staffPasswordHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password-confirm">{t("profile.confirmPassword")}</Label>
            <div className="relative">
              <Input
                id="staff-password-confirm"
                type={showFormPassword ? "text" : "password"}
                value={form.confirmPassword}
                autoComplete="new-password"
                className="pr-10"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-neutral-500"
                onClick={() => setShowFormPassword((prev) => !prev)}
                aria-label={
                  showFormPassword
                    ? t("settings.staffHidePassword")
                    : t("settings.staffViewPassword")
                }
              >
                {showFormPassword ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!viewRow}
        title={t("settings.staffPasswordTitle")}
        body={viewRow ? `${viewRow.display_name} · ${staffLoginId(viewRow)}` : ""}
        confirmLabel={t("common.done")}
        onCancel={() => setViewRow(null)}
        onConfirm={() => setViewRow(null)}
      >
        {viewMissing ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {t("settings.staffPasswordMissing")}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={viewPassword}
              type={viewRevealed ? "text" : "password"}
              className="font-mono"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-xl"
              onClick={() => setViewRevealed((prev) => !prev)}
            >
              {viewRevealed ? (
                <IconEyeOff className="h-3.5 w-3.5" />
              ) : (
                <IconEye className="h-3.5 w-3.5" />
              )}
              {viewRevealed
                ? t("settings.staffHidePassword")
                : t("settings.staffViewPassword")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-xl"
              onClick={() => {
                if (!viewPassword) return;
                void navigator.clipboard.writeText(viewPassword);
                toast(t("settings.staffPasswordCopied"), "success");
              }}
            >
              <IconCopy className="h-3.5 w-3.5" />
              {t("settings.staffCopyPassword")}
            </Button>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!passwordRow}
        title={t("profile.titlePassword")}
        body={
          passwordRow
            ? t("profile.bodyPassword")
            : ""
        }
        confirmLabel={busy ? t("common.saving") : t("common.save")}
        busy={busy}
        onCancel={() => setPasswordRow(null)}
        onConfirm={() => void saveNewPassword()}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="staff-new-password">{t("profile.newPassword")}</Label>
            <div className="relative">
              <Input
                id="staff-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                autoComplete="new-password"
                className="pr-10"
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-neutral-500"
                onClick={() => setShowNewPassword((prev) => !prev)}
              >
                {showNewPassword ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-500">{t("settings.staffPasswordHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-new-password-confirm">
              {t("profile.confirmPassword")}
            </Label>
            <Input
              id="staff-new-password-confirm"
              type={showNewPassword ? "text" : "password"}
              value={confirmNewPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!toggleRow}
        danger={!!toggleRow?.active}
        title={
          toggleRow?.active
            ? t("settings.staffDeactivateTitle")
            : t("settings.staffActivateTitle")
        }
        body={
          toggleRow?.active
            ? t("settings.staffDeactivateBody", { name: toggleRow?.display_name ?? "" })
            : t("settings.staffActivateBody", { name: toggleRow?.display_name ?? "" })
        }
        confirmLabel={
          toggleRow?.active ? t("settings.staffDeactivate") : t("settings.staffActivate")
        }
        busy={busy}
        onCancel={() => setToggleRow(null)}
        onConfirm={() => void confirmToggle()}
      />
    </>
  );

  if (layout === "page") {
    return (
      <>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">{t("settings.staffHint")}</p>
            {addButton}
          </div>
          {list}
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <CollapsibleSection
        static={staticPanel}
        title={t("settings.staffTitle")}
        hint={t("settings.staffHint")}
        icon={IconUsers}
        badge={rows.length ? String(rows.length) : undefined}
        headerActions={addButton}
      >
        {list}
      </CollapsibleSection>
      {dialogs}
    </>
  );
}
