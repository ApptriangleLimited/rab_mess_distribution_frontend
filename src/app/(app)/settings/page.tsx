"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import {
  createRate,
  deleteRate,
  listRates,
  putRates,
  rateApiToAllowanceRate,
} from "@/lib/api/settings";
import { resetToSeed } from "@/lib/store";
import {
  CL_FR_MONTHLY_TAG,
  STORE_KEY,
  isProtectedRateTag,
  isRationFamily,
  rolesForPicker,
} from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { switchToSeedRole } from "@/lib/api/switch-role";
import { homeForRole } from "@/lib/session";
import type { AllowanceRate, DailyTag, Role } from "@/lib/types";
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
import { parseMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { SenderAccountsSection } from "@/components/ration/sender-accounts-section";
import { AuthorizedSection } from "@/components/settings/authorized-section";
import { MemberBanksSection } from "@/components/settings/member-banks-section";
import { RegisterQrSection } from "@/components/settings/register-qr-section";
import { StaffAccountsSection } from "@/components/settings/staff-accounts-section";
import { OrgListSection } from "@/components/settings/org-list-section";
import {
  parseSettingsTab,
  SettingsSectionTabs,
  type SettingsTabId,
} from "@/components/settings/settings-section-tabs";
import { SectionCard } from "@/components/shared/section-card";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Skeleton } from "@/components/ui/skeleton";
import { tagCellClass } from "@/lib/tag-colors";
import {
  IconCoin,
  IconCurrencyTaka,
  IconMilitaryRank,
  IconPlus,
  IconShield,
  IconTopologyStar3,
  IconTrash,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const TAG_NAME_RE = /^[A-Za-z0-9]{2,8}$/;

function SettingsPageInner() {
  const state = useStore();
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const { session } = useSession();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const isRation = isRationFamily(session?.role);
  const canManageStaff = session?.role === "admin" || session?.role === "mess";

  const tab = parseSettingsTab(searchParams.get("tab"), isRation, canManageStaff);

  useEffect(() => {
    const raw = searchParams.get("tab");
    const next = parseSettingsTab(raw, isRation, canManageStaff);
    if (raw === next) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, isRation, canManageStaff, pathname, router]);

  function setTab(id: SettingsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

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
  const [loadingRates, setLoadingRates] = useState(false);
  const [apiRates, setApiRates] = useState<AllowanceRate[] | null>(null);

  const rates = apiOn && apiRates ? apiRates : state.rates;

  useEffect(() => {
    if (!apiOn) return;
    let cancelled = false;
    setLoadingRates(true);
    void listRates()
      .then((res) => {
        if (cancelled) return;
        const next = res.items.map(rateApiToAllowanceRate);
        setApiRates(next);
        setRateDraft(
          Object.fromEntries(
            next.map((r) => [r.tag, String(r.amount_per_day)]),
          ),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setApiRates([]);
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load allowance rates from API.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingRates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, toast]);

  useEffect(() => {
    if (apiOn) return;
    setRateDraft(
      Object.fromEntries(
        state.rates.map((r) => [r.tag, String(r.amount_per_day)]),
      ),
    );
  }, [apiOn, state.rates]);

  const eligibleCount = useMemo(
    () =>
      rates.filter(
        (r) => parseMoney(rateDraft[r.tag] ?? r.amount_per_day) > 0,
      ).length,
    [rates, rateDraft],
  );

  function onReset() {
    resetToSeed();
    toast(t("settings.seedRestored"), "success");
    window.location.reload();
  }

  async function onSwitchRole(role: Role) {
    if (!session) return;
    try {
      await switchToSeedRole(role, session);
      toast(t("settings.switchedTo", { role: roleLabel(role, locale) }), "success");
      window.location.href = homeForRole(role);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.switchFailed"),
        "error",
      );
    }
  }

  async function onSaveRates() {
    const next = rates.map((r) => ({
      tag: r.tag,
      amount_per_day: parseMoney(rateDraft[r.tag] ?? r.amount_per_day),
    }));
    if (apiOn) {
      try {
        const res = await putRates(next);
        const saved = res.items.map(rateApiToAllowanceRate);
        setApiRates(saved);
        setRateDraft(
          Object.fromEntries(
            saved.map((r) => [r.tag, String(r.amount_per_day)]),
          ),
        );
        toast(t("settings.ratesSaved"), "success");
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not save allowance rates.";
        toast(detail, "error");
      }
      return;
    }
    setRates(next);
    toast(t("settings.ratesSaved"), "success");
  }

  function closeAdd() {
    setAddOpen(false);
    setNewTag("");
    setNewAmount("0");
  }

  async function onAddAllowance() {
    const name = newTag.trim();
    if (!name) {
      toast(t("settings.allowanceTagRequired"), "error");
      return;
    }
    if (!TAG_NAME_RE.test(name)) {
      toast(t("settings.allowanceTagInvalid"), "error");
      return;
    }
    if (rates.some((r) => r.tag.toLowerCase() === name.toLowerCase())) {
      toast(t("settings.allowanceTagDuplicate"), "error");
      return;
    }
    const amount = parseMoney(newAmount);
    if (apiOn) {
      try {
        const created = await createRate(name, amount);
        const row = rateApiToAllowanceRate(created);
        setApiRates((prev) => [...(prev ?? []), row]);
        setRateDraft((prev) => ({
          ...prev,
          [row.tag]: String(row.amount_per_day),
        }));
        toast(t("settings.allowanceAdded"), "success");
        closeAdd();
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not add allowance tag.";
        toast(detail, "error");
      }
      return;
    }
    upsertRate(name as DailyTag, amount);
    setRateDraft((prev) => ({
      ...prev,
      [name]: String(amount),
    }));
    toast(t("settings.allowanceAdded"), "success");
    closeAdd();
  }

  async function onDeleteAllowance() {
    if (!deleteTag) return;
    const tag = deleteTag;
    if (apiOn) {
      try {
        await deleteRate(tag);
        setApiRates((prev) => (prev ?? []).filter((r) => r.tag !== tag));
        setRateDraft((prev) => {
          const next = { ...prev };
          delete next[tag];
          return next;
        });
        setDeleteTag(null);
        toast(t("settings.allowanceDeleted"), "success");
      } catch (err) {
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not delete allowance tag.";
        toast(detail, "error");
      }
      return;
    }
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
      static
      className="border-primary/10 shadow-sm"
      badge={
        <span className="rounded-lg bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary">
          {eligibleCount}/{rates.length}
        </span>
      }
      headerActions={
        isRation ? (
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="h-9 shrink-0 rounded-xl shadow-sm shadow-primary/20"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t("settings.addAllowance")}
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {loadingRates ? (
          <li className="px-3 py-8 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </li>
        ) : (
          rates.map((rate) => {
          const amount = parseMoney(rateDraft[rate.tag] ?? rate.amount_per_day);
          const live = amount > 0;
          return (
            <li
              key={rate.tag}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 transition",
                live
                  ? "hover:bg-primary/[0.03] dark:hover:bg-primary/5"
                  : "opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-bold tracking-wider",
                  live
                    ? tagCellClass(rate.tag)
                    : "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 dark:border-neutral-600 dark:bg-neutral-900",
                )}
              >
                {rate.tag}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                  {tagLabel(rate.tag, locale)}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {rate.tag.toUpperCase() === CL_FR_MONTHLY_TAG
                    ? t("settings.amountPerMonth")
                    : t("settings.amountPerDay")}
                </p>
              </div>
              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-neutral-400">
                  <IconCurrencyTaka className="h-3.5 w-3.5" />
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
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
                    "h-9 rounded-xl pl-7 pr-2 text-right font-mono text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
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
                  className="h-9 w-9 shrink-0 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label={t("settings.deleteAllowance")}
                  onClick={() => setDeleteTag(rate.tag)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          );
        })
        )}
      </ul>

      <footer className="mt-auto flex items-center justify-end gap-2 border-t border-primary/10 bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/50 px-3 py-2.5 dark:border-primary/20 dark:from-primary/10 dark:via-neutral-950 dark:to-neutral-950">
        <Button
          variant="cta"
          size="sm"
          className="h-9 rounded-xl shadow-sm shadow-primary/20"
          onClick={onSaveRates}
        >
          {t("common.save")}
        </Button>
      </footer>
    </CollapsibleSection>
  );

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-nav-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("settings.title")}
              subtitle={t("settings.subtitle")}
              center={isRation ? <RationTabs /> : null}
            />
          </div>
        </div>

        <SettingsSectionTabs
          value={tab}
          onChange={setTab}
          isRation={isRation}
          canManageStaff={canManageStaff}
        />

        {tab === "staff" && canManageStaff ? (
          <StaffAccountsSection static />
        ) : null}
        {tab === "rates" ? ratesPanel : null}
        {tab === "rank" ? (
          <OrgListSection kind="rank" icon={IconMilitaryRank} />
        ) : null}
        {tab === "wing" ? (
          <OrgListSection kind="wing" icon={IconTopologyStar3} />
        ) : null}
        {tab === "force" ? (
          <OrgListSection kind="force" icon={IconShield} />
        ) : null}
        {tab === "bank" && isRation ? (
          <SenderAccountsSection static rateTags={rates.map((r) => r.tag)} />
        ) : null}
        {tab === "member-bank" && isRation ? (
          <MemberBanksSection static />
        ) : null}
        {tab === "authorized" ? <AuthorizedSection static /> : null}
        {tab === "qr" ? <RegisterQrSection static /> : null}

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
      </motion.div>

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
              className="h-10 rounded-xl"
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
                step="0.01"
                inputMode="decimal"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="h-10 rounded-xl pl-7 font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
