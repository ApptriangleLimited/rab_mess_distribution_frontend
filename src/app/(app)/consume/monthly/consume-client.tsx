"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendarStats,
  IconCoin,
  IconDownload,
  IconPrinter,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { LeaveMedBillPanel } from "@/components/consume/leave-med-bill-panel";
import { TagBillPanel } from "@/components/consume/tag-bill-panel";
import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { ConsumeTagTabs } from "@/components/layout/consume-tag-tabs";
import { Button } from "@/components/ui/button";
import { useReportSource } from "@/hooks/use-report-source";
import { useSession } from "@/hooks/use-session";
import { useStore } from "@/hooks/use-store";
import { isRationFamily } from "@/lib/constants";
import {
  CONSUME_FILTER_TAGS,
  consumeFilterLabel,
  consumeFiltersForRole,
  memberMatchesTypeFilter,
  parseConsumeFilter,
  parseConsumeMemberType,
  type ConsumeFilter,
  type ConsumeMemberTypeFilter,
} from "@/lib/consume-filters";
import { groupRowsByOfficialWing } from "@/lib/consume-official-reports";
import {
  downloadLeaveMedBillPdf,
  downloadTagBillPdf,
} from "@/lib/download-consume-pdfs";
import { monthKey } from "@/lib/date";
import {
  buildLeaveMedBill,
  buildTagBill,
  formatBdt,
  withReportSource,
} from "@/lib/reports";
import { memberMatchesWingFilter } from "@/lib/store/org-options";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ConsumeBillUser = {
  name: string;
  personal_id: string;
  rab_id: string;
  rank: string;
  wing: string;
  member_type: string;
};

