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
import { useDailyCockpit } from "@/hooks/use-daily-cockpit";
import { useStore } from "@/hooks/use-store";
import { isDailyApiEnabled } from "@/lib/api/mode";
import {
  dateInMonth,
  daysInMonth,
  eachISODate,
  formatMonthLong,
  parseMonthInput,
} from "@/lib/date";
import { downloadDailyRegisterPdf } from "@/lib/download-daily-register-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildDailyRegisterDates,
  buildDailyRegisterFromCells,
} from "@/lib/reports";
import { compareUsers, isCockpitMember } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function DailyRegisterPrintClient() {
  const t = useT();
  const apiOn = isDailyApiEnabled();
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
  const statusParam = searchParams.get("status");
  const memberStatus: "all" | "0" | "1" =
    statusParam === "0" || statusParam === "1" || statusParam === "all"
      ? statusParam
      : "1";
  const dayCount = daysInMonth(month);
  const loadFrom = dateFrom.trim() || dateInMonth(month, 1);
  const loadTo = dateTo.trim() || dateInMonth(month, dayCount);

  const cockpit = useDailyCockpit({
    dateFrom: loadFrom,
    dateTo: loadTo,
    q,
    rank,
    wing,
    status: memberStatus,
  });

  /** Approved roster — honor status filter (default Active). */
  const demoUsers = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (!isCockpitMember(u)) return false;
        if (u.approval_status !== "approved") return false;
        if (memberStatus !== "all" && u.status !== memberStatus) return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, q, rank, wing, memberStatus]);

  const users = apiOn ? cockpit.users : demoUsers;
  const loading = apiOn && cockpit.loading;

  const columnDates = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (from && to) return eachISODate(from, to);
    if (from) return [from];
    if (to) return [to];
    return Array.from({ length: dayCount }, (_, i) =>
      dateInMonth(month, i + 1),
    );
  }, [month, dayCount, dateFrom, dateTo]);

  const dayNumbers = useMemo(
    () => columnDates.map((d) => Number(d.slice(8, 10))),
    [columnDates],
  );

  const printRows = useMemo(() => {
    if (apiOn) {
      return buildDailyRegisterFromCells(columnDates, users, cockpit.cells).rows;
    }
    return buildDailyRegisterDates(columnDates, users).rows;
  }, [apiOn, columnDates, users, cockpit.cells, state.assignments]);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    return `/daily/tags?${params.toString()}`;
  }, [month, dateFrom, dateTo, q, rank, wing]);

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
        { preserveColors: true, skipInlineStyles: true },
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
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={backHref}>
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
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
                className="rounded-xl"
                disabled={!canAct || printing}
                onClick={() => void onPrint()}
              >
                <IconPrinter className="h-4 w-4" />
                {printing ? t("common.loading") : t("mess.print")}
              </Button>
            </>
          }
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          {t("common.loading")}
        </p>
      ) : !users.length ? (
        <EmptyState title={t("daily.emptyTags")} />
      ) : !dayNumbers.length ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <MonthRegisterPrint
          ref={printRef}
          month={month}
          dayNumbers={dayNumbers}
          rows={printRows}
          preview
        />
      )}
    </PagePane>
  );
}
