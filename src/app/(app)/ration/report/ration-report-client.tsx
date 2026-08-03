"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { RationTabs } from "@/components/layout/ration-tabs";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import {
  parseMonthInput,
  monthKey,
  shiftMonthKey,
} from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import {
  buildRationReportClean,
  buildRationStaffLines,
  buildRationTransferLines,
  formatBdt,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

const fieldClass =
  "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

export default function RationReportClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawMonth = searchParams.get("month");
  const defaultMonth = monthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth)
      ? parseMonthInput(rawMonth)
      : defaultMonth;

  useEffect(() => {
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", defaultMonth);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, pathname, router, searchParams]);

  const report = useMemo(
    () => buildRationReportClean(month),
    [state.assignments, state.users, state.senders, state.rates, month],
  );

  const staffSheets = useMemo(
    () => buildRationStaffLines(month),
    [state.assignments, state.users, state.senders, state.rates, month],
  );

  const transferSheets = useMemo(
    () => buildRationTransferLines(month),
    [state.assignments, state.users, state.senders, state.rates, month],
  );

  const staffLineCount = staffSheets.reduce((n, s) => n + s.lines.length, 0);
  const missingBankCount = staffSheets.reduce(
    (n, s) => n + s.lines.filter((l) => l.missingBank).length,
    0,
  );
  const monthQuery = `?month=${month}`;

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function exportStaffAll() {
    const rows: string[][] = [
      [
        t("ration.fromAccount"),
        t("ration.colSer"),
        t("ration.colPersNo"),
        t("ration.colRank"),
        t("ration.colName"),
        t("ration.colAcct"),
        t("ration.colRouting"),
        t("ration.colBank"),
        t("ration.colAmount"),
        t("ration.colRemarks"),
      ],
    ];
    for (const sheet of staffSheets) {
      for (const line of sheet.lines) {
        rows.push([
          sheet.sender.label,
          String(line.ser),
          line.user.rab_id,
          line.user.rank,
          line.user.name,
          line.user.account_number || "",
          line.user.routing || "",
          line.user.bank_name || "",
          String(line.amount),
          line.remarks || (line.missingBank ? t("ration.missingBank") : ""),
        ]);
      }
    }
    downloadCsv(`ration-staff-${month}.csv`, rows);
  }

  function exportTransferAll() {
    const rows: string[][] = [
      [
        t("ration.fromAccount"),
        t("ration.colSer"),
        t("ration.colDate"),
        t("ration.colRefNo"),
        t("ration.colSenderAcct"),
        t("ration.colReceiverRouting"),
        t("ration.colSenderRouting"),
        t("ration.colType"),
        t("ration.colCustomerName"),
        t("ration.colCustomerAcct"),
        t("ration.colAmount"),
        t("ration.colInstitute"),
        t("ration.colEntryDesc"),
        t("ration.colPaymentInfo"),
        t("ration.colCurrency"),
      ],
    ];
    for (const sheet of transferSheets) {
      for (const line of sheet.lines) {
        rows.push([
          sheet.sender.label,
          String(line.ser),
          line.date,
          line.refNo,
          line.senderAccountNo,
          line.receiverRouting,
          line.senderRouting,
          line.type,
          line.customerAccountName,
          line.customerAccountNo,
          String(line.amount),
          line.institute,
          line.entryDescription,
          line.paymentInfo,
          line.currency,
        ]);
      }
    }
    downloadCsv(`ration-transfer-${month}.csv`, rows);
  }

  function exportStaffSender(senderId: string) {
    const sheet = staffSheets.find((s) => s.sender.id === senderId);
    if (!sheet) return;
    const rows: string[][] = [
      [
        t("ration.colSer"),
        t("ration.colPersNo"),
        t("ration.colRank"),
        t("ration.colName"),
        t("ration.colAcct"),
        t("ration.colRouting"),
        t("ration.colBank"),
        t("ration.colAmount"),
        t("ration.colRemarks"),
      ],
      ...sheet.lines.map((line) => [
        String(line.ser),
        line.user.rab_id,
        line.user.rank,
        line.user.name,
        line.user.account_number || "",
        line.user.routing || "",
        line.user.bank_name || "",
        String(line.amount),
        line.remarks || (line.missingBank ? t("ration.missingBank") : ""),
      ]),
    ];
    downloadCsv(`ration-staff-${month}-${senderId}.csv`, rows);
  }

  const noSenders = state.senders.length === 0;
  const onlyUnmapped =
    !staffLineCount && report.unmapped.length > 0 && !noSenders;
  const noEligible =
    !staffLineCount && report.unmapped.length === 0 && !noSenders;

  return (
    <PagePane className="gap-5">
      <PageHeader
        title={t("pages.rationReport.title")}
        subtitle={t("pages.rationReport.subtitle", { month })}
        center={<RationTabs />}
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label={t("ration.prevMonth")}
                onClick={() => setMonth(shiftMonthKey(month, -1))}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative w-[11rem] shrink-0">
                <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label={t("ration.month")}
                  className={cn(fieldClass, "h-9 w-[11rem] pl-8")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label={t("ration.nextMonth")}
                onClick={() => setMonth(shiftMonthKey(month, 1))}
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={exportStaffAll}
              disabled={!staffLineCount}
            >
              <IconDownload className="h-3.5 w-3.5" />
              {t("ration.exportStaffCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={exportTransferAll}
              disabled={!staffLineCount}
            >
              <IconDownload className="h-3.5 w-3.5" />
              {t("ration.exportTransferCsv")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip
          label={t("ration.grandTotal")}
          value={formatBdt(report.total)}
          accent
        />
        <StatChip
          label={t("ration.bySender")}
          value={String(staffSheets.length)}
        />
        <StatChip
          label={t("consume.statMembers")}
          value={String(staffLineCount)}
        />
        <StatChip
          label={t("ration.missingBank")}
          value={String(missingBankCount)}
        />
      </div>

      {noSenders ? (
        <EmptyState
          title={t("ration.emptySenders")}
          action={
            <Button asChild variant="cta" className="rounded-xl">
              <Link href="/settings">{t("ration.openSenders")}</Link>
            </Button>
          }
        />
      ) : null}

      {onlyUnmapped ? (
        <EmptyState
          title={t("ration.emptyAllUnmapped")}
          action={
            <Button asChild variant="cta" className="rounded-xl">
              <Link href="/settings">{t("ration.openSenders")}</Link>
            </Button>
          }
        />
      ) : null}

      {noEligible ? <EmptyState title={t("ration.emptyNoEligible")} /> : null}

      {!noSenders && staffSheets.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t("ration.bySender")}
            </span>
            <span className="text-[11px] text-neutral-400">
              {t("ration.openSender")}
            </span>
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {staffSheets.map((sheet) => (
              <li
                key={sheet.sender.id}
                className="flex items-stretch gap-1 px-2 py-1.5 sm:px-3"
              >
                <Link
                  href={`/ration/report/sender/${sheet.sender.id}${monthQuery}`}
                  className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-primary/[0.04] sm:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem] dark:hover:bg-primary/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                      {sheet.sender.label}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {sheet.sender.bank_name} · {sheet.sender.account_number}
                    </p>
                    <p className="truncate text-[10px] text-neutral-400">
                      tags: {sheet.sender.mapped_tags.join(", ")}
                    </p>
                  </div>
                  <p className="text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
                    {sheet.lines.length}
                    <span className="ml-1 text-[10px] uppercase text-neutral-400">
                      {t("consume.users")}
                    </span>
                  </p>
                  <p className="hidden text-right text-sm tabular-nums text-neutral-600 sm:block dark:text-neutral-300">
                    {sheet.sender.mapped_tags.length}
                    <span className="ml-1 text-[10px] uppercase text-neutral-400">
                      tag
                    </span>
                  </p>
                  <p className="text-right text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {formatBdt(sheet.total)}
                  </p>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="my-auto h-9 shrink-0 rounded-xl px-2.5"
                  aria-label={`${t("ration.exportStaffCsv")} ${sheet.sender.label}`}
                  title={t("ration.exportStaffCsv")}
                  onClick={() => exportStaffSender(sheet.sender.id)}
                  disabled={!sheet.lines.length}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {t("ration.exportCsv")}
                  </span>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="my-auto h-9 shrink-0 rounded-xl border-primary/30 bg-primary/[0.06] px-2.5 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Link
                    href={`/ration/report/sender/${sheet.sender.id}${monthQuery}`}
                    aria-label={t("ration.openSender")}
                    title={t("ration.openSender")}
                  >
                    <IconEye className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {t("ration.openSender")}
                    </span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t-2 border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/80">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {t("ration.grandTotal")}
            </p>
            <p className="text-base font-semibold tabular-nums text-primary">
              {formatBdt(report.total)}
            </p>
          </div>
        </section>
      ) : null}

      {report.unmapped.length > 0 ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("ration.unmapped")}
          </h2>
          <ul className="space-y-1 text-sm text-amber-900/80 dark:text-amber-100/80">
            {report.unmapped.map((line) => (
              <li key={`${line.user.id}-${line.tag}`}>
                {line.user.name} · {line.tag} · {line.days}d ·{" "}
                {formatBdt(line.amount)}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
            <Link href="/settings">{t("ration.openSenders")}</Link>
          </Button>
        </section>
      ) : null}
    </PagePane>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