function matchesConsumeBillFilters(
  user: ConsumeBillUser,
  q: string,
  rank: string,
  wing: string,
  memberType: ConsumeMemberTypeFilter,
) {
  if (rank !== "all" && user.rank !== rank) return false;
  if (!memberMatchesWingFilter(user.wing, wing)) return false;
  if (!memberMatchesTypeFilter(user.member_type, memberType)) return false;
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return [user.name, user.personal_id, user.rab_id, user.wing, user.rank]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function ConsumeMonthlyClient() {
  const t = useT();
  const state = useStore();
  const { session } = useSession();
  const ration = isRationFamily(session?.role);
  const filters = consumeFiltersForRole(ration);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const rawMonth = searchParams.get("month");
  const defaultMonth = monthKey();
  const month =
    rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : defaultMonth;

  const { source, loading, refreshing } = useReportSource({ month });
  const [filterPending, startFilterTransition] = useTransition();
  const filter = parseConsumeFilter(searchParams.get("tag"));
  const memberType = parseConsumeMemberType(searchParams.get("member_type"));
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const filterTags = CONSUME_FILTER_TAGS[filter];
  const filterLabel = consumeFilterLabel(filter);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let dirty = false;
    if (!(rawMonth && MONTH_RE.test(rawMonth))) {
      params.set("month", defaultMonth);
      dirty = true;
    }
    const tagInUrl = searchParams.get("tag");
    const visibleFilter = !ration && filter === "fuel" ? "fr-mfr" : filter;
    if (tagInUrl !== visibleFilter) {
      params.set("tag", visibleFilter);
      dirty = true;
    }
    if (!dirty) return;
    router.replace(`${pathname}?${params.toString()}`);
  }, [rawMonth, defaultMonth, filter, ration, pathname, router, searchParams]);

  const tagBill = useMemo(
    () =>
      filter === "leave-med"
        ? null
        : withReportSource(source, () => buildTagBill(month, filterTags)),
    [state.assignments, state.users, state.rates, month, filter, filterTags, source],
  );

  const leaveBill = useMemo(
    () =>
      filter === "leave-med"
        ? withReportSource(source, () => buildLeaveMedBill(month, filterTags))
        : null,
    [state.assignments, state.users, state.rates, month, filter, filterTags, source],
  );

  const allBills = useMemo(() => {
    return {
      fr: withReportSource(source, () =>
        buildTagBill(month, CONSUME_FILTER_TAGS["fr-mfr"]),
      ),
      cd: withReportSource(source, () =>
        buildTagBill(month, CONSUME_FILTER_TAGS.cd),
      ),
      leave: withReportSource(source, () =>
        buildLeaveMedBill(month, CONSUME_FILTER_TAGS["leave-med"]),
      ),
      fuel: withReportSource(source, () =>
        buildTagBill(month, CONSUME_FILTER_TAGS.fuel),
      ),
    };
  }, [state.assignments, state.users, state.rates, month, source]);

  const counts = useMemo(() => {
    const match = <T extends { user: ConsumeBillUser }>(rows: T[]) =>
      rows.filter((row) =>
        matchesConsumeBillFilters(row.user, q, rank, wing, memberType),
      );
    return {
      "fr-mfr": match(allBills.fr.rows).length,
      cd: match(allBills.cd.rows).length,
      "leave-med": match(allBills.leave.rows).length,
      fuel: match(allBills.fuel.rows).length,
    } satisfies Record<ConsumeFilter, number>;
  }, [allBills, q, rank, wing, memberType]);

  const headerStats = useMemo(() => {
    if (leaveBill) {
      const rows = leaveBill.rows.filter((row) =>
        matchesConsumeBillFilters(row.user, q, rank, wing, memberType),
      );
      const days = rows.reduce((s, row) => s + row.totalDays, 0);
      return {
        days,
        members: rows.length,
        allowance: days,
        amount: rows.reduce((s, row) => s + row.amount, 0),
      };
    }
    const rows = (tagBill?.rows ?? []).filter((row) =>
      matchesConsumeBillFilters(row.user, q, rank, wing, memberType),
    );
    return {
      days: rows.reduce((s, row) => s + row.days, 0),
      members: rows.length,
      allowance: rows.reduce((s, row) => s + row.days, 0),
      amount: rows.reduce(
        (s, row) => s + (filter === "fuel" ? row.fuelAmount : row.grandTotal),
        0,
      ),
    };
  }, [leaveBill, tagBill, filter, q, rank, wing, memberType]);

  function patchQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function setMonth(next: string) {
    if (!MONTH_RE.test(next)) return;
    patchQuery({ month: next });
  }

  function setFilter(next: ConsumeFilter) {
    startFilterTransition(() => patchQuery({ tag: next }));
  }

  function setMemberType(next: ConsumeMemberTypeFilter) {
    startFilterTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("member_type");
      else params.set("member_type", next);
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month);
    params.set("tag", filter);
    if (memberType !== "all") params.set("member_type", memberType);
    if (q.trim()) params.set("q", q.trim());
    if (rank !== "all") params.set("rank", rank);
    if (wing !== "all") params.set("wing", wing);
    return `/consume/monthly/print?${params.toString()}`;
  }, [month, filter, memberType, q, rank, wing]);
  const exportDisabled = headerStats.members === 0;

  function onDownload() {
    if (exportDisabled) return;
    if (filter === "leave-med" && leaveBill) {
      const rows = leaveBill.rows.filter((row) =>
        matchesConsumeBillFilters(row.user, q, rank, wing, memberType),
      );
      downloadLeaveMedBillPdf({
        month,
        tags: filterTags,
        rows,
        tagTotals: {},
        totalDays: 0,
        totalAmount: 0,
        allowanceRate: leaveBill.rate,
        sections: groupRowsByOfficialWing(rows, {
          separateNewMembers: memberType === "new",
        }).map((group) => {
          const tagTotals: Partial<Record<DailyTag, number>> = {};
          for (const code of filterTags) {
            tagTotals[code] = group.rows.reduce(
              (s, r) => s + (r.tagDays[code] ?? 0),
              0,
            );
          }
          return {
            wingLabel: group.label,
            rows: group.rows,
            tagTotals,
            totalDays: group.rows.reduce((s, r) => s + r.totalDays, 0),
            totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
          };
        }),
        filename: `consume-bill-${month}-${filter}.pdf`,
      });
      return;
    }
    if (!tagBill) return;
    const rows = tagBill.rows.filter((row) =>
      matchesConsumeBillFilters(row.user, q, rank, wing, memberType),
    );
    const fuelOnly = filter === "fuel";
    const showFuel = fuelOnly || tagBill.tags.includes("FR") || tagBill.fuelRate > 0;
    downloadTagBillPdf({
      month,
      tag: filterLabel,
      tagLabel: filterLabel,
      rows,
      showFuel,
      totalDays: 0,
      totalAmount: 0,
      totalFuel: 0,
      grandTotal: 0,
      fuelOnly,
      allowanceRate: tagBill.rate,
      fuelRate: tagBill.fuelRate,
      sections: groupRowsByOfficialWing(rows, {
        separateNewMembers: memberType === "new",
      }).map((group) => ({
        wingLabel: group.label,
        rows: group.rows,
        totalDays: group.rows.reduce((s, r) => s + r.days, 0),
        totalAmount: group.rows.reduce((s, r) => s + r.amount, 0),
        totalFuel: group.rows.reduce((s, r) => s + r.fuelAmount, 0),
        grandTotal: group.rows.reduce(
          (s, r) => s + (fuelOnly ? r.fuelAmount : r.grandTotal),
          0,
        ),
      })),
      filename: `consume-bill-${month}-${filter}.pdf`,
    });
  }
  const amountLabel =
    filter === "fr-mfr" || filter === "fuel"
      ? t("consume.colGrandTotal")
      : t("consume.statAmount");

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
        value={formatBdt(headerStats.amount)}
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
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={exportDisabled}
                    onClick={onDownload}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    {t("consume.exportPdf")}
                  </Button>
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
              }
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-emerald-50/40 px-4 py-3.5 dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
            <ConsumeTagTabs
              value={filter === "fuel" && !ration ? "fr-mfr" : filter}
              onChange={setFilter}
              counts={counts}
              filters={filters}
            />
          </div>

          <div className="relative p-4 sm:p-5">
            {loading ? (
              <LoadingScreen />
            ) : filter === "leave-med" ? (
              <LeaveMedBillPanel
                key={`${month}-leave-med`}
                month={month}
                onMonthChange={setMonth}
                q={q}
                onQChange={setQ}
                rank={rank}
                onRankChange={setRank}
                wing={wing}
                onWingChange={setWing}
                memberType={memberType}
                onMemberTypeChange={setMemberType}
                tiles={statsTiles}
                source={source}
              />
            ) : (
              <TagBillPanel
                key={`${month}-${filter}`}
                month={month}
                tag={filterTags}
                displayTag={filter === "fuel" ? "FR+MFR" : filterLabel}
                onMonthChange={setMonth}
                q={q}
                onQChange={setQ}
                rank={rank}
                onRankChange={setRank}
                wing={wing}
                onWingChange={setWing}
                memberType={memberType}
                onMemberTypeChange={setMemberType}
                tiles={statsTiles}
                source={source}
                fuelOnly={filter === "fuel"}
              />
            )}
            {!loading && (refreshing || filterPending) ? (
              <LoadingScreen overlay />
            ) : null}
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
