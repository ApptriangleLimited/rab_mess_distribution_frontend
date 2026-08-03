"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconArrowLeft,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPrinter,
  IconSearch,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { StaffPayoutPrint } from "@/components/ration/staff-payout-print";
import { TransferSheetPrint } from "@/components/ration/transfer-sheet-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { RANKS } from "@/lib/constants";
import {
  parseMonthInput,
  previousMonthKey,
  shiftMonthKey,
} from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import {
  buildRationStaffLines,
  buildRationTransferLines,
  formatBdt,
} from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

const fieldClass =
  "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

type PrintKind = "staff" | "transfer";

export default function RationSenderReportClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const senderId = Array.isArray(params.senderId)
    ? params.senderId[0]
    : params.senderId;

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [printKind, setPrintKind] = useState<PrintKind>("staff");

  const rawMonth = searchParams.get("month");
  const defaultMonth = previousMonthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth)
      ? parseMonthInput(rawMonth)
      : defaultMonth;

  useEffect(() => {
    if (!senderId) {
      router.replace(`/ration/report?month=${defaultMonth}`);
      return;
    }
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", defaultMonth);
    router.replace(`${pathname}?${next.toString()}`);
  }, [senderId, rawMonth, defaultMonth, pathname, router, searchParams]);

  const staffSheet = useMemo(() => {
    if (!senderId) return null;
    return buildRationStaffLines(month, senderId)[0] ?? null;
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    senderId,
  ]);

  const transferSheet = useMemo(() => {
    if (!senderId) return null;
    return buildRationTransferLines(month, senderId)[0] ?? null;
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    senderId,
  ]);

  const members = useMemo(() => {
    if (!staffSheet) return [];
    const query = q.trim().toLowerCase();
    return staffSheet.lines.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (!query) return true;
      return [
        row.user.name,
        row.user.rab_id,
        row.user.account_number,
        row.user.bank_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [staffSheet, q, rank]);

  const missingBankCount =
    staffSheet?.lines.filter((l) => l.missingBank).length ?? 0;

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function printAs(kind: PrintKind) {
    flushSync(() => setPrintKind(kind));
    window.print();
  }

  function onExportStaff() {
    if (!staffSheet) return;
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
      ...staffSheet.lines.map((line) => [
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
    downloadCsv(
      `ration-staff-${month}-${staffSheet.sender.id}.csv`,
      rows,
    );
  }

  function onExportTransfer() {
    if (!transferSheet) return;
    const rows: string[][] = [
      [
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
      ...transferSheet.lines.map((line) => [
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
      ]),
    ];
    downloadCsv(
      `ration-transfer-${month}-${transferSheet.sender.id}.csv`,
      rows,
    );
  }

  const backHref = `/ration/report?month=${month}`;
  const hasLines = Boolean(staffSheet?.lines.length);

  if (!senderId) return null;

  if (!staffSheet) {
    return (
      <PagePane className="gap-5">
        <Button asChild variant="ghost" size="sm" className="w-fit rounded-xl">
          <Link href={backHref}>
            <IconArrowLeft className="h-4 w-4" />
            {t("ration.backToReport")}
          </Link>
        </Button>
        <EmptyState
          title={t("ration.emptyNoEligible")}
          action={
            <Button asChild variant="cta" className="rounded-xl">
              <Link href={backHref}>{t("ration.backToReport")}</Link>
            </Button>
          }
        />
      </PagePane>
    );
  }

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <StaffPayoutPrint
        sheets={[staffSheet]}
        active={printKind === "staff"}
      />
      {transferSheet ? (
        <TransferSheetPrint
          sheets={[transferSheet]}
          active={printKind === "transfer"}
        />
      ) : null}

      <div className="no-print flex flex-col gap-5">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 rounded-xl text-neutral-500"
          >
            <Link href={backHref}>
              <IconArrowLeft className="h-4 w-4" />
              {t("ration.backToReport")}
            </Link>
          </Button>
          <PageHeader
            title={t("pages.rationSenderReport.title", {
              label: staffSheet.sender.label,
            })}
            subtitle={t("pages.rationSenderReport.subtitle", {
              month,
              bank: staffSheet.sender.bank_name,
            })}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={onExportStaff}
                  disabled={!hasLines}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  {t("ration.exportStaffCsv")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={() => printAs("staff")}
                  disabled={!hasLines}
                >
                  <IconPrinter className="h-3.5 w-3.5" />
                  {t("ration.printStaff")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={onExportTransfer}
                  disabled={!hasLines || !transferSheet}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  {t("ration.exportTransferCsv")}
                </Button>
                <Button
                  variant="cta"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={() => printAs("transfer")}
                  disabled={!hasLines}
                >
                  <IconPrinter className="h-3.5 w-3.5" />
                  {t("ration.printTransfer")}
                </Button>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip
            label={t("ration.senderTotal")}
            value={formatBdt(staffSheet.total)}
            accent
          />
          <StatChip
            label={t("consume.statMembers")}
            value={String(staffSheet.lines.length)}
          />
          <StatChip
            label={t("ration.missingBank")}
            value={String(missingBankCount)}
          />
          <StatChip
            label={t("ration.fromAccount")}
            value={staffSheet.sender.account_number || "—"}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/80 to-white p-3.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("ration.month")}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                aria-label={t("ration.prevMonth")}
                onClick={() => setMonth(shiftMonthKey(month, -1))}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative w-[11.5rem]">
                <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={cn(fieldClass, "pl-9")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                aria-label={t("ration.nextMonth")}
                onClick={() => setMonth(shiftMonthKey(month, 1))}
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1.5 sm:min-w-[14rem]">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("common.search")}
            </p>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("ration.searchPlaceholder")}
                aria-label={t("common.search")}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </div>
          <div className="w-[10rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("cc.filterRank")}
            </p>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!hasLines ? (
          <EmptyState title={t("ration.emptyNoEligible")} />
        ) : members.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-3 py-2">{t("ration.colSer")}</th>
                    <th className="px-3 py-2">{t("ration.colPersNo")}</th>
                    <th className="px-3 py-2">{t("ration.colRank")}</th>
                    <th className="px-3 py-2">{t("ration.colName")}</th>
                    <th className="px-3 py-2">{t("ration.colAcct")}</th>
                    <th className="px-3 py-2">{t("ration.colRouting")}</th>
                    <th className="px-3 py-2">{t("ration.colBank")}</th>
                    <th className="px-3 py-2">{t("ration.colAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((line) => (
                    <tr
                      key={line.user.id}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-3 py-2 tabular-nums">{line.ser}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {line.user.rab_id}
                      </td>
                      <td className="px-3 py-2">{line.user.rank}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{line.user.name}</span>
                          {line.missingBank ? (
                            <Badge className="bg-amber-100 text-[10px] text-amber-900">
                              {t("ration.missingBank")}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {line.user.account_number || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {line.user.routing || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {line.user.bank_name || "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {formatBdt(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t-2 border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/80">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {t("ration.senderTotal")}
              </p>
              <p className="text-base font-semibold tabular-nums text-primary">
                {formatBdt(staffSheet.total)}
              </p>
            </div>
          </section>
        )}
      </div>
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
          "mt-1 text-lg font-semibold tracking-tight tabular-nums sm:text-xl",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
