"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuildingBank,
  IconCalendarEvent,
  IconCircleCheck,
  IconCopy,
  IconSoup,
  IconTags,
  IconUserCheck,
  IconUserPause,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  formatDateDisplay,
  monthDatesThroughToday,
  monthKey,
  nextISODate,
  recentMonthDates,
  todayISO,
} from "@/lib/date";
import { buildMonthLedger, withReportSource } from "@/lib/reports";
import { listGuestMeals } from "@/lib/store/guest-meals";
import { listMealAssigns } from "@/lib/store/meal-assigns";
import { listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import {
  getMessEaters,
  getProjectedMessEaters,
} from "@/lib/store/mess";
import { useI18n, useT } from "@/i18n/provider";
import { tagLabel } from "@/i18n";
import { formatBdt } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/lib/types";

const WING_COLORS = [
  "#0d9488",
  "#0284c7",
  "#d97706",
  "#e11d48",
  "#059669",
  "#ea580c",
  "#475569",
];

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
  approved: "#059669",
  pending: "#d97706",
  rejected: "#e11d48",
  ended: "#64748b",
};

const TAG_COLORS = [
  "#0d9488",
  "#0284c7",
  "#d97706",
  "#e11d48",
  "#0f766e",
  "#059669",
  "#ea580c",
  "#0891b2",
  "#be123c",
];

const MEAL_SHIFT_COLORS = [
  "#0284c7",
  "#d97706",
  "#0d9488",
  "#7c3aed",
];

const RANK_COLORS = [
  "#0f766e",
  "#0369a1",
  "#b45309",
  "#be123c",
  "#047857",
  "#c2410c",
  "#334155",
  "#0e7490",
];

function ChartCard({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-4">{children}</div>
    </div>
  );
}

