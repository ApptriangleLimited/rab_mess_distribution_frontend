"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ledgerRowApiToLedgerRow, listMessLedger } from "@/lib/api/mess";
import { isApiEnabled } from "@/lib/api/mode";
import { MESS_LEDGER_TAGS } from "@/lib/constants";
import { formatMonthLong, monthDateBounds, monthKey } from "@/lib/date";
import { downloadConsumeLedgerPdf } from "@/lib/download-consume-ledger-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { buildRangeLedger, type LedgerRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function MessLedgerPrintClient() {
  const t = useT();
  const apiOn = isApiEnabled();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiLedger, setApiLedger] = useState<{
    rows: LedgerRow[];
    dayCount: number;
    tagCodes: DailyTag[];
    columnDates?: string[];
  } | null>(null);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const rangeBounds = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (from && to) {
      return from <= to ? { from, to } : { from: to, to: from };
    }
    if (from || to) {
      const only = from || to;
      return { from: only, to: only };
    }
    const bounds = monthDateBounds(month);
    return { from: bounds.from, to: bounds.to };
  }, [dateFrom, dateTo, month]);

  useEffect(() => {
    if (!apiOn) return;
    let cancelled = false;
    setLoading(true);
    void listMessLedger(rangeBounds.from, rangeBounds.to)
      .then((res) => {
        if (cancelled) return;
        setApiLedger({
          rows: res.rows.map(ledgerRowApiToLedgerRow),
          dayCount: res.dates.length,
          tagCodes: [...MESS_LEDGER_TAGS],
          columnDates: res.dates,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setApiLedger({
          rows: [],
          dayCount: 0,
          tagCodes: [...MESS_LEDGER_TAGS],
          columnDates: [],
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, rangeBounds]);

  const demoLedger = useMemo(() => {
    const range = buildRangeLedger(
      rangeBounds.from,
      rangeBounds.to,
      MESS_LEDGER_TAGS,
      { carry: true, previewFuture: true },
    );
    return {
      month,
      dayCount: range.dates.length,
      tagCodes: range.tagCodes,
      rows: range.rows,
      columnDates: range.dates,
    };
  }, [
    state.assignments,
    state.users,
    state.suppressed_carries,
    month,
    rangeBounds,
  ]);

  const ledger = apiOn
    ? {
        month,
        dayCount: apiLedger?.dayCount ?? 0,
        tagCodes: apiLedger?.tagCodes ?? [...MESS_LEDGER_TAGS],
        rows: apiLedger?.rows ?? [],
        columnDates: apiLedger?.columnDates,
      }
    : demoLedger;

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.personal_id, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing]);

  const backHref = `/mess/ledger?month=${month}`;
  const canAct = rows.length > 0;

  function onDownload() {
    if (!canAct) return;
    downloadConsumeLedgerPdf({
      month,
      dayCount: ledger.dayCount,
      tagCodes: ledger.tagCodes,
      rows,
      columnDates: ledger.columnDates,
      filename: `mess-ledger-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `mess-ledger-${month}.pdf`, "landscape", {
        skipInlineStyles: true,
        preserveColors: true,
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.messLedgerPrint.title")}
          subtitle={t("pages.messLedgerPrint.subtitle", {
            month: formatMonthLong(month),
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

      {!loading && !canAct ? (
        <EmptyState title={t("common.noResults")} />
      ) : loading ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          {t("common.loading")}
        </p>
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
