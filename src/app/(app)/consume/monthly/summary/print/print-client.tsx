"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  IconArrowLeft,
  IconDownload,
  IconPrinter,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { WingSummaryPrint } from "@/components/consume/wing-summary-print";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatMonthLong, monthKey } from "@/lib/date";
import { downloadWingSummaryPdf } from "@/lib/download-consume-pdfs";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { buildWingSummary } from "@/lib/reports";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeSummaryPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();

  const summary = useMemo(
    () => buildWingSummary(month),
    [state.assignments, state.users, state.rates, month],
  );

  const backHref = `/consume/monthly/summary?month=${month}`;
  const canAct = summary.rows.length > 0;

  function onDownload() {
    if (!canAct) return;
    downloadWingSummaryPdf({
      month,
      tagCodes: summary.tagCodes,
      rows: summary.rows,
      totals: summary.totals,
      filename: `consume-wing-summary-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `consume-wing-summary-${month}.pdf`,
        "landscape",
        { skipInlineStyles: true },
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4 print:border-0 print:p-0">
      <div className="no-print">
        <PageHeader
          title={t("pages.consumeSummaryPrint.title")}
          subtitle={t("pages.consumeSummaryPrint.subtitle", {
            month: formatMonthLong(month),
          })}
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
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={!canAct}
                onClick={onDownload}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("consume.exportPdf")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="cta"
                className="rounded-lg"
                disabled={!canAct || printing}
                onClick={() => void onPrint()}
              >
                <IconPrinter className="h-3.5 w-3.5" />
                {printing ? t("common.loading") : t("mess.print")}
              </Button>
            </>
          }
        />
      </div>

      {!canAct ? (
        <EmptyState title={t("consume.wingSummaryEmpty")} />
      ) : (
        <WingSummaryPrint
          ref={printRef}
          month={month}
          tagCodes={summary.tagCodes}
          rows={summary.rows}
          totals={summary.totals}
          preview
        />
      )}
    </PagePane>
  );
}
