"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { OfficialConsumeLetter } from "@/components/consume/official-consume-letter";
import { Button } from "@/components/ui/button";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  buildOfficialConsumePack,
  officialSheetOrientation,
  parseOfficialSheet,
} from "@/lib/consume-official-reports";
import { withReportSource } from "@/lib/reports";
import { formatMonthLong, monthKey } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
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
  const sheet = parseOfficialSheet(searchParams.get("sheet"));

  const { source } = useReportSource({ month });
  const pack = useMemo(
    () =>
      withReportSource(source, () => buildOfficialConsumePack(month, sheet)),
    [state.assignments, state.users, state.rates, month, sheet, source],
  );

  const backHref = `/consume/monthly/summary?month=${month}&sheet=${sheet}`;

  async function onPrint() {
    const el = printRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `consume-${sheet}-${month}.pdf`,
        officialSheetOrientation(sheet),
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
            <Button
              type="button"
              size="sm"
              variant="cta"
              className="rounded-lg"
              disabled={printing}
              onClick={() => void onPrint()}
            >
              <IconPrinter className="h-3.5 w-3.5" />
              {printing ? t("common.loading") : t("mess.print")}
            </Button>
          }
        />
      </div>

      <OfficialConsumeLetter ref={printRef} pack={pack} preview />
    </PagePane>
  );
}
