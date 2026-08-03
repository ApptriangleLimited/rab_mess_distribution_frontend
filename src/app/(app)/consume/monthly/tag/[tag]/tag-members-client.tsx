"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconArrowLeft,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPrinter,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { TagBillPrint } from "@/components/consume/tag-bill-print";
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
import { buildTagBill, formatBdt } from "@/lib/reports";
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

  const bill = useMemo(
    () => (tag ? buildTagBill(month, tag) : null),
    [state.assignments, state.users, state.rates, month, tag],
  );

  const members = useMemo(() => {
    if (!bill) return [];
    const query = q.trim().toLowerCase();
    return bill.rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bill, q, rank, wing]);

  const filteredTotal = useMemo(
    () => members.reduce((sum, row) => sum + row.grandTotal, 0),
    [members],
  );

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    const paramsNext = new URLSearchParams(searchParams.toString());
    paramsNext.set("month", next);
    router.replace(`${pathname}?${paramsNext.toString()}`);
  }

  function onExport() {
    if (!tag || !bill) return;
    const showFuel = bill.fuelRate > 0;
    const header = [
      t("consume.colSl"),
      t("consume.colId"),
      t("consume.colRank"),
      t("consume.colName"),
      tag,
      t("consume.colFreshAmount"),
      ...(showFuel ? [t("consume.colFuelAmount")] : []),
      t("consume.colGrandTotal"),
      t("consume.colRemarks"),
    ];
    const rows = [
      header,
      ...bill.rows.map((r) => [
        String(r.sl),
        r.user.rab_id,
        r.user.rank,
        r.user.name,
        String(r.days),
        String(r.amount),
        ...(showFuel ? [String(r.fuelAmount)] : []),
        String(r.grandTotal),
        r.remarks,
      ]),
    ];
    downloadCsv(`consume-bill-${month}-${tag}.csv`, rows);
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  if (!tag || !bill) return null;

  const label = tagLabel(tag, locale);
  const backHref = `/consume/monthly?month=${month}`;
  const showFuel = bill.fuelRate > 0;

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <TagBillPrint
        month={month}
        tag={tag}
        tagLabel={label}
        rows={bill.rows}
        totalDays={bill.totalDays}
        totalAmount={bill.totalAmount}
        totalFuel={bill.totalFuel}
        grandTotal={bill.grandTotal}
        showFuel={showFuel}
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
            <Link href={backHref}>
              <IconArrowLeft className="h-4 w-4" />
              {t("consume.backToTags")}
            </Link>
          </Button>
          <PageHeader
            title={t("pages.consumeTag.title", { tag, label })}
            subtitle={t("pages.consumeTag.subtitle", { tag, month })}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={onExport}
                  disabled={!bill.rows.length}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  {t("consume.exportCsv")}
                </Button>
                <Button
                  variant="cta"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => window.print()}
                  disabled={!bill.rows.length}
                >
                  <IconPrinter className="h-3.5 w-3.5" />
                  {t("consume.printBill")}
                </Button>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatChip
            label={t("consume.tagAmount")}
            value={formatBdt(bill.grandTotal)}
            accent
          />
          <StatChip
            label={t("consume.tagDays")}
            value={String(bill.totalDays)}
          />
          <StatChip
            label={t("consume.statMembers")}
            value={String(bill.rows.length)}
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

        {bill.rows.length === 0 ? (
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
                {members.length}/{bill.rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("consume.colSl")}</th>
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
                      <td className="px-4 py-3 tabular-nums text-neutral-400">
                        {row.sl}
                      </td>
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
                        {formatBdt(row.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900/80">
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                    >
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
