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
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { SenderAccountsSection } from "@/components/ration/sender-accounts-section";
import { SectionCard } from "@/components/shared/section-card";
import { IconCoin, IconCurrencyTaka } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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

  const ratesPanel = (
    <section
      className={cn(
        "section-card flex flex-col overflow-hidden p-0",
        session?.role === "ration" && "min-h-[28rem]",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200/90 bg-gradient-to-br from-neutral-50/90 to-white px-5 py-4 dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconCoin className="h-4 w-4" stroke={2} />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              {t("settings.rates")}
            </h2>
            <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
              {eligibleCount}/{state.rates.length}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
            {t("settings.ratesHint")}
          </p>
        </div>
      </header>

      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {state.rates.map((rate) => {
          const amount = Number(rateDraft[rate.tag] ?? rate.amount_per_day) || 0;
          const live = amount > 0;
          return (
            <li
              key={rate.tag}
              className={cn(
                "flex items-center gap-3 px-5 py-3 transition",
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
                  {tagLabel(rate.tag as DailyTag, locale)}
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
                  value={rateDraft[rate.tag] ?? rate.amount_per_day}
                  onChange={(e) =>
                    setRateDraft((prev) => ({
                      ...prev,
                      [rate.tag]: Number(e.target.value),
                    }))
                  }
                  className={cn(
                    "h-9 rounded-lg pl-7 pr-2 text-right font-mono text-sm tabular-nums",
                    live && "border-primary/30 focus-visible:border-primary",
                  )}
                  aria-label={`${rate.tag} ${t("settings.amountPerDay")}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex items-center justify-end gap-3 border-t border-neutral-200/90 bg-neutral-50/80 px-5 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
        <Button variant="cta" size="sm" className="rounded-lg" onClick={onSaveRates}>
          {t("common.save")}
        </Button>
      </footer>
    </section>
  );

  return (
    <PagePane>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        center={session?.role === "ration" ? <RationTabs /> : undefined}
      />

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

      {session?.role === "ration" ? (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          <div id="bank-accounts" className="min-w-0 scroll-mt-6">
            <SenderAccountsSection />
          </div>
          <div className="min-w-0">{ratesPanel}</div>
        </div>
      ) : (
        ratesPanel
      )}

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
