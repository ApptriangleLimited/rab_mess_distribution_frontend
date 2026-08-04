"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileAnalytics,
  IconSearch,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthLedgerBoard } from "@/components/consume/month-ledger-board";
import { GenerateReportDialog } from "@/components/ration/generate-report-dialog";
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
import {
  monthKey,
  parseMonthInput,
  shiftMonthKey,
} from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildMonthLedger } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

export default function RationMonthlyClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [reportOpen, setReportOpen] = useState(false);
  const month = parseMonthInput(
    searchParams.get("month") ?? monthKey(),
  );

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

  function setMonth(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onExport() {
    const header = [
      t("consume.colSl"),
      t("consume.colId"),
      t("consume.colRank"),
      t("consume.colName"),
      ...ledger.tagCodes,
    ];
    const data = [
      header,
      ...rows.map((r, i) => [
        String(i + 1),
        r.user.rab_id,
        r.user.rank,
        r.user.name,
        ...ledger.tagCodes.map((code) => String(r.tagCounts[code] ?? "")),
      ]),
    ];
    downloadCsv(`ration-ledger-${month}.csv`, data);
  }

  return (
    <PagePane className="gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.rationMonthly.title")}
          subtitle={t("pages.rationMonthly.subtitle", { month })}
          center={<RationTabs />}
          actions={
            <>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg"
                  aria-label={t("ration.prevMonth")}
                  onClick={() => setMonth(shiftMonthKey(month, -1))}
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <div className="relative w-44 shrink-0">
                  <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    aria-label={t("ration.month")}
                    className={cn(fieldClass, "w-44 pl-8")}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg"
                  aria-label={t("ration.nextMonth")}
                  onClick={() => setMonth(shiftMonthKey(month, 1))}
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={onExport}
                disabled={!rows.length}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("ration.exportCsv")}
              </Button>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setReportOpen(true)}
              >
                <IconFileAnalytics className="h-3.5 w-3.5" />
                {t("ration.openReport")}
              </Button>
            </>
          }
        />

        <GenerateReportDialog
          open={reportOpen}
          defaultMonth={month}
          onClose={() => setReportOpen(false)}
        />

        <div className="flex w-full flex-wrap items-center gap-2.5 rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div className="min-w-[14rem] flex-1">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("cc.searchPlaceholder")}
                aria-label={t("common.search")}
                className={cn(fieldClass, "w-full pl-8")}
              />
            </div>
          </div>
          <div className="w-[9.5rem] shrink-0">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger
                className={cn(fieldClass, "w-full")}
                aria-label={t("cc.filterRank")}
              >
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allRank")}</SelectItem>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[9rem] shrink-0">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger
                className={cn(fieldClass, "w-full")}
                aria-label={t("cc.filterWing")}
              >
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allWing")}</SelectItem>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ClearFiltersButton
            disabled={!q.trim() && rank === "all" && wing === "all"}
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
            }}
          />
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
            hideMonthMeta
            hideDayColumns
            density="medium"
          />
        )}
      </motion.div>
    </PagePane>
  );
}
