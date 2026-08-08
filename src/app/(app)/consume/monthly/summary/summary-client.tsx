"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconPrinter,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import { monthKey, shiftMonthKey } from "@/lib/date";
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

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div>
          <PageHeader
            title={t("pages.consumeSummary.title")}
            subtitle={t("pages.consumeSummary.subtitle", { month })}
            center={<ConsumePanelTabs />}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    aria-label={t("consume.prevMonth")}
                    onClick={() => setMonth(shiftMonthKey(month, -1))}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative w-[11rem]">
                    <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className={cn(fieldClass, "w-[11rem] pl-8")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    aria-label={t("consume.nextMonth")}
                    onClick={() => setMonth(shiftMonthKey(month, 1))}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {summary.rows.length > 0 ? (
                  <Button
                    asChild
                    variant="cta"
                    size="sm"
                    className="h-9 rounded-xl"
                  >
                    <Link
                      href={printHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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

        {summary.rows.length === 0 ? (
          <EmptyState title={t("consume.wingSummaryEmpty")} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-3 py-3">{t("consume.colWing")}</th>
                    <th className="px-3 py-3 text-right">
                      {t("consume.colManpower")}
                    </th>
                    {summary.tagCodes.map((code) => (
                      <th key={code} className="px-2 py-3 text-right font-mono">
                        {code}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right">
                      {t("consume.colTotalDays")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr
                      key={row.wing}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-3 py-2.5 font-medium">{row.wing}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.manpower}
                      </td>
                      {summary.tagCodes.map((code) => (
                        <td
                          key={code}
                          className="px-2 py-2.5 text-right tabular-nums text-neutral-600"
                        >
                          {row.tagDays[code] ?? 0}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-primary">
                        {row.totalDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50/80 font-semibold dark:border-neutral-700 dark:bg-neutral-900/80">
                    <td className="px-3 py-3">{t("consume.billTotal")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {summary.totals.manpower}
                    </td>
                    {summary.tagCodes.map((code) => (
                      <td
                        key={code}
                        className="px-2 py-3 text-right tabular-nums"
                      >
                        {summary.totals.tagDays[code] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right tabular-nums text-primary">
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
