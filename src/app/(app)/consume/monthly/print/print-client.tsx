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
import { LeaveMedBillPrint } from "@/components/consume/leave-med-bill-print";
import { TagBillPrint } from "@/components/consume/tag-bill-print";
import { Button } from "@/components/ui/button";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  CONSUME_FILTER_TAGS,
  consumeFilterLabel,
  parseConsumeFilter,
} from "@/lib/consume-filters";
import { formatMonthLong, monthKey } from "@/lib/date";
import { downloadTagBillPdf } from "@/lib/download-consume-pdfs";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildLeaveMedBill,
  buildTagBill,
  withReportSource,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeTagBillPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const filter = parseConsumeFilter(searchParams.get("tag"));
  const filterTags = CONSUME_FILTER_TAGS[filter];
  const filterLabel = consumeFilterLabel(filter);
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";

  const { source } = useReportSource({ month });

  const tagBill = useMemo(
    () =>
      filter === "leave-med"
        ? null
        : withReportSource(source, () => buildTagBill(month, filterTags)),
    [state.assignments, state.users, state.rates, month, filter, filterTags, source],
  );

  const leaveBill = useMemo(
    () =>
      filter === "leave-med"
        ? withReportSource(source, () => buildLeaveMedBill(month, filterTags))
        : null,
    [state.assignments, state.users, state.rates, month, filter, filterTags, source],
  );

  const tagRows = useMemo(() => {
    if (!tagBill) return [];
    const query = q.trim().toLowerCase();
    return tagBill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [
        row.user.name,
        row.user.personal_id,
        row.user.rab_id,
        row.user.wing,
        row.user.rank,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [tagBill, q, rank, wing]);

  const leaveRows = useMemo(() => {
    if (!leaveBill) return [];
    const query = q.trim().toLowerCase();
    return leaveBill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [
        row.user.name,
        row.user.personal_id,
        row.user.rab_id,
        row.user.wing,
        row.user.rank,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [leaveBill, q, rank, wing]);

  const filteredDays = useMemo(
    () => tagRows.reduce((s, r) => s + r.days, 0),
    [tagRows],
  );
  const filteredAmount = useMemo(
    () => tagRows.reduce((s, r) => s + r.amount, 0),
    [tagRows],
  );
  const filteredFuel = useMemo(
    () => tagRows.reduce((s, r) => s + r.fuelAmount, 0),
    [tagRows],
  );
  const filteredGrand = useMemo(
    () => tagRows.reduce((s, r) => s + r.grandTotal, 0),
    [tagRows],
  );

  const leaveDays = useMemo(
    () => leaveRows.reduce((s, r) => s + r.totalDays, 0),
    [leaveRows],
  );
  const leaveAmount = useMemo(
    () => leaveRows.reduce((s, r) => s + r.amount, 0),
    [leaveRows],
  );
  const leaveTagTotals = useMemo(() => {
    const next: Partial<Record<string, number>> = {};
    for (const code of filterTags) {
      next[code] = leaveRows.reduce((s, r) => s + (r.tagDays[code] ?? 0), 0);
    }
    return next;
  }, [leaveRows, filterTags]);

  const showFuel = Boolean(tagBill && (tagBill.tags.includes("FR") || tagBill.fuelRate > 0));
  const backHref = `/consume/monthly?month=${month}&tag=${filter}`;
  const canAct =
    filter === "leave-med" ? leaveRows.length > 0 : tagRows.length > 0;
  const rowCount = filter === "leave-med" ? leaveRows.length : tagRows.length;

  function onDownload() {
    if (!canAct || filter === "leave-med" || !tagBill) {
      void onPrint();
      return;
    }
    downloadTagBillPdf({
      month,
      tag: filterLabel,
      tagLabel: filterLabel,
      rows: tagRows,
      showFuel,
      totalDays: filteredDays,
      totalAmount: filteredAmount,
      totalFuel: filteredFuel,
      grandTotal: filteredGrand,
      filename: `consume-bill-${month}-${filter}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `consume-bill-${month}-${filter}.pdf`, "portrait", {
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
          title={t("pages.consumeTagBillPrint.title")}
          subtitle={t("pages.consumeTagBillPrint.subtitle", {
            month: formatMonthLong(month),
            tag: filterLabel,
            label: filterLabel,
            count: rowCount,
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
                {printing ? t("common.loading") : t("consume.printBill")}
              </Button>
            </>
          }
        />
      </div>

      {!canAct ? (
        <EmptyState title={t("common.noResults")} />
      ) : filter === "leave-med" && leaveBill ? (
        <LeaveMedBillPrint
          ref={printRef}
          month={month}
          tags={filterTags}
          rows={leaveRows}
          tagTotals={leaveTagTotals}
          totalDays={leaveDays}
          totalAmount={leaveAmount}
          rate={leaveBill.rate}
          preview
        />
      ) : tagBill ? (
        <TagBillPrint
          ref={printRef}
          month={month}
          tag={filterLabel}
          tagLabel={filterLabel}
          rows={tagRows}
          totalDays={filteredDays}
          totalAmount={filteredAmount}
          totalFuel={filteredFuel}
          grandTotal={filteredGrand}
          showFuel={showFuel}
          preview
        />
      ) : (
        <EmptyState title={t("pages.consumeTagBillPrint.subtitleMissing")} />
      )}
    </PagePane>
  );
}
