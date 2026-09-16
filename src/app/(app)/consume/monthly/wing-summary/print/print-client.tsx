"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { WingFoodListPrint } from "@/components/consume/wing-food-list-print";
import { Button } from "@/components/ui/button";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import { buildWingFoodList } from "@/lib/consume-official-reports";
import { formatMonthLong, monthKey } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { withReportSource } from "@/lib/reports";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeWingSummaryPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const wing = (searchParams.get("wing") ?? "").trim();
  const back = searchParams.get("back") ?? `/consume/monthly/ledger?month=${month}`;

  const { source } = useReportSource({ month });
  const table = useMemo(
    () =>
      wing
        ? withReportSource(source, () => buildWingFoodList(month, wing))
        : null,
    [state.assignments, state.users, state.rates, month, wing, source],
  );

  async function onPrint() {
    const el = printRef.current;
    if (!el || !table) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `consume-wing-${month}.pdf`, "portrait", {
        skipInlineStyles: true,
        preserveColors: true,
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4 print:border-0 print:p-0">
      <div className="no-print">
        <PageHeader
          title={t("pages.consumeWingSummaryPrint.title")}
          subtitle={t("pages.consumeWingSummaryPrint.subtitle", {
            month: formatMonthLong(month),
            wing,
          })}
          leading={
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label={t("common.back")}
            >
              <Link href={back}>
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
              disabled={!table?.rows.length || printing}
              onClick={() => void onPrint()}
            >
              <IconPrinter className="h-3.5 w-3.5" />
              {printing ? t("common.loading") : t("mess.print")}
            </Button>
          }
        />
      </div>

      {!wing || !table || table.rows.length === 0 ? (
        <EmptyState title={t("consume.wingSummaryEmpty")} />
      ) : (
        <WingFoodListPrint ref={printRef} table={table} preview />
      )}
    </PagePane>
  );
}
