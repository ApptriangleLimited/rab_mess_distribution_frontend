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
import { MESS_LEDGER_TAGS } from "@/lib/constants";
import {
  dateInMonth,
  daysInMonth,
  formatMonthLong,
  monthKey,
} from "@/lib/date";
import { downloadConsumeLedgerPdf } from "@/lib/download-consume-ledger-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { buildMonthLedger, type LedgerRow } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

function narrowRowsToDays(rows: LedgerRow[], days: number[]): LedgerRow[] {
  if (!days.length) return rows;
  const daySet = new Set(days);
  return rows
    .map((row) => {
      const counts: Partial<Record<DailyTag, number>> = {};
      let totalDays = 0;
      for (const d of daySet) {
        const tag = row.days[d - 1];
        if (!tag) continue;
        counts[tag] = (counts[tag] ?? 0) + 1;
        totalDays += 1;
      }
      return { ...row, tagCounts: counts, totalDays };
    })
    .filter((row) => row.totalDays > 0);
}

export default function MessLedgerPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const dayCount = daysInMonth(month);
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const ledger = useMemo(
    () => buildMonthLedger(month, MESS_LEDGER_TAGS),
    [state.assignments, state.users, month],
  );

  const visibleDays = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (!from && !to) return undefined;
    const out: number[] = [];
    for (let d = 1; d <= dayCount; d++) {
      const date = dateInMonth(month, d);
      if (from && !to && date !== from) continue;
      if (!from && to && date !== to) continue;
      if (from && to) {
        const a = from <= to ? from : to;
        const b = from <= to ? to : from;
        if (date < a || date > b) continue;
      }
      out.push(d);
    }
    return out;
  }, [month, dayCount, dateFrom, dateTo]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    if (visibleDays?.length) {
      list = narrowRowsToDays(list, visibleDays);
    }
    return list;
  }, [ledger.rows, q, rank, wing, visibleDays]);

  const backHref = `/mess/ledger?month=${month}`;
  const canAct = rows.length > 0;

  function onDownload() {
    if (!canAct) return;
    downloadConsumeLedgerPdf({
      month,
      dayCount: ledger.dayCount,
      tagCodes: ledger.tagCodes,
      rows,
      visibleDays,
      filename: `mess-ledger-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `mess-ledger-${month}.pdf`, "landscape");
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
            visibleDays={visibleDays}
            preview
          />
        </div>
      )}
    </PagePane>
  );
}
