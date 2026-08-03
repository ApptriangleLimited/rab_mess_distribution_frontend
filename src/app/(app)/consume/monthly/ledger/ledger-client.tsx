"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconArrowLeft,
  IconCalendar,
  IconDownload,
  IconPrinter,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthLedgerPrint } from "@/components/consume/month-ledger-print";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { RANKS, WINGS } from "@/lib/constants";
import { previousMonthKey } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildMonthLedger } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeLedgerClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const rawMonth = searchParams.get("month");
  const defaultMonth = previousMonthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;

  useEffect(() => {
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", defaultMonth);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, pathname, router, searchParams]);

  const ledger = useMemo(
    () => buildMonthLedger(month),
    [state.assignments, state.users, month],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ledger.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.rank, row.user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [ledger.rows, q, rank, wing]);

  const taggedCells = useMemo(
    () =>
      rows.reduce(
        (n, row) => n + row.days.filter((d) => Boolean(d)).length,
        0,
      ),
    [rows],
  );

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onExport() {
    const dayHeaders = Array.from({ length: ledger.dayCount }, (_, i) =>
      String(i + 1),
    );
    const header = [
      t("consume.colSl"),
      t("consume.colId"),
      t("consume.colRank"),
      t("consume.colName"),
      ...dayHeaders,
      ...ledger.tagCodes,
    ];
    const data = [
      header,
      ...rows.map((r, i) => [
        String(i + 1),
        r.user.rab_id,
        r.user.rank,
        r.user.name,
        ...r.days.map((d) => d || ""),
        ...ledger.tagCodes.map((code) => String(r.tagCounts[code] ?? "")),
      ]),
    ];
    downloadCsv(`consume-ledger-${month}.csv`, data);
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <MonthLedgerPrint
        month={month}
        dayCount={ledger.dayCount}
        tagCodes={ledger.tagCodes}
        rows={ledger.rows}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5 no-print"
      >
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 rounded-xl text-neutral-500"
          >
            <Link href={`/consume/monthly?month=${month}`}>
              <IconArrowLeft className="h-4 w-4" />
              {t("consume.backToTags")}
            </Link>
          </Button>
          <PageHeader
            title={t("pages.consumeLedger.title")}
            subtitle={t("pages.consumeLedger.subtitle", { month })}
            actions={
              <div className="flex flex-wrap items-center gap-2.5">
                <MiniStat
                  label={t("daily.rosterStatShowing")}
                  value={String(rows.length)}
                  accent
                />
                <MiniStat
                  label={t("daily.taggedCells")}
                  value={String(taggedCells)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-xl"
                  onClick={onExport}
                  disabled={!rows.length}
                >
                  <IconDownload className="h-4 w-4" />
                  {t("consume.exportCsv")}
                </Button>
                <Button
                  variant="cta"
                  size="sm"
                  className="h-11 rounded-xl"
                  onClick={() => window.print()}
                  disabled={!ledger.rows.length}
                >
                  <IconPrinter className="h-4 w-4" />
                  {t("mess.print")}
                </Button>
              </div>
            }
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-3.5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div className="min-w-[12rem] flex-1 space-y-1.5 sm:min-w-[16rem]">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("common.search")}
            </p>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cc.searchPlaceholder")}
              className={fieldClass}
            />
          </div>
          <div className="w-auto space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("daily.month")}
            </p>
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </div>
          <div className="w-[14rem] space-y-1.5">
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
          <div className="w-[14rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("cc.filterWing")}
            </p>
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {ledger.rows.length === 0 ? (
          <EmptyState title={t("consume.ledgerEmpty")} />
        ) : rows.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <MonthLedgerBoard
            month={month}
            dayCount={ledger.dayCount}
            tagCodes={ledger.tagCodes}
            rows={rows}
          />
        )}
      </motion.div>
    </PagePane>
  );
}

function MiniStat({
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
        "rounded-xl border px-3 py-1.5",
        accent
          ? "border-primary/20 bg-primary/[0.06]"
          : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
