"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCheck,
  IconExternalLink,
  IconPrinter,
  IconSend,
} from "@tabler/icons-react";
import { ManpowerWeb } from "@/components/manpower/manpower-web";
import { StrengthWeb } from "@/components/manpower/strength-web";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { DatePicker } from "@/components/shared/date-picker";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { PaperStatusBadge } from "@/components/reports/paper-status-badge";
import { useToast } from "@/components/shared/toast-provider";
import { useManpowerDay } from "@/hooks/use-manpower-day";
import { useStore } from "@/hooks/use-store";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import { formatDateDisplay, formatDateLong, todayISO } from "@/lib/date";
import { buildManpowerReport } from "@/lib/manpower-report";
import {
  getManpowerPaper,
  listPaperReports,
  saveManpowerPaper,
  submitManpowerPaper,
} from "@/lib/store/paper-reports";
import { buildStrengthReport } from "@/lib/strength-report";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3") return raw;
  return "1";
}

export default function ManpowerClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateParam = searchParams.get("date");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO(),
  );

  const form = parseForm(searchParams.get("form"));

  const { apiOn, loading, snapshot } = useManpowerDay(date);
  const reportSnapshot = apiOn
    ? snapshot ?? {
        users: [],
        tagFor: () => "" as const,
        prefiltered: true,
      }
    : undefined;

  const form1 = useMemo(
    () => buildManpowerReport(date, reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );
  const form2 = useMemo(
    () => buildStrengthReport(date, "admin", reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );
  const form3 = useMemo(
    () => buildStrengthReport(date, "hq", reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const printHref = `/daily/manpower/print?date=${encodeURIComponent(date)}&form=${form}`;
  const showReport = !loading;
  const formTitle =
    form === "1"
      ? t("manpower.form1Title")
      : form === "2"
        ? t("manpower.form2Title")
        : t("manpower.form3Title");
  const paper = getManpowerPaper(date, form);
  const approved = paper?.status === "approved";
  const locked = paper?.status === "submitted" || approved;
  const manpowerRows = listPaperReports("manpower");

  const formTabs: {
    id: FormId;
    short: string;
    hintKey:
      | "manpower.form1Hint"
      | "manpower.form2Hint"
      | "manpower.form3Hint";
  }[] = [
    {
      id: "1",
      short: t("manpower.form1Short"),
      hintKey: "manpower.form1Hint",
    },
    {
      id: "2",
      short: t("manpower.form2Short"),
      hintKey: "manpower.form2Hint",
    },
    {
      id: "3",
      short: t("manpower.form3Short"),
      hintKey: "manpower.form3Hint",
    },
  ];

  function replaceQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function pushDate(next: string) {
    setDate(next);
    replaceQuery({ date: next, form });
  }

  function pushForm(next: FormId) {
    replaceQuery({ date, form: next });
  }

  function onSave() {
    saveManpowerPaper(date, form, formTitle);
    toast(t("paperReports.savedToast"), "success");
  }

  function onSubmit() {
    submitManpowerPaper(date, form, formTitle);
    notifyCcDataChange();
    toast(t("paperReports.submittedToast"), "success");
  }

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
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
              title={t("pages.manpower.title")}
              subtitle={t("pages.manpower.subtitle", {
                date: formatDateLong(date, dateLocale),
              })}
              center={<DailyTabs />}
              actions={
                <div className="flex items-center gap-1.5">
                  <DatePicker
                    value={date}
                    onChange={pushDate}
                    allowClear={false}
                    triggerClassName="h-9 w-[9.25rem] rounded-xl"
                  />
                  {approved ? (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-xl px-2.5"
                      >
                        <Link href={printHref} title={t("manpower.openPrint")}>
                          <IconExternalLink className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            {t("manpower.openPrint")}
                          </span>
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="h-9 gap-1.5 rounded-xl px-2.5 shadow-sm shadow-primary/20"
                      >
                        <Link href={printHref} title={t("paperReports.print")}>
                          <IconPrinter className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            {t("paperReports.print")}
                          </span>
                        </Link>
                      </Button>
                    </>
                  ) : paper ? (
                    <PaperStatusBadge status={paper.status} />
                  ) : null}
                </div>
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 px-2.5 py-2 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
          <span className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {t("manpower.formPicker")}
          </span>
          <div
            role="tablist"
            aria-label={t("manpower.formPicker")}
            className="flex min-w-0 flex-1 flex-wrap gap-1.5"
          >
            {formTabs.map((tab) => {
              const active = tab.id === form;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={t(tab.hintKey)}
                  onClick={() => pushForm(tab.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                    active
                      ? "border-primary/40 bg-primary text-white shadow-sm shadow-primary/20 dark:border-primary/50"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-primary/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
                  )}
                >
                  {tab.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-950/40">
          {loading ? (
            <p className="p-4 text-sm text-neutral-500">{t("common.loading")}</p>
          ) : null}
          {form === "1" && showReport ? <ManpowerWeb report={form1} /> : null}
          {form === "2" && showReport ? <StrengthWeb report={form2} /> : null}
          {form === "3" && showReport ? <StrengthWeb report={form3} /> : null}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          {paper?.status === "submitted" ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t("paperReports.waitingAdmin")}
            </p>
          ) : null}
          {!approved ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("paperReports.needApprove")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl"
              disabled={locked || loading}
              onClick={onSave}
            >
              <IconCheck className="h-4 w-4" />
              {t("paperReports.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 rounded-xl"
              disabled={approved || loading}
              onClick={onSubmit}
            >
              <IconSend className="h-4 w-4" />
              {t("paperReports.submit")}
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold dark:border-neutral-800">
            {t("paperReports.listTitle")}
          </div>
          {manpowerRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500">
              {t("paperReports.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("paperReports.colDate")}</th>
                    <th className="px-4 py-3">{t("paperReports.colTitle")}</th>
                    <th className="px-4 py-3">{t("paperReports.colStatus")}</th>
                    <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {manpowerRows.map((row) => {
                    const href = `/daily/manpower/print?date=${encodeURIComponent(row.ref)}&form=${row.form ?? "1"}`;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-neutral-100 dark:border-neutral-800"
                      >
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {formatDateDisplay(row.date)}
                          {row.form ? ` · ${row.form}` : ""}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.title}</td>
                        <td className="px-4 py-3">
                          <PaperStatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.status === "approved" ? (
                            <Button asChild variant="outline" size="sm" className="rounded-xl">
                              <Link href={href}>
                                <IconPrinter className="h-4 w-4" />
                                {t("paperReports.print")}
                              </Link>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </motion.div>
    </PagePane>
  );
}
