"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconArrowLeft,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
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
import { DAILY_TAGS, RANKS, WINGS } from "@/lib/constants";
import { previousMonthKey, shiftMonthKey } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildConsumeMonth, formatBdt } from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseTag(raw: string | string[] | undefined): DailyTag | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return DAILY_TAGS.some((item) => item.code === value)
    ? (value as DailyTag)
    : null;
}

export default function ConsumeTagMembersClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const reduceMotion = useReducedMotion();
  const tag = parseTag(params.tag);

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const rawMonth = searchParams.get("month");
  const defaultMonth = previousMonthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;

  useEffect(() => {
    if (!tag) {
      router.replace(`/consume/monthly?month=${defaultMonth}`);
      return;
    }
    if (rawMonth && MONTH_RE.test(rawMonth)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", defaultMonth);
    router.replace(`${pathname}?${next.toString()}`);
  }, [tag, rawMonth, defaultMonth, pathname, router, searchParams]);

  const report = useMemo(
    () => buildConsumeMonth(month),
    [state.assignments, state.users, state.rates, month],
  );

  const rate = useMemo(() => {
    if (!tag) return 0;
    return state.rates.find((r) => r.tag === tag)?.amount_per_day ?? 0;
  }, [state.rates, tag]);

  const tagAgg = useMemo(() => {
    if (!tag) return null;
    return report.byTag.find((row) => row.tag === tag) ?? null;
  }, [report.byTag, tag]);

  const members = useMemo(() => {
    if (!tag) return [];
    const query = q.trim().toLowerCase();
    return report.rows
      .map((row) => {
        const days = row.tagDays[tag] ?? 0;
        if (!days) return null;
        return {
          user: row.user,
          days,
          amount: days * rate,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => {
        if (rank !== "all" && row.user.rank !== rank) return false;
        if (wing !== "all" && row.user.wing !== wing) return false;
        if (!query) return true;
        return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) => b.amount - a.amount || a.user.name.localeCompare(b.user.name),
      );
  }, [report.rows, tag, rate, q, rank, wing]);

  const filteredTotal = useMemo(
    () => members.reduce((sum, row) => sum + row.amount, 0),
    [members],
  );

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const paramsNext = new URLSearchParams(searchParams.toString());
    paramsNext.set("month", next);
    router.replace(`${pathname}?${paramsNext.toString()}`);
  }

  function onExport() {
    if (!tag) return;
    const rows = [
      [
        t("cc.fields.name"),
        t("cc.fields.rabId"),
        t("consume.tagDays"),
        t("consume.tagAmount"),
      ],
      ...members.map((r) => [
        r.user.name,
        r.user.rab_id,
        String(r.days),
        String(r.amount),
      ]),
    ];
    downloadCsv(`consume-${month}-${tag}.csv`, rows);
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  if (!tag) return null;

  const label = tagLabel(tag, locale);
  const backHref = `/consume/monthly?month=${month}`;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 rounded-xl text-neutral-500"
          >
            <Link href={backHref}>
              <IconArrowLeft className="h-4 w-4" />
              {t("consume.backToTags")}
            </Link>
          </Button>
          <PageHeader
            title={t("pages.consumeTag.title", { tag, label })}
            subtitle={t("pages.consumeTag.subtitle", { tag, month })}
            actions={
              <Button
                variant="cta"
                size="sm"
                className="rounded-xl"
                onClick={onExport}
                disabled={!members.length}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("consume.exportCsv")}
              </Button>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatChip
            label={t("consume.tagAmount")}
            value={formatBdt(tagAgg?.amount ?? 0)}
            accent
          />
          <StatChip
            label={t("consume.tagDays")}
            value={String(tagAgg?.days ?? 0)}
          />
          <StatChip
            label={t("consume.statMembers")}
            value={String(tagAgg?.users ?? 0)}
            className="col-span-2 lg:col-span-1"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/80 to-white p-3.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("consume.month")}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                aria-label={t("consume.prevMonth")}
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
                aria-label={t("consume.nextMonth")}
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
                placeholder={t("consume.searchPlaceholder")}
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
          <div className="w-[10rem] space-y-1.5">
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

        {!tagAgg ? (
          <EmptyState title={t("consume.tagEmpty")} />
        ) : members.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
              <IconUsers className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("consume.perUser")}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
                {members.length}/{tagAgg.users}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3 text-right">
                      {t("consume.tagDays")}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {t("consume.tagAmount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((row) => (
                    <tr
                      key={row.user.id}
                      className="border-t border-neutral-100 transition-colors hover:bg-primary/[0.03] dark:border-neutral-800 dark:hover:bg-primary/5"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {row.user.name}
                        </p>
                        <p className="font-mono text-[11px] text-neutral-500">
                          {row.user.rab_id}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {row.user.rank} · {row.user.wing}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.days}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                        {formatBdt(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900/80">
                    <td className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      {t("consume.statAmount")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                      {members.reduce((s, r) => s + r.days, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-primary">
                      {formatBdt(filteredTotal)}
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
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className,
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
