"use client";

import { useMemo } from "react";
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
import { TagBillPrint } from "@/components/consume/tag-bill-print";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatMonthLong, monthKey } from "@/lib/date";
import { downloadTagBillPdf } from "@/lib/download-consume-pdfs";
import { buildTagBill } from "@/lib/reports";
import { isKnownTag } from "@/lib/store/rates";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeTagBillPrintClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const searchParams = useSearchParams();

  const rawMonth = searchParams.get("month");
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthKey();
  const rawTag = searchParams.get("tag") ?? "";
  const tag = isKnownTag(rawTag) ? (rawTag as DailyTag) : null;
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";

  const bill = useMemo(
    () => (tag ? buildTagBill(month, tag) : null),
    [state.assignments, state.users, state.rates, month, tag],
  );

  const rows = useMemo(() => {
    if (!bill) return [];
    const query = q.trim().toLowerCase();
    return bill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bill, q, rank, wing]);

  const filteredDays = useMemo(
    () => rows.reduce((s, r) => s + r.days, 0),
    [rows],
  );
  const filteredAmount = useMemo(
    () => rows.reduce((s, r) => s + r.amount, 0),
    [rows],
  );
  const filteredFuel = useMemo(
    () => rows.reduce((s, r) => s + r.fuelAmount, 0),
    [rows],
  );
  const filteredGrand = useMemo(
    () => rows.reduce((s, r) => s + r.grandTotal, 0),
    [rows],
  );

  const label = tag ? tagLabel(tag, locale) : "";
  const showFuel = Boolean(tag === "FR" || (bill && bill.fuelRate > 0));
  const backHref = tag
    ? `/consume/monthly?month=${month}&tag=${tag}`
    : `/consume/monthly?month=${month}`;
  const canAct = Boolean(tag && rows.length);

  function onDownload() {
    if (!tag || !canAct) return;
    downloadTagBillPdf({
      month,
      tag,
      tagLabel: label,
      rows,
      showFuel,
      totalDays: filteredDays,
      totalAmount: filteredAmount,
      totalFuel: filteredFuel,
      grandTotal: filteredGrand,
      filename: `consume-bill-${month}-${tag}.pdf`,
    });
  }

  return (
    <PagePane className="gap-4 print:border-0 print:p-0">
      <div className="no-print">
        <PageHeader
          title={t("pages.consumeTagBillPrint.title")}
          subtitle={
            tag
              ? t("pages.consumeTagBillPrint.subtitle", {
                  month: formatMonthLong(month),
                  tag,
                  label,
                  count: rows.length,
                })
              : t("pages.consumeTagBillPrint.subtitleMissing")
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
                disabled={!canAct}
                onClick={() => window.print()}
              >
                <IconPrinter className="h-3.5 w-3.5" />
                {t("consume.printBill")}
              </Button>
            </>
          }
        />
      </div>

      {!tag ? (
        <EmptyState title={t("pages.consumeTagBillPrint.subtitleMissing")} />
      ) : !canAct ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <TagBillPrint
          month={month}
          tag={tag}
          tagLabel={label}
          rows={rows}
          totalDays={filteredDays}
          totalAmount={filteredAmount}
          totalFuel={filteredFuel}
          grandTotal={filteredGrand}
          showFuel={showFuel}
          preview
        />
      )}
    </PagePane>
  );
}
