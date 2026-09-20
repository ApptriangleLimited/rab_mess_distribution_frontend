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
import { MonthNav } from "@/components/shared/month-nav";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { Button } from "@/components/ui/button";
import { OfficialConsumeLetter } from "@/components/consume/official-consume-letter";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  buildOfficialConsumePack,
  parseOfficialSheet,
  type ConsumeOfficialSheet,
} from "@/lib/consume-official-reports";
import { withReportSource } from "@/lib/reports";
import { monthKey } from "@/lib/date";
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

  const sheet = parseOfficialSheet(searchParams.get("sheet"));
  const { source, loading } = useReportSource({ month });
  const pack = useMemo(
    () =>
      withReportSource(source, () => buildOfficialConsumePack(month, sheet)),
    [state.assignments, state.users, state.rates, month, sheet, source],
  );
  const report = pack.summary;

  function patchQuery(next: { month?: string; sheet?: ConsumeOfficialSheet }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.month) params.set("month", next.month);
    if (next.sheet) params.set("sheet", next.sheet);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    patchQuery({ month: next });
  }

  const printHref = `/consume/monthly/summary/print?month=${month}&sheet=${sheet}`;

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
                value={String(report.rows.length)}
                tone="sky"
              />
              <StatChip
                icon={<IconUsers className="h-3.5 w-3.5" />}
                label={t("consume.colManpower")}
                value={String(report.totals.manpower)}
                tone="teal"
              />
              <StatChip
                icon={<IconCalendarStats className="h-3.5 w-3.5" />}
                label={t("consume.colTotalDays")}
                value={String(report.totals.totalDays)}
                tone="primary"
                accent
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["wings", "consume.officialWings"],
              ["fr", "consume.officialFr"],
              ["cd", "consume.officialCd"],
              ["leave", "consume.officialLeave"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              onClick={() => patchQuery({ sheet: id })}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-semibold",
                sheet === id
                  ? "bg-primary text-white"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
        ) : (
          <OfficialConsumeLetter pack={pack} preview />
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
