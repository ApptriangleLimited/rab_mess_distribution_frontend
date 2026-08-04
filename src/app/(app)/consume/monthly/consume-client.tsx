"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { AllConsumePanel } from "@/components/consume/all-consume-panel";
import { TagBillPanel } from "@/components/consume/tag-bill-panel";
import { ConsumeTabs } from "@/components/layout/consume-tabs";
import {
  ConsumeTagTabs,
  type ConsumeTagTab,
} from "@/components/layout/consume-tag-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import { DAILY_TAGS } from "@/lib/constants";
import { previousMonthKey, shiftMonthKey } from "@/lib/date";
import { downloadConsumeMonthPdf } from "@/lib/download-consume-pdfs";
import { buildConsumeMonth } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseTagTab(raw: string | null): ConsumeTagTab | null {
  if (!raw) return null;
  if (raw === "all") return "all";
  return DAILY_TAGS.some((item) => item.code === raw)
    ? (raw as DailyTag)
    : null;
}

export default function ConsumeMonthlyClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const rawMonth = searchParams.get("month");
  const defaultMonth = previousMonthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;

  const report = useMemo(
    () => buildConsumeMonth(month),
    [state.assignments, state.users, state.rates, month],
  );

  const tagStats = useMemo(() => [...report.byTag], [report.byTag]);

  const tag = parseTagTab(searchParams.get("tag")) ?? "all";

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let dirty = false;
    if (!(rawMonth && MONTH_RE.test(rawMonth))) {
      params.set("month", defaultMonth);
      dirty = true;
    }
    if (!parseTagTab(searchParams.get("tag"))) {
      params.set("tag", "all");
      dirty = true;
    }
    if (!dirty) return;
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, pathname, router, searchParams]);

  const allowanceDays = useMemo(
    () => report.rows.reduce((sum, row) => sum + row.allowanceDays, 0),
    [report.rows],
  );

  function patchQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    patchQuery({ month: next });
  }

  function setTag(next: ConsumeTagTab) {
    patchQuery({ tag: next });
  }

  function onExport() {
    downloadConsumeMonthPdf({
      month,
      rows: report.rows,
      filename: `consume-${month}.pdf`,
    });
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="no-print">
          <PageHeader
            title={t("pages.consumeMonthly.title")}
            subtitle={t("pages.consumeMonthly.subtitle", { month })}
            center={<ConsumeTabs />}
            actions={
              <>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg"
                    aria-label={t("consume.prevMonth")}
                    onClick={() => setMonth(shiftMonthKey(month, -1))}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative w-40 shrink-0">
                    <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      aria-label={t("consume.month")}
                      className={cn(fieldClass, "w-40 pl-8")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg"
                    aria-label={t("consume.nextMonth")}
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
                  disabled={!report.rows.length}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  {t("consume.exportPdf")}
                </Button>
              </>
            }
          />
        </div>

        {/* Bill desk — tags + panel as one composition */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950 print:border-0 print:shadow-none">
          <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-3 no-print dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {t("consume.byTag")}
            </p>
            <ConsumeTagTabs
              value={tag}
              onChange={setTag}
              stats={tagStats}
            />
          </div>

          <div className="p-4 sm:p-5 print:p-0">
            {tag === "all" ? (
              <AllConsumePanel
                key={`${month}-all`}
                month={month}
                rows={report.rows}
                totalAmount={report.totalAmount}
                assignmentCount={report.assignmentCount}
                allowanceDays={allowanceDays}
              />
            ) : (
              <TagBillPanel key={`${month}-${tag}`} month={month} tag={tag} />
            )}
          </div>
        </section>
      </motion.div>
    </PagePane>
  );
}
