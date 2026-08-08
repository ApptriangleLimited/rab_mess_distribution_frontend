"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { resetToSeed } from "@/lib/store";
import {
  STORE_KEY,
  isProtectedRateTag,
  isRationFamily,
  rolesForPicker,
} from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { homeForRole, setSession } from "@/lib/session";
import { nowISO } from "@/lib/date";
import type { DailyTag, Role } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useI18n, useT } from "@/i18n/provider";
import type { Locale } from "@/i18n";
import { roleLabel, tagLabel } from "@/i18n";
import { setRates, upsertRate, removeRate } from "@/lib/store/rates";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { SenderAccountsSection } from "@/components/ration/sender-accounts-section";
import { RegisterQrSection } from "@/components/settings/register-qr-section";
import { SectionCard } from "@/components/shared/section-card";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { IconCoin, IconCurrencyTaka, IconPlus, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const TAG_NAME_RE = /^[A-Za-z0-9]{2,8}$/;

export default function SettingsPage() {
  const state = useStore();
  const { toast } = useToast();
  const { session } = useSession();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const [rateDraft, setRateDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      state.rates.map((r) => [r.tag, String(r.amount_per_day)]),
    ),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newAmount, setNewAmount] = useState("0");
  const [deleteTag, setDeleteTag] = useState<DailyTag | null>(null);
  const [ratesOpen, setRatesOpen] = useState(false);

  const isRation = isRationFamily(session?.role);

  const eligibleCount = useMemo(
    () =>
      state.rates.filter(
        (r) => Number(rateDraft[r.tag] ?? r.amount_per_day) > 0,
      ).length,
    [state.rates, rateDraft],
  );

  function onReset() {
    resetToSeed();
    toast(t("settings.seedRestored"), "success");
    window.location.reload();
  }

  function onSwitchRole(role: Role) {
    if (!session) return;
    const next = { ...session, role, loggedInAt: nowISO() };
    setSession(next);
    toast(t("settings.switchedTo", { role: roleLabel(role, locale) }), "success");
    window.location.href = homeForRole(role);
  }

  function onSaveRates() {
    setRates(
      state.rates.map((r) => ({
        tag: r.tag,
        amount_per_day: Number(rateDraft[r.tag] ?? r.amount_per_day) || 0,
      })),
    );
    toast(t("settings.ratesSaved"), "success");
  }

  function closeAdd() {
    setAddOpen(false);
    setNewTag("");
    setNewAmount("0");
  }

  function onAddAllowance() {
    const name = newTag.trim();
    if (!name) {
      toast(t("settings.allowanceTagRequired"), "error");
      return;
    }
    if (!TAG_NAME_RE.test(name)) {
      toast(t("settings.allowanceTagInvalid"), "error");
      return;
    }
    if (
      state.rates.some((r) => r.tag.toLowerCase() === name.toLowerCase())
    ) {
      toast(t("settings.allowanceTagDuplicate"), "error");
      return;
    }
    const amount = Math.max(0, Number(newAmount) || 0);
    upsertRate(name as DailyTag, amount);
    setRateDraft((prev) => ({
      ...prev,
      [name]: String(amount),
    }));
    toast(t("settings.allowanceAdded"), "success");
    closeAdd();
  }

  function onDeleteAllowance() {
    if (!deleteTag) return;
    const tag = deleteTag;
    removeRate(tag);
    setRateDraft((prev) => {
      const next = { ...prev };
      delete next[tag];
      return next;
    });
    setDeleteTag(null);
    toast(t("settings.allowanceDeleted"), "success");
  }

  const ratesPanel = (
    <CollapsibleSection
      icon={IconCoin}
      title={t("settings.rates")}
      hint={t("settings.ratesHint")}
      open={ratesOpen}
      onOpenChange={setRatesOpen}
      badge={
        <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
          {eligibleCount}/{state.rates.length}
        </span>
      }
      headerActions={
        isRation ? (
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="shrink-0 rounded-lg"
            onClick={() => {
              setRatesOpen(true);
              setAddOpen(true);
            }}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("settings.addAllowance")}
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {state.rates.map((rate) => {
          const amount = Number(rateDraft[rate.tag] ?? rate.amount_per_day) || 0;
          const live = amount > 0;
          return (
            <li
              key={rate.tag}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 transition",
                live
                  ? "hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]"
                  : "opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-11 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold tracking-wider",
                  live
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 dark:border-neutral-600 dark:bg-neutral-900",
                )}
              >
                {rate.tag}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                  {tagLabel(rate.tag, locale)}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {t("settings.amountPerDay")}
                </p>
              </div>
              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-400">
                  <IconCurrencyTaka className="h-3.5 w-3.5" />
                </span>
                <Input
                  type="number"
                  min={0}
                  value={rateDraft[rate.tag] ?? String(rate.amount_per_day)}
                  onChange={(e) =>
                    setRateDraft((prev) => ({
                      ...prev,
                      [rate.tag]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                    }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={cn(
                    "h-9 rounded-lg pl-7 pr-2 text-right font-mono text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                    live && "border-primary/30 focus-visible:border-primary",
                  )}
                  aria-label={`${rate.tag} ${t("settings.amountPerDay")}`}
                />
              </div>
              {isRation && !isProtectedRateTag(rate.tag) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label={t("settings.deleteAllowance")}
                  onClick={() => setDeleteTag(rate.tag)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex items-center justify-end gap-2 border-t border-neutral-200/90 bg-neutral-50/80 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50">
        <Button variant="cta" size="sm" className="rounded-lg" onClick={onSaveRates}>
          {t("common.save")}
        </Button>
      </footer>
    </CollapsibleSection>
  );

  return (
    <PagePane>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        center={isRation ? <RationTabs /> : undefined}
      />

      {isRation ? (
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <SenderAccountsSection />
          </div>
          <div className="min-w-0">{ratesPanel}</div>
          <div className="min-w-0">
            <RegisterQrSection />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ratesPanel}
          <RegisterQrSection />
        </div>
      )}

      {/* Languages — kept for later; hidden for now */}
      <SectionCard className="hidden">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          {t("settings.locale")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{t("settings.localeHint")}</p>
        <div className="mt-4 max-w-xs space-y-2">
          <Label>{t("settings.locale")}</Label>
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("settings.localeEn")}</SelectItem>
              <SelectItem value="bn">{t("settings.localeBn")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Data store — kept for later; hidden for now */}
      <SectionCard className="hidden">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          {t("settings.dataStore")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("settings.dataStoreHint", {
            key: STORE_KEY,
            users: state.users.length,
            assignments: state.assignments.length,
            senders: state.senders.length,
          })}
        </p>
        <Button className="mt-4" variant="danger" onClick={() => setResetOpen(true)}>
          {t("settings.resetSeed")}
        </Button>
      </SectionCard>

      {/* Role switcher — kept for later; hidden for now */}
      <SectionCard className="hidden">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          {t("settings.roleSwitcher")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("settings.roleSwitcherHint")}
        </p>
        <div className="mt-4 max-w-xs space-y-2">
          <Label>{t("settings.activeRole")}</Label>
          <Select
            value={session?.role}
            onValueChange={(v) => onSwitchRole(v as Role)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectRole")} />
            </SelectTrigger>
            <SelectContent>
              {rolesForPicker(session?.role).map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={addOpen}
        title={t("settings.addAllowanceTitle")}
        body={t("settings.addAllowanceBody")}
        confirmLabel={t("settings.addAllowance")}
        onCancel={closeAdd}
        onConfirm={onAddAllowance}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("settings.allowanceTag")}</Label>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t("settings.allowanceTagPlaceholder")}
              className="h-10 rounded-lg"
              maxLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.amountPerDay")}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-400">
                <IconCurrencyTaka className="h-3.5 w-3.5" />
              </span>
              <Input
                type="number"
                min={0}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="h-10 rounded-lg pl-7 font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTag}
        danger
        title={t("confirm.deleteAllowanceTitle")}
        body={t("confirm.deleteAllowanceBody", {
          name: deleteTag ? tagLabel(deleteTag, locale) : "",
        })}
        confirmLabel={t("settings.deleteAllowance")}
        onCancel={() => setDeleteTag(null)}
        onConfirm={onDeleteAllowance}
      />

      <ConfirmDialog
        open={resetOpen}
        danger
        title={t("confirm.resetTitle")}
        body={t("confirm.resetBody")}
        confirmLabel={t("settings.resetSeed")}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          onReset();
        }}
      />
    </PagePane>
  );
}
