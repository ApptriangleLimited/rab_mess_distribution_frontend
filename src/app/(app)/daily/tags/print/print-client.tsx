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
import { MonthRegisterPrint } from "@/components/daily/month-register-print";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import {
  dateInMonth,
  daysInMonth,
  formatMonthLong,
  parseMonthInput,
} from "@/lib/date";
import { downloadDailyRegisterPdf } from "@/lib/download-daily-register-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { buildDailyRegister, sliceRegisterRows } from "@/lib/reports";
import { compareUsers } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function DailyRegisterPrintClient() {
  const t = useT();
  const state = useStore();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const month = parseMonthInput(searchParams.get("month") ?? "");
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const q = searchParams.get("q") ?? "";
  const rank = searchParams.get("rank") ?? "all";
  const wing = searchParams.get("wing") ?? "all";
  const showInactive = searchParams.get("inactive") === "1";

  const dayCount = daysInMonth(month);

  const users = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (u.approval_status !== "approved") return false;
        if (!showInactive && u.status !== "1") return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, showInactive, q, rank, wing]);

  const dayNumbers = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    const out: number[] = [];
    for (let d = 1; d <= dayCount; d++) {
      const date = dateInMonth(month, d);
      if (from && date < from) continue;
      if (to && date > to) continue;
      out.push(d);
    }
    return out;
  }, [month, dayCount, dateFrom, dateTo]);

  const register = useMemo(
    () => buildDailyRegister(month, users),
    [month, users, state.assignments],
  );

  const printRows = useMemo(
    () => sliceRegisterRows(register.rows, dayNumbers),
    [register.rows, dayNumbers],
  );

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    return `/daily/tags?${params.toString()}`;
  }, [month]);

  const monthLabel = formatMonthLong(month);
  const canAct = printRows.length > 0 && dayNumbers.length > 0;

  function onDownload() {
    if (!canAct) return;
    downloadDailyRegisterPdf({
      month,
      dayNumbers,
      rows: printRows,
      filename: `attendance-register-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `attendance-register-${month}.pdf`,
        "landscape",
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.dailyRegisterPrint.title")}
          subtitle={t("pages.dailyRegisterPrint.subtitle", {
            month: monthLabel,
            count: printRows.length,
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
                {t("daily.exportPdf")}
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

      {!users.length ? (
        <EmptyState title={t("daily.emptyTags")} />
      ) : !dayNumbers.length ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <div className="overflow-x-auto">
          <MonthRegisterPrint
            ref={printRef}
            month={month}
            dayNumbers={dayNumbers}
            rows={printRows}
            preview
          />
        </div>
      )}
    </PagePane>
  );
}
