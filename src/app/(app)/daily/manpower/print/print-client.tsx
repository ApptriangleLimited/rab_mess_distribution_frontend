"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconDownload, IconPrinter } from "@tabler/icons-react";
import { ForceRankLetter } from "@/components/manpower/force-rank-letter";
import { ManpowerLetter } from "@/components/manpower/manpower-letter";
import { StrengthLetter } from "@/components/manpower/strength-letter";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SettingsWingFilter } from "@/components/shared/settings-catalog-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useManpowerDay } from "@/hooks/use-manpower-day";
import { useStore } from "@/hooks/use-store";
import { formatDateLong, todayISO } from "@/lib/date";
import {
  buildForceRankReport,
  parseManpowerWingFilter,
} from "@/lib/force-rank-report";
import {
  isPaperPrintable,
  isPaperVerified,
} from "@/lib/store/paper-reports";
import { buildManpowerReport } from "@/lib/manpower-report";
import { buildStrengthReport } from "@/lib/strength-report";
import {
  downloadLetterElementPdf,
  manpowerPdfFilename,
} from "@/lib/download-letter-element";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { useToast } from "@/components/shared/toast-provider";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3" | "4";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3" || raw === "4") return raw;
  return "1";
}

export function ManpowerPrintClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const dateParam = searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO();
  const form = parseForm(searchParams.get("form"));
  const wing = parseManpowerWingFilter(searchParams.get("wing"));
  const wingQuery = form === "4" && wing !== "all" ? `&wing=${encodeURIComponent(wing)}` : "";

  const printable = isPaperPrintable("manpower", date, form);
  const verified = isPaperVerified("manpower", date, form);
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
  const form4 = useMemo(
    () => buildForceRankReport(date, reportSnapshot, wing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot, wing],
  );
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  const titleKey =
    form === "1"
      ? "manpower.form1Title"
      : form === "2"
        ? "manpower.form2Title"
        : form === "3"
          ? "manpower.form3Title"
          : "manpower.form4Title";

  function pushWing(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === "all") params.delete("wing");
    else params.set("wing", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `manpower-form${form}-${date}.pdf`,
        form === "4" ? "landscape" : "portrait",
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.manpowerPrint.title")}
          subtitle={`${t(titleKey)} · ${formatDateLong(date, dateLocale)}`}
          leading={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link
                href={`/daily/manpower?date=${encodeURIComponent(date)}&form=${form}${wingQuery}`}
              >
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          }
          actions={
            printable ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={downloading || loading}
                  onClick={async () => {
                    const el = printRef.current;
                    if (!el) return;
                    setDownloading(true);
                    try {
                      await downloadLetterElementPdf(
                        el,
                        manpowerPdfFilename(form, date, wing),
                        form === "4" ? "landscape" : "portrait",
                      );
                      toast(t("paperReports.downloaded"), "success");
                    } catch {
                      toast(t("common.tryAgain"), "error");
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  <IconDownload className="h-4 w-4" />
                  {t("common.download")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={printing || loading}
                  onClick={onPrint}
                >
                  <IconPrinter className="h-4 w-4" />
                  {printing || loading ? t("common.loading") : t("paperReports.print")}
                </Button>
              </div>
            ) : null
          }
        />
        {form === "4" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              {t("cc.filterWing")}
            </span>
            <SettingsWingFilter
              value={wing}
              onChange={pushWing}
              rootsOnly
              namesOnly
              className="w-[16rem] shrink-0"
              triggerClassName="h-10 rounded-xl"
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="p-4 text-sm text-neutral-500">{t("common.loading")}</p>
      ) : null}
      {!printable && !loading ? (
        <EmptyState
          title={t("paperReports.needApprove")}
          description={t("paperReports.waitingAdmin")}
        />
      ) : null}
      {printable && form === "1" && !loading ? (
        <div className="mx-auto w-full max-w-[210mm] overflow-x-hidden">
          <ManpowerLetter
            ref={printRef}
            report={form1}
            locale={dateLocale}
            verified={verified}
          />
        </div>
      ) : null}
      {printable && form === "2" && !loading ? (
        <div className="mx-auto w-full max-w-[210mm] overflow-x-hidden">
          <StrengthLetter
            ref={printRef}
            report={form2}
            locale={dateLocale}
            verified={verified}
          />
        </div>
      ) : null}
      {printable && form === "3" && !loading ? (
        <div className="mx-auto w-full max-w-[210mm] overflow-x-hidden">
          <StrengthLetter
            ref={printRef}
            report={form3}
            locale={dateLocale}
            verified={verified}
          />
        </div>
      ) : null}
      {printable && form === "4" && !loading ? (
        <div className="mx-auto w-full max-w-[297mm] overflow-x-auto">
          <ForceRankLetter
            ref={printRef}
            report={form4}
            verified={verified}
          />
        </div>
      ) : null}
    </PagePane>
  );
}
