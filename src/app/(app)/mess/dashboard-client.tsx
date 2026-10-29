"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconCake,
  IconCheck,
  IconClockHour4,
  IconSearch,
  IconSettings,
  IconSoup,
  IconTags,
  IconUser,
} from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PagePane } from "@/components/shared/page-pane";
import { MessPageTabs } from "@/components/layout/mess-tabs";
import { SettingsWingFilter } from "@/components/shared/settings-catalog-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { useStore } from "@/hooks/use-store";
import { isApiEnabled, isCcApiEnabled } from "@/lib/api/mode";
import { isOldPublicApiHost } from "@/lib/api/compat";
import {
  ledgerRowApiToLedgerRow,
  listMessLedger,
} from "@/lib/api/mess";
import {
  fetchMessCheckins,
  messCheckinMembers,
  type MessCheckinsData,
} from "@/lib/api/mess-checkins";
import { listPritibhojEventsApi } from "@/lib/api/pritibhoj";
import { MESS_LEDGER_TAGS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { buildRangeLedger, type LedgerRow } from "@/lib/reports";
import { listGuestMeals } from "@/lib/store/guest-meals";
import { listMealAssigns } from "@/lib/store/meal-assigns";
import { listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import {
  memberFormWing,
  memberMatchesWingFilter,
} from "@/lib/store/org-options";
import {
  eventManpower,
  listPritibhojEvents,
  replaceLocalPritibhojEvents,
} from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";
import type { MealShiftId, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const BRANCH_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
  "#fb7185",
];
const DONUT_CONSUMED = "#f97316";
const DONUT_REST = "#e2e8f0";

type ActivityRow = {
  id: string;
  name: string;
  code: string;
  wing: string;
  shiftId: MealShiftId;
  time: string;
  kind: "consumption" | "guest" | "group";
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function avatarTone(seed: string) {
  const tones = [
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-800",
    "bg-rose-100 text-rose-700",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i)) % tones.length;
  return tones[h]!;
}

function formatStamp(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date}, ${time}`;
}

export default function MessDashboardClient() {
  const t = useT();
  const { locale } = useI18n();
  const { session } = useSession();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const apiOn = isApiEnabled();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-US";
  const today = todayISO();

  const [wing, setWing] = useState("all");
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [apiData, setApiData] = useState<MessCheckinsData | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [apiEvents, setApiEvents] = useState<PritibhojEvent[] | null>(null);

  const range = useMemo(() => {
    return dateFrom <= dateTo
      ? { from: dateFrom, to: dateTo }
      : { from: dateTo, to: dateFrom };
  }, [dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    if (!apiOn) {
      setApiData(null);
      setLedgerRows([]);
    } else {
      void Promise.all([
        fetchMessCheckins(range.from, range.to).catch(() => null),
        listMessLedger(range.from, range.to).catch(() => null),
      ]).then(([checkins, ledger]) => {
        if (cancelled) return;
        setApiData(checkins);
        setLedgerRows(ledger ? ledger.rows.map(ledgerRowApiToLedgerRow) : []);
      });
    }

    if (!isCcApiEnabled() || isOldPublicApiHost()) {
      setApiEvents(null);
    } else {
      void listPritibhojEventsApi()
        .then((rows) => {
          if (cancelled) return;
          const live = rows.filter((row) => !String(row.id).startsWith("pb_demo_"));
          replaceLocalPritibhojEvents(live);
          setApiEvents(live);
        })
        .catch(() => {
          if (!cancelled) setApiEvents([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [apiOn, range.from, range.to]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

  const members = useMemo(() => {
    if (apiData?.members?.length) return messCheckinMembers(apiData);
    return state.users;
  }, [apiData, state.users]);

  const memberById = useMemo(() => {
    const map = new Map<string, User>();
    for (const user of members) map.set(user.id, user);
    return map;
  }, [members]);

  const assigns = useMemo(() => {
    const rows = apiData?.assigns ?? listMealAssigns();
    return rows.filter((row) => {
      if (row.date < range.from || row.date > range.to) return false;
      if (shift !== "all" && row.shift_id !== shift) return false;
      const user = memberById.get(row.member_id);
      if (wing !== "all" && !memberMatchesWingFilter(user?.wing ?? "", wing)) {
        return false;
      }
      return true;
    });
  }, [apiData, range, shift, wing, memberById, state.meal_assigns, state.wing_parent]);

  const guests = useMemo(() => {
    const rows = apiData?.guests ?? listGuestMeals();
    return rows.filter((row) => {
      if (row.date < range.from || row.date > range.to) return false;
      if (shift !== "all" && row.shift_id !== shift) return false;
      return true;
    });
  }, [apiData, range, shift, state.guest_meals]);

  const liveLedgerRows = useMemo(() => {
    if (apiOn) return ledgerRows;
    return buildRangeLedger(range.from, range.to, MESS_LEDGER_TAGS, {
      carry: true,
      previewFuture: true,
    }).rows;
  }, [
    apiOn,
    ledgerRows,
    range.from,
    range.to,
    state.assignments,
    state.users,
    state.suppressed_carries,
  ]);

  const filteredLedgerRows = useMemo(
    () =>
      liveLedgerRows.filter((row) =>
        memberMatchesWingFilter(row.user.wing, wing),
      ),
    [liveLedgerRows, wing, state.wing_parent],
  );

  /** Same MS person-day count as mess ledger / Daily RR. */
  const planned = useMemo(() => {
    let ms = 0;
    for (const row of filteredLedgerRows) {
      for (const tag of row.days) {
        if (tag === "MS") ms += 1;
      }
    }
    return ms;
  }, [filteredLedgerRows]);

  const uniqueConsume = assigns.filter((row) => row.status === 1).length;
  const duplicates = assigns.filter((row) => row.status === 2).length;
  const guestCount = guests.length;
  const pritibhojEvents = apiEvents ?? listPritibhojEvents();
  const groupCount = useMemo(() => {
    return pritibhojEvents
      .filter((event) => event.date >= range.from && event.date <= range.to)
      .reduce((sum, event) => {
        const sheetTotal = [...event.main_rows, ...event.admin_rows].reduce(
          (s, row) => s + (row.total || 0),
          0,
        );
        return sum + (sheetTotal || eventManpower(event));
      }, 0);
  }, [pritibhojEvents, range]);
  const otherMeals = guestCount + groupCount;

  const branchBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredLedgerRows) {
      let ms = 0;
      for (const tag of row.days) {
        if (tag === "MS") ms += 1;
      }
      if (!ms) continue;
      const label =
        memberFormWing(row.user.wing) || t("mess.dashboard.unknownBranch");
      counts.set(label, (counts.get(label) ?? 0) + ms);
    }
    const bars = [...counts.entries()]
      .map(([name, value], i) => ({
        name,
        value,
        fill: BRANCH_COLORS[i % BRANCH_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    if (bars.length) return bars;
    return [{ name: t("mess.dashboard.noBranch"), value: 0, fill: BRANCH_COLORS[0] }];
  }, [filteredLedgerRows, t]);

  const remaining = Math.max(0, planned - uniqueConsume);
  const donut = [
    { name: t("mess.dashboard.consumed"), value: uniqueConsume, fill: DONUT_CONSUMED },
    { name: t("mess.dashboard.remaining"), value: remaining || (planned ? 0 : 1), fill: DONUT_REST },
  ];

  const activities = useMemo(() => {
    const rows: ActivityRow[] = [];
    for (const row of assigns) {
      const user = memberById.get(row.member_id);
      rows.push({
        id: row.id,
        name: user?.name || t("mess.dashboard.unknownMember"),
        code: user?.rab_id || user?.personal_id || row.member_id,
        wing: memberFormWing(user?.wing ?? "") || "—",
        shiftId: row.shift_id,
        time: row.check_in_time,
        kind: "consumption",
      });
    }
    for (const row of guests) {
      rows.push({
        id: row.id,
        name: row.guest_name || t("mess.dashboard.guestMeal"),
        code: row.ref_info || row.guest_info || row.id,
        wing: t("mess.dashboard.guestMeal"),
        shiftId: row.shift_id,
        time: row.check_in_time,
        kind: "guest",
      });
    }
    for (const event of pritibhojEvents) {
      if (event.date < range.from || event.date > range.to) continue;
      rows.push({
        id: event.id,
        name: event.title || t("nav.pritibhoj"),
        code: event.occasion || event.org || event.id,
        wing: event.org || t("nav.pritibhoj"),
        shiftId: shifts[0]?.id ?? "lunch",
        time: event.date,
        kind: "group",
      });
    }
    rows.sort((a, b) => b.time.localeCompare(a.time));
    const query = search.trim().toLowerCase();
    return (query
      ? rows.filter((row) =>
          [row.name, row.code, row.wing].join(" ").toLowerCase().includes(query),
        )
      : rows
    ).slice(0, 8);
  }, [assigns, guests, memberById, pritibhojEvents, range, search, shifts, t]);

  const filtersDirty =
    wing !== "all" || shift !== "all" || dateFrom !== today || dateTo !== today;

  function clearFilters() {
    setWing("all");
    setShift("all");
    setDateFrom(today);
    setDateTo(today);
    setSearch("");
  }

  const shiftName = (id: MealShiftId) =>
    mealShiftLabel(id, shifts.find((s) => s.id === id)?.name ?? id, t);

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-sky-50 to-violet-50 p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-sky-950/30 dark:to-violet-950/40">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              {t("pages.messDashboard.title")}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              <IconUser className="h-3.5 w-3.5" />
              {session?.role ? t(`roles.${session.role}`) : t("roles.mess")}
            </span>
          </div>
          <div className="flex min-w-0 justify-center overflow-x-auto">
            <MessPageTabs />
          </div>
          {searchOpen ? (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("mess.dashboard.searchPlaceholder")}
              className="h-9 w-52 rounded-full lg:justify-self-end"
              autoFocus
              onBlur={() => {
                if (!search.trim()) setSearchOpen(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 lg:justify-self-end dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={t("common.search")}
            >
              <IconSearch className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/70 to-amber-50/60 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] dark:border-sky-900/50 dark:from-neutral-950 dark:via-sky-950/20 dark:to-amber-950/20">
          <FilterField label={t("mess.dashboard.branch")}>
            <SettingsWingFilter
              value={wing}
              onChange={setWing}
              rootsOnly
              namesOnly
              className="w-full"
              triggerClassName="h-10 w-full rounded-xl"
              placeholder={t("mess.dashboard.allBranches")}
              clearLabel={t("mess.dashboard.allBranches")}
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.shift")}>
            <Select
              value={shift}
              onValueChange={(value) => setShift(value as MealShiftId | "all")}
            >
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder={t("mess.dashboard.allShifts")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allShifts")}</SelectItem>
                {shifts.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {mealShiftLabel(row.id, row.name, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t("mess.dashboard.fromDate")}>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value || today)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.toDate")}>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value || today)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl"
              disabled={!filtersDirty}
              onClick={clearFilters}
            >
              {t("mess.dashboard.clearFilters")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("mess.dashboard.plannedMeals")}
            value={planned}
            icon={<IconSoup className="h-4 w-4" />}
            tone="emerald"
            hint={t("mess.totalMs")}
          />
          <StatCard
            label={t("mess.dashboard.totalConsumption")}
            value={uniqueConsume}
            icon={<IconActivity className="h-4 w-4" />}
            tone="sky"
          />
          <StatCard
            label={t("mess.dashboard.duplicateAttempts")}
            value={duplicates}
            icon={<IconAlertTriangle className="h-4 w-4" />}
            tone="amber"
          />
          <StatCard
            label={t("mess.dashboard.otherMeals")}
            value={otherMeals}
            icon={<IconCheck className="h-4 w-4" />}
            tone="violet"
            hint={t("mess.dashboard.otherMealsHint", {
              guest: guestCount,
              group: groupCount,
            })}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/70 p-4 dark:border-emerald-900/50 dark:from-neutral-950 dark:to-emerald-950/30">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {t("mess.dashboard.branchOverview")}
            </h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {branchBars.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-white to-orange-50/70 p-4 dark:border-orange-900/50 dark:from-neutral-950 dark:to-orange-950/30">
            <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
              {t("mess.dashboard.mealDistribution")}
            </h2>
            <div className="relative mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={68}
                    outerRadius={86}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    {donut.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {uniqueConsume}/{planned}
                </p>
              </div>
            </div>
            <p className="mt-1 text-center text-xs text-neutral-500">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-400" />
              {shift === "all"
                ? t("mess.dashboard.lunchesOf", {
                    consumed: uniqueConsume,
                    planned,
                  })
                : t("mess.dashboard.shiftOf", {
                    shift: shiftName(shift),
                    consumed: uniqueConsume,
                    planned,
                  })}
            </p>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white to-violet-50/70 p-4 dark:border-violet-900/50 dark:from-neutral-950 dark:to-violet-950/30">
            <h2 className="text-sm font-semibold text-violet-800 dark:text-violet-200">
              {t("mess.dashboard.quickActions")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuickAction
                href="/mess/ledger"
                icon={<IconTags className="h-5 w-5" />}
                tone="sky"
                title={t("nav.messLedger")}
                hint={t("mess.dashboard.openLedgerHint")}
              />
              <QuickAction
                href="/mess/pritibhoj"
                icon={<IconCake className="h-5 w-5" />}
                tone="rose"
                title={t("nav.pritibhoj")}
                hint={t("mess.dashboard.newPritibhojHint")}
              />
              <QuickAction
                href="/mess/shifts"
                icon={<IconClockHour4 className="h-5 w-5" />}
                tone="emerald"
                title={t("nav.shifts")}
                hint={t("mess.dashboard.createShiftHint")}
              />
              <QuickAction
                href="/settings"
                icon={<IconSettings className="h-5 w-5" />}
                tone="violet"
                title={t("nav.settings")}
                hint={t("mess.dashboard.openSettingsHint")}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white to-sky-50/70 p-4 dark:border-sky-900/50 dark:from-neutral-950 dark:to-sky-950/30">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                {t("mess.dashboard.recentActivities")}
              </h2>
              <Link
                href="/mess/ledger"
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                {t("mess.dashboard.seeMore")}
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {activities.length === 0 ? (
                <li className="py-8 text-center text-sm text-neutral-500">
                  {t("mess.dashboard.noActivity")}
                </li>
              ) : (
                activities.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 rounded-xl px-1 py-1.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        avatarTone(row.name),
                      )}
                    >
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {row.name}
                        <span className="font-normal text-neutral-500">
                          {" "}
                          ({row.code})
                        </span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                        <span>{row.wing}</span>
                        <span>·</span>
                        <span>{shiftName(row.shiftId)}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[10px] font-semibold",
                            row.kind === "guest"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                              : row.kind === "group"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
                          )}
                        >
                          {row.kind === "guest"
                            ? t("mess.dashboard.guestMeal")
                            : row.kind === "group"
                              ? t("nav.pritibhoj")
                              : t("mess.dashboard.consumption")}
                        </span>
                      </p>
                    </div>
                    <p className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                      {formatStamp(row.time, dateLocale)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </motion.div>
    </PagePane>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "emerald" | "sky" | "amber" | "violet";
  hint?: string;
}) {
  const cardClass = {
    emerald:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-950 dark:border-emerald-900/60 dark:from-emerald-950/50 dark:to-teal-950/30 dark:text-emerald-50",
    sky: "border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-950 dark:border-sky-900/60 dark:from-sky-950/50 dark:to-blue-950/30 dark:text-sky-50",
    amber:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-950 dark:border-amber-900/60 dark:from-amber-950/50 dark:to-orange-950/30 dark:text-amber-50",
    violet:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-950 dark:border-violet-900/60 dark:from-violet-950/50 dark:to-fuchsia-950/30 dark:text-violet-50",
  }[tone];
  const toneClass = {
    emerald: "bg-white/80 text-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-200",
    sky: "bg-white/80 text-sky-600 dark:bg-sky-900/70 dark:text-sky-200",
    amber: "bg-white/80 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200",
    violet: "bg-white/80 text-violet-600 dark:bg-violet-900/70 dark:text-violet-200",
  }[tone];
  return (
    <div className={cn("flex items-start justify-between rounded-2xl border p-4 shadow-sm", cardClass)}>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-[11px] opacity-70">{hint}</p> : null}
      </div>
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", toneClass)}>
        {icon}
      </span>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  tone,
  title,
  hint,
}: {
  href: string;
  icon: ReactNode;
  tone: "violet" | "amber" | "emerald" | "sky" | "rose" | "orange";
  title: string;
  hint: string;
}) {
  const cardClass = {
    violet:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-100 hover:from-violet-100 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-fuchsia-950/20",
    amber:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 hover:from-amber-100 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-yellow-950/20",
    emerald:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 hover:from-emerald-100 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20",
    sky: "border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 hover:from-sky-100 dark:border-sky-900/50 dark:from-sky-950/40 dark:to-blue-950/20",
    rose: "border-rose-200 bg-gradient-to-br from-rose-50 to-pink-100 hover:from-rose-100 dark:border-rose-900/50 dark:from-rose-950/40 dark:to-pink-950/20",
    orange:
      "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 hover:from-orange-100 dark:border-orange-900/50 dark:from-orange-950/40 dark:to-amber-950/20",
  }[tone];
  const toneClass = {
    violet: "bg-white/80 text-violet-600 dark:bg-violet-900/70 dark:text-violet-200",
    amber: "bg-white/80 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200",
    emerald: "bg-white/80 text-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-200",
    sky: "bg-white/80 text-sky-600 dark:bg-sky-900/70 dark:text-sky-200",
    rose: "bg-white/80 text-rose-600 dark:bg-rose-900/70 dark:text-rose-200",
    orange: "bg-white/80 text-orange-600 dark:bg-orange-900/70 dark:text-orange-200",
  }[tone];
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center transition hover:shadow-sm",
        cardClass,
      )}
    >
      <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", toneClass)}>
        {icon}
      </span>
      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</span>
      <span className="text-[11px] text-neutral-600 dark:text-neutral-400">{hint}</span>
    </Link>
  );
}
