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
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import { formatMonthLong, monthKey } from "@/lib/date";
import {
  downloadLeaveMedBillPdf,
  downloadTagBillPdf,
} from "@/lib/download-consume-pdfs";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildLeaveMedBill,
  buildTagBill,
  withReportSource,
} from "@/lib/reports";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import type { DailyTag } from "@/lib/types";
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

  const { source, loading } = useReportSource({ month });

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
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
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
      if (!memberMatchesWingFilter(row.user.wing, wing)) return false;
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

  const tagWingBills = useMemo(
    () =>
      groupRowsByOfficialWing(tagRows).map((group) => ({
        ...group,
        rows: group.rows.map((row, i) => ({ ...row, sl: i + 1 })),
        totalDays: group.rows.reduce((s, r) => s + r.days, 0),
        totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
        totalFuel: group.rows.reduce((s, r) => s + r.fuelAmount, 0),
        grandTotal: group.rows.reduce((s, r) => s + r.grandTotal, 0),
      })),
    [tagRows],
  );

  const leaveWingBills = useMemo(
    () =>
      groupRowsByOfficialWing(leaveRows).map((group) => {
        const tagTotals: Partial<Record<DailyTag, number>> = {};
        for (const code of filterTags) {
          tagTotals[code] = group.rows.reduce(
            (s, r) => s + (r.tagDays[code] ?? 0),
            0,
          );
        }
        return {
          ...group,
          rows: group.rows.map((row, i) => ({ ...row, sl: i + 1 })),
          tagTotals,
          totalDays: group.rows.reduce((s, r) => s + r.totalDays, 0),
          totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
        };
      }),
    [leaveRows, filterTags],
  );

  const fuelOnly = filter === "fuel";
  const showFuel = Boolean(
    tagBill && (fuelOnly || tagBill.tags.includes("FR") || tagBill.fuelRate > 0),
  );
  const backHref = `/consume/monthly?month=${month}&tag=${filter}`;
  const canAct =
    filter === "leave-med" ? leaveRows.length > 0 : tagRows.length > 0;
  const rowCount = filter === "leave-med" ? leaveRows.length : tagRows.length;

  function onDownload() {
    if (!canAct) return;
    if (filter === "leave-med" && leaveBill) {
      downloadLeaveMedBillPdf({
        month,
        tags: filterTags,
        rows: leaveRows,
        tagTotals: {},
        totalDays: 0,
        totalAmount: 0,
        sections: leaveWingBills.map((group) => ({
          wingLabel: group.label,
          rows: group.rows,
          tagTotals: group.tagTotals,
          totalDays: group.totalDays,
          totalAmount: group.totalAmount,
        })),
        filename: `consume-bill-${month}-${filter}.pdf`,
      });
      return;
    }
    if (!tagBill) {
      void onPrint();
      return;
    }
    downloadTagBillPdf({
      month,
      tag: filterLabel,
      tagLabel: filterLabel,
      rows: tagRows,
      showFuel,
      totalDays: 0,
      totalAmount: 0,
      totalFuel: 0,
      grandTotal: 0,
      fuelOnly,
      sections: tagWingBills.map((group) => ({
        wingLabel: group.label,
        rows: group.rows,
        totalDays: group.totalDays,
        totalAmount: group.totalAmount,
        totalFuel: group.totalFuel,
        grandTotal: fuelOnly ? group.totalFuel : group.grandTotal,
      })),
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

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading")}</p>
      ) : !canAct ? (
        <EmptyState title={t("common.noResults")} />
      ) : filter === "leave-med" && leaveBill ? (
        <div ref={printRef} data-print-stack="true" className="flex flex-col gap-8">
          {leaveWingBills.map((group, index) => (
            <LeaveMedBillPrint
              key={group.id}
              month={month}
              tags={filterTags}
              rows={group.rows}
              tagTotals={group.tagTotals}
              totalDays={group.totalDays}
              totalAmount={group.totalAmount}
              rate={leaveBill.rate}
              wingLabel={group.label}
              pageBreak={index > 0}
              preview
            />
          ))}
        </div>
      ) : tagBill ? (
        <div ref={printRef} data-print-stack="true" className="flex flex-col gap-8">
          {tagWingBills.map((group, index) => (
            <TagBillPrint
              key={group.id}
              month={month}
              tag={fuelOnly ? "FR+MFR" : filterLabel}
              tagLabel={fuelOnly ? "FR+MFR" : filterLabel}
              rows={group.rows}
              totalDays={group.totalDays}
              totalAmount={group.totalAmount}
              totalFuel={group.totalFuel}
              grandTotal={fuelOnly ? group.totalFuel : group.grandTotal}
              showFuel={showFuel}
              fuelOnly={fuelOnly}
              wingLabel={group.label}
              pageBreak={index > 0}
              preview
            />
          ))}
        </div>
      ) : (
        <EmptyState title={t("pages.consumeTagBillPrint.subtitleMissing")} />
      )}
    </PagePane>
  );
}
