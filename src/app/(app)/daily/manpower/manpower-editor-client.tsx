"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconArrowLeft,
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
import { formatDateLong, todayISO } from "@/lib/date";
import { buildManpowerReport } from "@/lib/manpower-report";
import {
  getManpowerPaper,
  saveManpowerPaper,
  submitManpowerPaper,
} from "@/lib/store/paper-reports";
import { buildStrengthReport } from "@/lib/strength-report";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3") return raw;
  return "1";
}

export default function ManpowerEditorClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const state = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = parseForm(searchParams.get("form"));
  const dateParam = searchParams.get("date");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO(),
  );

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
  const listHref = `/daily/manpower?form=${form}`;
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

  function pushDate(next: string) {
    setDate(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    params.set("form", form);
    router.replace(`/daily/manpower/new?${params.toString()}`);
  }

  function onSave() {
    saveManpowerPaper(date, form, formTitle);
    toast(t("paperReports.savedToast"), "success");
  }

  function onSubmit() {
    submitManpowerPaper(date, form, formTitle);
    notifyCcDataChange();
    toast(t("paperReports.submittedToast"), "success");
    router.push(listHref);
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
          <div className="relative">
            <PageHeader
              title={formTitle}
              subtitle={t("pages.manpowerNew.subtitle", {
                date: formatDateLong(date, dateLocale),
              })}
              leading={
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href={listHref}>
                    <IconArrowLeft className="h-4 w-4" />
                    {t("common.back")}
                  </Link>
                </Button>
              }
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
      </motion.div>
    </PagePane>
  );
}
