"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import { previousMonthKey, shiftMonthKey } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildConsumeMonth, formatBdt } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeMonthlyClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

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

  const report = useMemo(
    () => buildConsumeMonth(month),
    [state.assignments, state.users, state.rates, month],
  );

  const allowanceDays = useMemo(
    () => report.rows.reduce((sum, row) => sum + row.allowanceDays, 0),
    [report.rows],
  );

  const tagRows = useMemo(
    () =>
      [...report.byTag].sort(
        (a, b) => b.amount - a.amount || b.days - a.days,
      ),
    [report.byTag],
  );

  const rateByTag = useMemo(() => {
    const map = new Map<DailyTag, number>();
    for (const r of state.rates) map.set(r.tag, r.amount_per_day);
    return map;
  }, [state.rates]);

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onExport() {
    const rows = [
      [
        t("cc.fields.name"),
        t("cc.fields.rabId"),
        t("consume.totalDays"),
        t("consume.allowanceDays"),
        t("consume.amount"),
      ],
      ...report.rows.map((r) => [
        r.user.name,
        r.user.rab_id,
        String(r.totalDays),
        String(r.allowanceDays),
        String(r.amount),
      ]),
    ];
    downloadCsv(`consume-${month}.csv`, rows);
  }

  function onExportTag(tag: DailyTag) {
    const rate = rateByTag.get(tag) ?? 0;
    const members = report.rows
      .map((row) => {
        const days = row.tagDays[tag] ?? 0;
        if (!days) return null;
        return {
          name: row.user.name,
          rabId: row.user.rab_id,
          days,
          amount: days * rate,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const rows = [
      [
        t("cc.fields.name"),
        t("cc.fields.rabId"),
        t("consume.tagDays"),
        t("consume.tagAmount"),
      ],
      ...members.map((r) => [
        r.name,
        r.rabId,
        String(r.days),
        String(r.amount),
      ]),
    ];
    downloadCsv(`consume-${month}-${tag}.csv`, rows);
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  const monthQuery = `?month=${month}`;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.consumeMonthly.title")}
          subtitle={t("pages.consumeMonthly.subtitle", { month })}
          actions={
            <>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={t("consume.prevMonth")}
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
                    aria-label={t("consume.month")}
                    className={cn(fieldClass, "h-9 w-[11rem] pl-8")}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                  aria-label={t("consume.nextMonth")}
                  onClick={() => setMonth(shiftMonthKey(month, 1))}
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="h-9 rounded-xl"
                onClick={onExport}
                disabled={!report.rows.length}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("consume.exportCsv")}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip
            label={t("consume.statAmount")}
            value={formatBdt(report.totalAmount)}
            accent
          />
          <StatChip
            label={t("consume.statDays")}
            value={String(report.assignmentCount)}
          />
          <StatChip
            label={t("consume.statMembers")}
            value={String(report.rows.length)}
          />
          <StatChip
            label={t("consume.statAllowance")}
            value={String(allowanceDays)}
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t("consume.byTag")}
            </span>
            <span className="text-[11px] text-neutral-400">
              {t("consume.openTag")}
            </span>
          </div>
          {tagRows.length === 0 ? (
            <EmptyState
              title={t("consume.empty")}
              description={t("consume.emptyHint")}
            />
          ) : (
            <>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {tagRows.map((row) => (
                  <li
                    key={row.tag}
                    className="flex items-stretch gap-1 px-2 py-1.5 sm:px-3"
                  >
                    <Link
                      href={`/consume/monthly/tag/${row.tag}${monthQuery}`}
                      className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-primary/[0.04] sm:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem] dark:hover:bg-primary/10"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-neutral-900 dark:text-white">
                          {row.tag}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {tagLabel(row.tag, locale)}
                        </p>
                      </div>
                      <p className="text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
                        {row.days}
                        <span className="ml-1 text-[10px] uppercase text-neutral-400">
                          {t("consume.days")}
                        </span>
                      </p>
                      <p className="hidden text-right text-sm tabular-nums text-neutral-600 sm:block dark:text-neutral-300">
                        {row.users}
                        <span className="ml-1 text-[10px] uppercase text-neutral-400">
                          {t("consume.users")}
                        </span>
                      </p>
                      <p className="text-right text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {formatBdt(row.amount)}
                      </p>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="my-auto h-9 shrink-0 rounded-xl px-2.5"
                      aria-label={`${t("consume.exportTag")} ${row.tag}`}
                      title={t("consume.exportTag")}
                      onClick={() => onExportTag(row.tag)}
                    >
                      <IconDownload className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {t("consume.exportCsv")}
                      </span>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="my-auto h-9 shrink-0 rounded-xl border-primary/30 bg-primary/[0.06] px-2.5 text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Link
                        href={`/consume/monthly/tag/${row.tag}${monthQuery}`}
                        aria-label={t("consume.openTag")}
                        title={t("consume.openTag")}
                      >
                        <IconEye className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {t("consume.openTag")}
                        </span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/80">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {t("consume.statAmount")}
                </p>
                <p className="text-base font-semibold tabular-nums text-primary">
                  {formatBdt(report.totalAmount)}
                </p>
              </div>
            </>
          )}
        </section>
      </motion.div>
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
