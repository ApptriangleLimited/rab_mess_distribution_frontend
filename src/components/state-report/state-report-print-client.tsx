"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconDownload, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { StateReportLetter } from "@/components/state-report/state-report-letter";
import { Button } from "@/components/ui/button";
import { useStateReportById } from "@/hooks/use-state-reports";
import { useStore } from "@/hooks/use-store";
import { formatDateLong } from "@/lib/date";
import { downloadStateReportPdf } from "@/lib/download-state-report-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { getStateReport } from "@/lib/store/state-reports";
import { useI18n, useT } from "@/i18n/provider";

export function StateReportPrintClient({
  backBase,
}: {
  /** `/admin/state-reports` or `/daily/state-report` */
  backBase: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const { apiOn, report: apiReport } = useStateReportById(id);
  const storeReport = useMemo(
    () => (id ? getStateReport(id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, state.state_reports],
  );
  const report = apiOn ? apiReport : storeReport;

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  const backHref = useMemo(() => {
    if (!report) return backBase;
    if (backBase.startsWith("/daily")) {
      return `${backBase}?date=${encodeURIComponent(report.date)}`;
    }
    return `${backBase}?id=${encodeURIComponent(report.id)}`;
  }, [backBase, report]);

  function onDownload() {
    if (!report) return;
    downloadStateReportPdf(
      report,
      `state-report-${report.date}-${report.status}.pdf`,
    );
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !report) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `state-report-${report.date}.pdf`,
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
          title={t("pages.stateReportPrint.title")}
          subtitle={
            report
              ? t("pages.stateReportPrint.subtitle", {
                  date: formatDateLong(report.date, dateLocale),
                  status: t(
                    report.status === "pending"
                      ? "stateReport.statusPending"
                      : report.status === "approved"
                        ? "stateReport.statusApproved"
                        : "stateReport.statusRejected",
                  ),
                })
              : t("pages.stateReportPrint.missing")
          }
          leading={
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label={t("common.back")}
            >
              <Link href={backHref}>
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          }
          actions={
            report ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={onDownload}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  {t("daily.exportPdf")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="cta"
                  className="rounded-lg"
                  disabled={printing}
                  onClick={() => void onPrint()}
                >
                  <IconPrinter className="h-3.5 w-3.5" />
                  {t("mess.print")}
                </Button>
              </>
            ) : null
          }
        />
      </div>

      {!report ? (
        <EmptyState
          title={t("pages.stateReportPrint.missing")}
          description={t("pages.stateReportPrint.missingHint")}
        />
      ) : (
        <StateReportLetter
          ref={printRef}
          report={report}
          locale={dateLocale}
        />
      )}
    </PagePane>
  );
}
