"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendarStats,
  IconCoin,
  IconPrinter,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { AllConsumePanel } from "@/components/consume/all-consume-panel";
import { TagBillPanel } from "@/components/consume/tag-bill-panel";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import {
  ConsumeTagTabs,
  type ConsumeTagTab,
} from "@/components/layout/consume-tag-tabs";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { isAllowanceTag, isKnownTag } from "@/lib/store/rates";
import { monthKey } from "@/lib/date";
import { buildConsumeMonth, buildTagBill, formatBdt } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseTagTab(raw: string | null): ConsumeTagTab | null {
  if (!raw) return null;
  if (raw === "all") return "all";
  return isKnownTag(raw) ? (raw as DailyTag) : null;
}

export default function ConsumeMonthlyClient() {
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

  const headerStats = useMemo(() => {
    if (tag === "all") {
      return {
        days: report.assignmentCount,
        members: report.rows.length,
        allowance: allowanceDays,
        amount: report.totalAmount,
      };
    }
    const agg = report.byTag.find((row) => row.tag === tag);
    const isAllowance = isAllowanceTag(tag);
    return {
      days: agg?.days ?? 0,
      members: agg?.users ?? 0,
      allowance: isAllowance ? (agg?.days ?? 0) : 0,
      amount: agg?.amount ?? 0,
    };
  }, [tag, report, allowanceDays]);

  const tagBill = useMemo(
    () => (tag === "all" ? null : buildTagBill(month, tag)),
    [state.assignments, state.users, state.rates, month, tag],
  );

  const amountValue =
    tag !== "all" && tagBill ? tagBill.grandTotal : headerStats.amount;
  const amountLabel =
    tag !== "all" && tagBill && (tag === "FR" || tagBill.fuelRate > 0)
      ? t("consume.colGrandTotal")
      : t("consume.statAmount");

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

  const printHref =
    tag === "all"
      ? ""
      : `/consume/monthly/print?month=${month}&tag=${tag}`;
  const exportDisabled =
    tag === "all" ? !report.rows.length : !tagBill?.rows.length;

  const statsTiles = (
    <>
      <StatChip
        icon={<IconCalendarStats className="h-3 w-3" />}
        label={t("consume.statDays")}
        value={String(headerStats.days)}
        tone="sky"
      />
      <StatChip
        icon={<IconUsers className="h-3 w-3" />}
        label={t("consume.statMembers")}
        value={String(headerStats.members)}
        tone="teal"
      />
      <StatChip
        icon={<IconUserCheck className="h-3 w-3" />}
        label={t("consume.statAllowance")}
        value={String(headerStats.allowance)}
        tone="lime"
      />
      <StatChip
        icon={<IconCoin className="h-3 w-3" />}
        label={amountLabel}
        value={formatBdt(amountValue)}
        tone="primary"
        accent
      />
    </>
  );

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
              title={t("pages.consumeMonthly.title")}
              subtitle={t("pages.consumeMonthly.subtitle", { month })}
              center={<ConsumePanelTabs />}
              actions={
                tag !== "all" ? (
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    {!exportDisabled ? (
                      <Button
                        asChild
                        variant="cta"
                        size="sm"
                        className="h-9 rounded-xl shadow-sm shadow-primary/20"
                      >
                        <Link href={printHref}>
                          <IconPrinter className="h-3.5 w-3.5" />
                          {t("consume.printBill")}
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
                        {t("consume.printBill")}
                      </Button>
                    )}
                  </div>
                ) : null
              }
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-emerald-50/40 px-4 py-3.5 dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t("consume.byTag")}
            </p>
            <ConsumeTagTabs
              value={tag}
              onChange={setTag}
              stats={tagStats}
            />
          </div>

          <div className="p-4 sm:p-5">
            {tag === "all" ? (
              <AllConsumePanel
                key={`${month}-all`}
                rows={report.rows}
                month={month}
                onMonthChange={setMonth}
                tiles={statsTiles}
              />
            ) : (
              <TagBillPanel
                key={`${month}-${tag}`}
                month={month}
                tag={tag}
                onMonthChange={setMonth}
                tiles={statsTiles}
              />
            )}
          </div>
        </section>
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
  tone: "sky" | "teal" | "lime" | "primary";
  accent?: boolean;
}) {
  const toneClass = {
    sky: "border-sky-200/90 bg-sky-50 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-100",
    teal: "border-teal-200/90 bg-teal-50 text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-100",
    lime: "border-lime-200/90 bg-lime-50 text-lime-900 dark:border-lime-800/50 dark:bg-lime-950/40 dark:text-lime-100",
    primary:
      "border-primary/25 bg-primary/[0.08] text-primary dark:border-primary/40 dark:bg-primary/20 dark:text-emerald-100",
  }[tone];

  return (
    <div
      title={`${label} ${value}`}
      className={cn(
        "inline-flex h-8 min-w-0 shrink items-center gap-1 rounded-lg border px-1.5 shadow-sm",
        toneClass,
      )}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="hidden whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide opacity-80 lg:inline">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-bold tabular-nums",
          accent && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}