export default function AdminDashboardClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const month = monthKey();
  const { source } = useReportSource({ month });
  const today = todayISO();
  const tomorrow = nextISODate(today);

  const stats = useMemo(() => {
    const users = state.users;
    const accepted = users.filter((u) => u.approval_status === "approved");
    const pendingUsers = users
      .filter((u) => u.approval_status === "pending")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pending = pendingUsers.length;
    const rejected = users.filter((u) => u.approval_status === "rejected").length;
    const ended = users.filter((u) => u.approval_status === "ended").length;
    const active = accepted.filter((u) => u.status === "1").length;
    const inactive = accepted.filter((u) => u.status === "0").length;
    const taggedToday = state.assignments.filter((a) => a.date === today).length;

    const messToday = getMessEaters(today);
    const messTomorrow = getProjectedMessEaters(tomorrow);

    const approvalPie = (
      [
        ["approved", accepted.length],
        ["pending", pending],
        ["rejected", rejected],
        ["ended", ended],
      ] as const
    )
      .filter(([, n]) => n > 0)
      .map(([key, value]) => ({
        key,
        name:
          key === "approved"
            ? t("cc.approvalApproved")
            : key === "pending"
              ? t("cc.approvalPending")
              : key === "rejected"
                ? t("cc.approvalRejected")
                : t("cc.approvalEnded"),
        value,
        fill: APPROVAL_COLORS[key],
      }));

    const wingMap = new Map<string, number>();
    for (const u of accepted) {
      const wing = u.wing || "—";
      wingMap.set(wing, (wingMap.get(wing) ?? 0) + 1);
    }
    const wingBars = [...wingMap.entries()]
      .map(([name, value], i) => ({
        name,
        value,
        fill: WING_COLORS[i % WING_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const rankMap = new Map<string, number>();
    for (const u of accepted) {
      const rank = u.rank || "—";
      rankMap.set(rank, (rankMap.get(rank) ?? 0) + 1);
    }
    const rankBars = [...rankMap.entries()]
      .map(([name, value], i) => ({
        name,
        value,
        fill: RANK_COLORS[i % RANK_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const ledger = withReportSource(source, () => buildMonthLedger(month));
    const tagTotals = new Map<string, number>();
    for (const row of ledger.rows) {
      for (const [code, n] of Object.entries(row.tagCounts)) {
        if (!n) continue;
        tagTotals.set(code, (tagTotals.get(code) ?? 0) + n);
      }
    }
    const tagBars = [...tagTotals.entries()]
      .map(([code, value], i) => ({
        code,
        name: tagLabel(code, locale),
        value,
        fill: TAG_COLORS[i % TAG_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const tagDayTotal = [...tagTotals.values()].reduce((s, n) => s + n, 0);
    const msMonth = tagTotals.get("MS") ?? 0;
    const frMonth = tagTotals.get("FR") ?? 0;

    const daySeries = recentMonthDates(7)
      .slice()
      .reverse()
      .map((date) => {
        const dayTags = state.assignments.filter((a) => a.date === date);
        const ms = dayTags.filter((a) => a.tag === "MS").length;
        return {
          date,
          label: formatDateDisplay(date).slice(0, 6),
          tags: dayTags.length,
          ms,
        };
      });

    const liveRates = state.rates
      .filter((r) => r.amount_per_day > 0)
      .sort((a, b) => b.amount_per_day - a.amount_per_day);

    const bankMaps = state.senders.reduce(
      (n, s) => n + s.mapped_tags.length,
      0,
    );

    const shifts = listMealShifts();
    const shiftCount = Math.max(shifts.length, 1);
    const monthDays = monthDatesThroughToday();
    const monthFrom = monthDays[0] ?? today;
    const assigns = listMealAssigns();
    const guests = listGuestMeals();
    const inMonth = (date: string) => date >= monthFrom && date <= today;

    const mealConsume = assigns.filter(
      (a) => inMonth(a.date) && a.status === 1,
    ).length;
    const mealDuplicate = assigns.filter(
      (a) => inMonth(a.date) && a.status === 2,
    ).length;
    const mealGuests = guests.filter((g) => inMonth(g.date)).length;
    let mealPlanned = 0;
    for (const date of monthDays) {
      mealPlanned += getMessEaters(date).length * shiftCount;
    }

    const mealDaySeries = recentMonthDates(14)
      .slice()
      .reverse()
      .map((date) => {
        const eaters = getMessEaters(date).length;
        return {
          date,
          label: formatDateDisplay(date).slice(0, 6),
          consume: assigns.filter((a) => a.date === date && a.status === 1)
            .length,
          duplicate: assigns.filter((a) => a.date === date && a.status === 2)
            .length,
          guests: guests.filter((g) => g.date === date).length,
          planned: eaters * shiftCount,
        };
      });

    const mealShiftPie = shifts
      .map((shift, i) => ({
        key: shift.id,
        name: mealShiftLabel(shift.id, shift.name, t),
        value: assigns.filter(
          (a) => inMonth(a.date) && a.status === 1 && a.shift_id === shift.id,
        ).length,
        fill: MEAL_SHIFT_COLORS[i % MEAL_SHIFT_COLORS.length],
      }))
      .filter((row) => row.value > 0);

    return {
      accepted: accepted.length,
      pending,
      pendingUsers: pendingUsers.slice(0, 6),
      active,
      inactive,
      banks: state.senders.length,
      bankMaps,
      taggedToday,
      tagDayTotal,
      msMonth,
      frMonth,
      messToday: messToday.length,
      messTomorrow: messTomorrow.eaters.length,
      messTomorrowTagged: messTomorrow.tagged,
      messTomorrowCarried: messTomorrow.carried,
      approvalPie,
      wingBars,
      rankBars,
      tagBars,
      daySeries,
      liveRates,
      mealPlanned,
      mealConsume,
      mealDuplicate,
      mealGuests,
      mealDaySeries,
      mealShiftPie,
    };
  }, [
    state.users,
    state.assignments,
    state.senders,
    state.rates,
    state.boro_khana_dates,
    state.meal_assigns,
    state.guest_meals,
    state.meal_shifts,
    month,
    today,
    tomorrow,
    t,
    locale,
    source,
  ]);

  const kpis = [
    {
      label: t("pages.adminDashboard.kpi.accepted"),
      value: stats.accepted,
      icon: IconUsers,
      tone: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
    },
    {
      label: t("pages.adminDashboard.kpi.pending"),
      value: stats.pending,
      icon: IconUserPlus,
      tone: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    },
    {
      label: t("pages.adminDashboard.kpi.active"),
      value: stats.active,
      icon: IconUserCheck,
      tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: t("pages.adminDashboard.kpi.inactive"),
      value: stats.inactive,
      icon: IconUserPause,
      tone: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
    },
    {
      label: t("pages.adminDashboard.kpi.taggedToday"),
      value: stats.taggedToday,
      icon: IconTags,
      tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    },
    {
      label: t("pages.adminDashboard.kpi.banks"),
      value: stats.banks,
      icon: IconBuildingBank,
      tone: "bg-orange-500/12 text-orange-800 dark:text-orange-300",
    },
  ];

  return (
    <PagePane className="gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.adminDashboard.title")}
          subtitle={t("pages.adminDashboard.subtitle", { month })}
          center={<RationTabs />}
        />

        {/* Duty pulse — mess ops signature */}
        <div className="overflow-hidden rounded-2xl border border-teal-800/20 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_42%,#134e4a_100%)] text-white shadow-[0_12px_40px_rgba(15,118,110,0.28)]">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-100/80">
                {t("pages.adminDashboard.pulse.eyebrow")}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                {t("pages.adminDashboard.pulse.title")}
              </h2>
              <p className="mt-1 max-w-xl text-xs text-teal-50/75">
                {t("pages.adminDashboard.pulse.hint", {
                  today: formatDateDisplay(today),
                  tomorrow: formatDateDisplay(tomorrow),
                })}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <IconSoup className="h-5 w-5" />
            </span>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-4">
            {[
              {
                label: t("pages.adminDashboard.pulse.messToday"),
                value: stats.messToday,
              },
              {
                label: t("pages.adminDashboard.pulse.messTomorrow"),
                value: stats.messTomorrow,
              },
              {
                label: t("pages.adminDashboard.pulse.msMonth"),
                value: stats.msMonth,
              },
              {
                label: t("pages.adminDashboard.pulse.frMonth"),
                value: stats.frMonth,
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="bg-teal-950/35 px-4 py-3.5 backdrop-blur-[2px]"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-teal-100/70">
                  {cell.label}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-teal-100/65 sm:px-5">
            {t("pages.adminDashboard.pulse.tomorrowSplit", {
              tagged: stats.messTomorrowTagged,
              carried: stats.messTomorrowCarried,
            })}
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/mess/reports",
              label: t("pages.adminDashboard.meals.planned"),
              hint: t("pages.adminDashboard.meals.plannedHint"),
              value: stats.mealPlanned,
              icon: IconCalendarEvent,
              tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
            },
            {
              href: "/mess/reports?status=1",
              label: t("pages.adminDashboard.meals.consume"),
              hint: t("pages.adminDashboard.meals.consumeHint"),
              value: stats.mealConsume,
              icon: IconCircleCheck,
              tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
            },
            {
              href: "/mess/reports?status=2",
              label: t("pages.adminDashboard.meals.duplicate"),
              hint: t("pages.adminDashboard.meals.duplicateHint"),
              value: stats.mealDuplicate,
              icon: IconCopy,
              tone: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
            },
            {
              href: "/mess/reports?audience=guest",
              label: t("pages.adminDashboard.meals.guests"),
              hint: t("pages.adminDashboard.meals.guestsHint"),
              value: stats.mealGuests,
              icon: IconUserPlus,
              tone: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-2xl border border-neutral-200 bg-white p-3.5 transition hover:border-primary/30 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-xl",
                      card.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-white">
                    {card.value}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {card.label}
                </p>
                <p className="text-[10px] text-neutral-400">{card.hint}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={t("pages.adminDashboard.meals.series")}
            subtitle={t("pages.adminDashboard.meals.seriesHint")}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={stats.mealDaySeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e5e5",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="consume"
                    name={t("pages.adminDashboard.meals.consumeKey")}
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="duplicate"
                    name={t("pages.adminDashboard.meals.duplicateKey")}
                    fill="#e11d48"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="guests"
                    name={t("pages.adminDashboard.meals.guestKey")}
                    fill="#d97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    name={t("pages.adminDashboard.meals.plannedKey")}
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title={t("pages.adminDashboard.meals.byShift")}
            subtitle={t("pages.adminDashboard.meals.byShiftHint")}
          >
            {stats.mealShiftPie.length === 0 ? (
              <p className="py-16 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.charts.empty")}
              </p>
            ) : (
              <div className="flex h-[280px] flex-col sm:flex-row sm:items-center">
                <div className="h-[200px] w-full sm:h-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.mealShiftPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {stats.mealShiftPie.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [String(value ?? 0), ""]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e5e5e5",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex flex-wrap gap-2 px-2 pb-2 sm:w-1/2 sm:flex-col sm:gap-2.5 sm:pb-0">
                  {stats.mealShiftPie.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.fill }}
                      />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.label}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.03 * i }}
                className="rounded-2xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-xl",
                      kpi.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-white">
                    {kpi.value}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium text-neutral-500">
                  {kpi.label}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={t("pages.adminDashboard.charts.approval")}
            subtitle={t("pages.adminDashboard.charts.approvalHint")}
          >
            {stats.approvalPie.length === 0 ? (
              <p className="py-16 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.charts.empty")}
              </p>
            ) : (
              <div className="flex h-[260px] flex-col sm:flex-row sm:items-center">
                <div className="h-[200px] w-full sm:h-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.approvalPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {stats.approvalPie.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [String(value ?? 0), ""]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e5e5e5",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex flex-wrap gap-2 px-2 pb-2 sm:w-1/2 sm:flex-col sm:gap-2.5 sm:pb-0">
                  {stats.approvalPie.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.fill }}
                      />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title={t("pages.adminDashboard.charts.activity")}
            subtitle={t("pages.adminDashboard.charts.activityHint")}
          >
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.daySeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="dashTags" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dashMs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e5e5",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tags"
                    name={t("pages.adminDashboard.charts.activityTags")}
                    stroke="#0d9488"
                    fill="url(#dashTags)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="ms"
                    name={t("pages.adminDashboard.charts.activityMs")}
                    stroke="#0284c7"
                    fill="url(#dashMs)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={t("pages.adminDashboard.charts.wings")}
            subtitle={t("pages.adminDashboard.charts.wingsHint")}
          >
            {stats.wingBars.length === 0 ? (
              <p className="py-16 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.charts.empty")}
              </p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.wingBars}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#e5e5e5"
                    />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        String(value ?? 0),
                        t("pages.adminDashboard.kpi.accepted"),
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e5e5",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
                      {stats.wingBars.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title={t("pages.adminDashboard.charts.ranks")}
            subtitle={t("pages.adminDashboard.charts.ranksHint")}
          >
            {stats.rankBars.length === 0 ? (
              <p className="py-16 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.charts.empty")}
              </p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.rankBars}
                    margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e5e5",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={28}>
                      {stats.rankBars.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard
          title={t("pages.adminDashboard.charts.tags")}
          subtitle={t("pages.adminDashboard.charts.tagsHint", {
            month,
            total: stats.tagDayTotal,
          })}
        >
          {stats.tagBars.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-400">
              {t("pages.adminDashboard.charts.empty")}
            </p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.tagBars}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      String(value ?? 0),
                      String(
                        (item?.payload as { name?: string } | undefined)?.name ??
                          "",
                      ),
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e5e5",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36}>
                    {stats.tagBars.map((entry) => (
                      <Cell key={entry.code} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title={t("pages.adminDashboard.pending.title")}
            subtitle={t("pages.adminDashboard.pending.hint")}
            action={
              <Link
                href="/ration/members"
                className="text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
              >
                {t("pages.adminDashboard.pending.viewAll")}
              </Link>
            }
          >
            {stats.pendingUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.pending.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {stats.pendingUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-1 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {u.name}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {u.rab_id} · {u.rank} · {u.wing}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      {t("cc.approvalPending")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <ChartCard
            title={t("pages.adminDashboard.rates.title")}
            subtitle={t("pages.adminDashboard.rates.hint", {
              banks: stats.banks,
              maps: stats.bankMaps,
            })}
            action={
              <span className="flex items-center gap-3">
                <Link
                  href="/settings?tab=staff"
                  className="text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
                >
                  {t("settings.tabStaff")}
                </Link>
                <Link
                  href="/settings"
                  className="text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
                >
                  {t("nav.settings")}
                </Link>
              </span>
            }
          >
            {stats.liveRates.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                {t("pages.adminDashboard.rates.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {stats.liveRates.map((rate) => (
                  <li
                    key={rate.tag}
                    className="flex items-center justify-between gap-3 px-1 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-teal-700 font-mono text-[10px] font-bold tracking-wider text-white">
                        {rate.tag}
                      </span>
                      <span className="truncate text-sm text-neutral-700 dark:text-neutral-200">
                        {tagLabel(rate.tag, locale)}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                      {formatBdt(rate.amount_per_day)}
                      <span className="ml-1 text-[10px] font-medium text-neutral-400">
                        /{t("pages.adminDashboard.rates.day")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </motion.div>
    </PagePane>
  );
}
