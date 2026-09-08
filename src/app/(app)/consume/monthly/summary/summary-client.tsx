"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuilding,
  IconCalendarStats,
  IconPrinter,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNav } from "@/components/shared/month-nav";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { Button } from "@/components/ui/button";
import { tagCellClass } from "@/lib/tag-colors";
import { useStore } from "@/hooks/use-store";
import { monthKey } from "@/lib/date";
import { buildWingSummary } from "@/lib/reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeSummaryClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const rawMonth = searchParams.get("month");
  const defaultMonth = monthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;

  useEffect(() => {
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", defaultMonth);
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, pathname, router, searchParams]);

  const summary = useMemo(
    () => buildWingSummary(month),
    [state.assignments, state.users, state.rates, month],
  );

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const printHref = `/consume/monthly/summary/print?month=${month}`;
  const hasRows = summary.rows.length > 0;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-nav-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.consumeSummary.title")}
              subtitle={t("pages.consumeSummary.subtitle", { month })}
              center={<ConsumePanelTabs />}
              actions={
                <div className="flex flex-wrap items-center gap-2 no-print">
                  {hasRows ? (
                    <Button
                      asChild
                      variant="cta"
                      size="sm"
                      className="h-9 rounded-xl shadow-sm shadow-primary/20"
                    >
                      <Link href={printHref}>
                        <IconPrinter className="h-3.5 w-3.5" />
                        {t("mess.print")}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="cta"
                      size="sm"
                      className="h-9 rounded-xl"
                      disabled
                    >
                      <IconPrinter className="h-3.5 w-3.5" />
                      {t("mess.print")}
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 p-2.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
            <MonthNav month={month} onChange={setMonth} />
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5">
              <StatChip
                icon={<IconBuilding className="h-3.5 w-3.5" />}
                label={t("consume.colWing")}
                value={String(summary.rows.length)}
                tone="sky"
              />
              <StatChip
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("consume.colManpower")}
                value={String(summary.totals.manpower)}
                tone="teal"
              />
              <StatChip
                icon={<IconCalendarStats className="h-3.5 w-3.5" />}
                label={t("consume.colTotalDays")}
                value={String(summary.totals.totalDays)}
                tone="primary"
                accent
              />
            </div>
          </div>
        </div>

        {!hasRows ? (
          <EmptyState title={t("consume.wingSummaryEmpty")} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
              <IconBuilding className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("pages.consumeSummary.title")}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
                {summary.rows.length} · {month}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("consume.colWing")}</th>
                    <th className="px-4 py-3 text-right">
                      {t("consume.colManpower")}
                    </th>
                    {summary.tagCodes.map((code) => (
                      <th key={code} className="px-2 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            tagCellClass(code),
                          )}
                        >
                          {code}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">
                      {t("consume.colTotalDays")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr
                      key={row.wing}
                      className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {row.wing}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                        {row.manpower}
                      </td>
                      {summary.tagCodes.map((code) => {
                        const n = row.tagDays[code] ?? 0;
                        return (
                          <td
                            key={code}
                            className={cn(
                              "px-2 py-3 text-center font-mono tabular-nums",
                              n > 0
                                ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-300 dark:text-neutral-600",
                            )}
                          >
                            {n}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-primary">
                        {row.totalDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-primary/15 bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/50 dark:border-primary/25 dark:from-primary/10 dark:via-neutral-950 dark:to-neutral-950">
                    <td className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {t("consume.billTotal")}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {summary.totals.manpower}
                    </td>
                    {summary.tagCodes.map((code) => (
                      <td
                        key={code}
                        className="px-2 py-3.5 text-center font-mono font-semibold tabular-nums text-neutral-700 dark:text-neutral-200"
                      >
                        {summary.totals.tagDays[code] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right font-mono text-lg font-bold tabular-nums text-primary">
                      {summary.totals.totalDays}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "sky" | "teal" | "primary";
  accent?: boolean;
}) {
  const toneClass = {
    sky: "border-sky-200/90 bg-sky-50 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-100",
    teal: "border-teal-200/90 bg-teal-50 text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-100",
    primary:
      "border-primary/25 bg-primary/[0.08] text-primary dark:border-primary/40 dark:bg-primary/20 dark:text-emerald-100",
  }[tone];

  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 shadow-sm",
        toneClass,
      )}
    >
      <span className="opacity-80">{icon}</span>
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          accent && "font-mono text-base",
        )}
      >
        {value}
      </span>
    </div>
  );
}
