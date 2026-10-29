"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  CONSUME_REPORT_LEDGER_SOURCE_TAGS,
  CONSUME_REPORT_LEDGER_TAGS,
} from "@/lib/constants";
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import { formatMonthLong, monthKey } from "@/lib/date";
import { downloadConsumeLedgerPdf } from "@/lib/download-consume-ledger-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildMonthLedger,
  buildRangeLedger,
  presentConsumeLedger,
  withReportSource,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Shrink the letter into the pane so the preview never scrolls. */
function FitPagePreview({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return;

    const apply = () => {
      const prev = page.style.zoom;
      page.style.zoom = "1";
      const lw = page.offsetWidth;
      const lh = page.offsetHeight;
      page.style.zoom = prev;
      const fw = frame.clientWidth - 16;
      if (!lw || !lh || fw <= 0) return;
      const next = Math.min(fw / lw, 1);
      setZoom((z) => (Math.abs(z - next) < 0.002 ? z : next));
    };

    apply();
    const ro = new ResizeObserver(() => requestAnimationFrame(apply));
    ro.observe(frame);
    ro.observe(page);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={frameRef}
      className="flex min-h-0 w-full flex-1 justify-center overflow-auto"
    >
      <div ref={pageRef} className="shrink-0" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}

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
  const memberType = searchParams.get("member_type") ?? "all";
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

  const { source } = useReportSource(
    rangeBounds
      ? { from: rangeBounds.from, to: rangeBounds.to }
      : { month },
  );

  const ledger = useMemo(() => {
    return withReportSource(source, () => {
      if (rangeBounds) {
        const range = presentConsumeLedger(
          buildRangeLedger(
            rangeBounds.from,
            rangeBounds.to,
            CONSUME_REPORT_LEDGER_SOURCE_TAGS,
            { carry: true },
          ),
          CONSUME_REPORT_LEDGER_TAGS,
        );
        return {
          month,
          dayCount: range.dates.length,
          tagCodes: range.tagCodes,
          rows: range.rows,
          columnDates: range.dates,
        };
      }
      const monthLedger = presentConsumeLedger(
        buildMonthLedger(month, CONSUME_REPORT_LEDGER_SOURCE_TAGS, {
          carry: true,
        }),
        CONSUME_REPORT_LEDGER_TAGS,
      );
      return { ...monthLedger, columnDates: undefined as string[] | undefined };
    });
  }, [
    state.assignments,
    state.users,
    state.suppressed_carries,
    month,
    rangeBounds,
    source,
  ]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
      if (memberType !== "all" && row.user.member_type !== memberType) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing, memberType]);

  const backHref = useMemo(() => {
    const back = searchParams.get("back")?.trim();
    const params = new URLSearchParams();
    params.set("month", month);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (memberType !== "all") params.set("member_type", memberType);
    if (back?.startsWith("/ration/monthly")) {
      return `${back}${back.includes("?") ? "&" : "?"}${params.toString()}`;
    }
    return `/consume/monthly/ledger?${params.toString()}`;
  }, [month, dateFrom, dateTo, memberType, searchParams]);

  const wingLedgers = useMemo(
    () =>
      groupRowsByOfficialWing(rows, {
        separateNewMembers: memberType === "new",
      }),
    [rows, memberType],
  );

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
      sections: wingLedgers.map((group) => ({
        wingLabel: group.label,
        rows: group.rows,
      })),
      filename: `consume-ledger-${month}.pdf`,
      signEveryPage: true,
      totalEveryPage: true,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `consume-ledger-${month}.pdf`, "landscape", {
        skipInlineStyles: true,
        preserveColors: true,
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="h-[calc(100dvh-3.75rem)] max-h-[calc(100dvh-3.75rem)] min-h-0 gap-3 overflow-hidden !overflow-hidden">
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
        <FitPagePreview>
          <div ref={printRef} data-print-stack="true" className="flex flex-col gap-6">
            {wingLedgers.map((group, index) => (
              <MonthLedgerPrint
                key={group.id}
                month={month}
                dayCount={ledger.dayCount}
                tagCodes={ledger.tagCodes}
                rows={group.rows}
                columnDates={ledger.columnDates}
                wingTitle={group.label}
                pageBreak={index > 0}
                preview
                reportLang="en"
                showSrbNo
                signEveryPage
                totalEveryPage
              />
            ))}
          </div>
        </FitPagePreview>
      )}
    </PagePane>
  );
}
