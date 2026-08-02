"use client";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { resetToSeed } from "@/lib/store";
import { ROLE_KEYS, STORE_KEY } from "@/lib/constants";
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
import { setRates } from "@/lib/store/rates";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";

export default function SettingsPage() {
  const state = useStore();
  const { toast } = useToast();
  const { session } = useSession();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const [rateDraft, setRateDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.rates.map((r) => [r.tag, r.amount_per_day])),
  );
  const [resetOpen, setResetOpen] = useState(false);

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

  return (
    <PagePane>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <SectionCard>
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

      <SectionCard>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          {t("settings.rates")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{t("settings.ratesHint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.rates.map((rate) => (
            <div key={rate.tag} className="space-y-1 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <Label>
                {rate.tag} — {tagLabel(rate.tag as DailyTag, locale)}
              </Label>
              <Input
                type="number"
                min={0}
                value={rateDraft[rate.tag] ?? rate.amount_per_day}
                onChange={(e) =>
                  setRateDraft((prev) => ({
                    ...prev,
                    [rate.tag]: Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-neutral-500">{t("settings.amountPerDay")}</p>
            </div>
          ))}
        </div>
        <Button className="mt-4" variant="cta" onClick={onSaveRates}>
          {t("common.save")}
        </Button>
      </SectionCard>

      <SectionCard>
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

      <SectionCard>
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
              {ROLE_KEYS.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

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
