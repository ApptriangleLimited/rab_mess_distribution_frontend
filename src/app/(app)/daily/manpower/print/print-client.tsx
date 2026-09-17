"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { ManpowerLetter } from "@/components/manpower/manpower-letter";
import { StrengthLetter } from "@/components/manpower/strength-letter";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useManpowerDay } from "@/hooks/use-manpower-day";
import { useStore } from "@/hooks/use-store";
import { formatDateLong, todayISO } from "@/lib/date";
import {
  isPaperPrintable,
  isPaperVerified,
} from "@/lib/store/paper-reports";
import { buildManpowerReport } from "@/lib/manpower-report";
import { buildStrengthReport } from "@/lib/strength-report";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3") return raw;
  return "1";
}

export function ManpowerPrintClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const dateParam = searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO();
  const form = parseForm(searchParams.get("form"));

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

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  const titleKey =
    form === "1"
      ? "manpower.form1Title"
      : form === "2"
        ? "manpower.form2Title"
        : "manpower.form3Title";

  async function onPrint() {
    const el = printRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `manpower-form${form}-${date}.pdf`,
        "portrait",
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
                href={`/daily/manpower?date=${encodeURIComponent(date)}&form=${form}`}
              >
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          }
          actions={
            printable ? (
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
            ) : null
          }
        />
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
        <ManpowerLetter
          ref={printRef}
          report={form1}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
      {printable && form === "2" && !loading ? (
        <StrengthLetter
          ref={printRef}
          report={form2}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
      {printable && form === "3" && !loading ? (
        <StrengthLetter
          ref={printRef}
          report={form3}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
    </PagePane>
  );
}
