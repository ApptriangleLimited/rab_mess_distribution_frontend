"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconUsers } from "@tabler/icons-react";
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
  updateStaffAccount,
  type StaffAccount,
} from "@/lib/api/staff";
import { ROLE_KEYS } from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import type { Role } from "@/lib/types";
import { roleLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "cc" as Role,
};

export function StaffAccountsSection({
  static: staticPanel = false,
}: {
  static?: boolean;
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
    setFormOpen(true);
  }

  function openEdit(row: StaffAccount) {
    setEditing(row);
    setForm({
      name: row.display_name,
      username: row.email,
      password: "",
      confirmPassword: "",
      role: row.role,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function saveForm() {
    const name = form.name.trim();
    const username = form.username.trim();
    if (name.length < 2) {
      toast(t("profile.nameRequired"), "error");
      return;
    }
    if (username.length < 2) {
      toast(t("profile.usernameRequired"), "error");
      return;
    }
    if (!editing && !form.password) {
      toast(t("settings.staffPasswordRequired"), "error");
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
          username,
          role: form.role,
          password: form.password || undefined,
        });
        setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        toast(t("settings.staffUpdated"), "success");
      } else {
        const created = await createStaffAccount({
          display_name: name,
          username,
          password: form.password,
          role: form.role,
        });
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

  return (
    <>
      <CollapsibleSection
        static={staticPanel}
        title={t("settings.staffTitle")}
        hint={t("settings.staffHint")}
        icon={IconUsers}
        badge={rows.length ? String(rows.length) : undefined}
        headerActions={
          apiOn ? (
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
          ) : null
        }
      >
        {!apiOn ? (
          <p className="px-1 py-6 text-sm text-neutral-500">{t("settings.staffApiOff")}</p>
        ) : loading && rows.length === 0 ? (
          <p className="px-1 py-6 text-sm text-neutral-500">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-6 text-sm text-neutral-500">{t("settings.staffEmpty")}</p>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) =>
              group.items.length === 0 ? null : (
                <section key={group.role}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    {roleLabel(group.role, locale)}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {group.items.length}
                    </span>
                  </h3>
                  <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                    {group.items.map((row) => {
                      const mine = session?.username?.toLowerCase() === row.email.toLowerCase();
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
                            <p className="truncate text-xs text-neutral-500">{row.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                row.active
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
                              )}
                            >
                              {row.active ? t("settings.staffActive") : t("settings.staffInactive")}
                            </span>
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
              ),
            )}
          </div>
        )}
      </CollapsibleSection>

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
            <Label htmlFor="staff-name">{t("profile.name")}</Label>
            <Input
              id="staff-name"
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-username">{t("profile.username")}</Label>
            <Input
              id="staff-username"
              value={form.username}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">{t("profile.password")}</Label>
            <Input
              id="staff-password"
              type="password"
              value={form.password}
              autoComplete="new-password"
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <p className="text-xs text-neutral-500">
              {editing ? t("profile.passwordHint") : t("settings.staffPasswordHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password-confirm">{t("profile.confirmPassword")}</Label>
            <Input
              id="staff-password-confirm"
              type="password"
              value={form.confirmPassword}
              autoComplete="new-password"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
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
}
