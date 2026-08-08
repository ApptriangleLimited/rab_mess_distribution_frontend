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
import { MonthLedgerPrint } from "@/components/consume/month-ledger-print";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatMonthLong, monthKey } from "@/lib/date";
import { downloadConsumeLedgerPdf } from "@/lib/download-consume-ledger-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { buildMonthLedger, buildRangeLedger } from "@/lib/reports";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function ConsumeLedgerPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const rangeBounds = useMemo(() => {
    if (DATE_RE.test(dateFrom) && DATE_RE.test(dateTo)) {
      return dateFrom <= dateTo
        ? { from: dateFrom, to: dateTo }
        : { from: dateTo, to: dateFrom };
    }
    if (DATE_RE.test(dateFrom) || DATE_RE.test(dateTo)) {
      const only = DATE_RE.test(dateFrom) ? dateFrom : dateTo;
      return { from: only, to: only };
    }
    return null;
  }, [dateFrom, dateTo]);

  const ledger = useMemo(() => {
    if (rangeBounds) {
      const range = buildRangeLedger(
        rangeBounds.from,
        rangeBounds.to,
        undefined,
        { carry: true },
      );
      return {
        month,
        dayCount: range.dates.length,
        tagCodes: range.tagCodes,
        rows: range.rows,
        columnDates: range.dates,
      };
    }
    const monthLedger = buildMonthLedger(month, undefined, { carry: true });
    return { ...monthLedger, columnDates: undefined as string[] | undefined };
  }, [
    state.assignments,
    state.users,
    state.suppressed_carries,
    month,
    rangeBounds,
  ]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing]);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return `/consume/monthly/ledger?${params.toString()}`;
  }, [month, dateFrom, dateTo]);

  const canAct = rows.length > 0;
  const rangeLabel = rangeBounds
    ? `${rangeBounds.from} → ${rangeBounds.to}`
    : formatMonthLong(month);

  function onDownload() {
    if (!canAct) return;
    downloadConsumeLedgerPdf({
      month,
      dayCount: ledger.dayCount,
      tagCodes: ledger.tagCodes,
      rows,
      columnDates: ledger.columnDates,
      filename: `consume-ledger-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `consume-ledger-${month}.pdf`, "landscape");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.consumeLedgerPrint.title")}
          subtitle={t("pages.consumeLedgerPrint.subtitle", {
            month: rangeLabel,
            count: rows.length,
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
                {t("mess.print")}
              </Button>
            </>
          }
        />
      </div>

      {!canAct ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <div className="overflow-x-auto">
          <MonthLedgerPrint
            ref={printRef}
            month={month}
            dayCount={ledger.dayCount}
            tagCodes={ledger.tagCodes}
            rows={rows}
            columnDates={ledger.columnDates}
            preview
          />
        </div>
      )}
    </PagePane>
  );
}
