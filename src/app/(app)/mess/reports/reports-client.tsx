"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuilding,
  IconClockHour4,
  IconCoffee,
  IconDownload,
  IconFileReport,
  IconMoonStars,
  IconPrinter,
  IconRefresh,
  IconSun,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MessPageTabs } from "@/components/layout/mess-tabs";
import { MessReportsLetter } from "@/components/mess/mess-reports-letter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { isApiEnabled } from "@/lib/api/mode";
import {
  fetchMessCheckins,
  messCheckinMembers,
  type MessCheckinsData,
} from "@/lib/api/mess-checkins";

import { downloadCsv } from "@/lib/csv";
import { eachISODate, formatDateLong, monthDateBounds } from "@/lib/date";
import { listGuestMeals } from "@/lib/store/guest-meals";
import {
  isMealAssignStatus,
  listMealAssigns,
} from "@/lib/store/meal-assigns";
import { getMessEaters, listConsumedMemberIds } from "@/lib/store/mess";
import { getMealShift, listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import {
  fetchZkAttendance,
  fetchZkUsers,
  isZkDemoEnabled,
  type ZkAttendanceRow,
  type ZkUserRow,
} from "@/lib/api/zk-demo";
import { ApiClientError } from "@/lib/api/client";
import { zkAttendanceToReportRows } from "@/lib/zk/attendance-report";
import type { MealAssignStatus, MealShiftId, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { PAGE_SIZE } from "@/lib/pagination";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | MealAssignStatus;
type AudienceFilter = "all" | "member" | "guest";
type ViewFilter = "checkins" | "missing";
type ReportMode = "total" | "consume" | "duplicate" | "missing";

type ReportRow = {
  id: string;
  kind: "member" | "guest";
  date: string;
  check_in_time: string;
  shift_id: MealShiftId | null;
  name: string;
  rab_id: string;
  wing: string;
  rank: string;
  status: MealAssignStatus | null;
  info: string;
  ref: string;
  missing?: boolean;
};

function defaultRange() {
  return monthDateBounds();
}

function isAudienceFilter(v: string | null): v is AudienceFilter {
  return v === "all" || v === "member" || v === "guest";
}

function isViewFilter(v: string | null): v is ViewFilter {
  return v === "checkins" || v === "missing";
}

function isISODate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toReportMode(view: ViewFilter, status: StatusFilter): ReportMode {
  if (view === "missing") return "missing";
  if (status === 1) return "consume";
  if (status === 2) return "duplicate";
  return "total";
}

function shiftLabel(
  t: ReturnType<typeof useT>,
  shiftId: MealShiftId | null,
) {
  if (!shiftId) return "—";
  const shift = getMealShift(shiftId);
  return mealShiftLabel(shiftId, shift?.name ?? shiftId, t);
}

function ShiftChip({
  t,
  shiftId,
}: {
  t: ReturnType<typeof useT>;
  shiftId: MealShiftId | null;
}) {
  if (!shiftId) {
    return <span className="text-neutral-400">—</span>;
  }
  const label = shiftLabel(t, shiftId);
  const Icon =
    shiftId === "breakfast"
      ? IconCoffee
      : shiftId === "lunch"
        ? IconSun
        : shiftId === "dinner"
          ? IconMoonStars
          : IconClockHour4;
  const tone =
    shiftId === "breakfast"
      ? "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100"
      : shiftId === "lunch"
        ? "bg-sky-100 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100"
        : shiftId === "dinner"
          ? "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/50 dark:text-indigo-100"
          : "bg-violet-100 text-violet-950 dark:bg-violet-900/50 dark:text-violet-100";
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        tone,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" stroke={2} />
      {label}
    </Badge>
  );
}

function WingChip({ wing }: { wing: string }) {
  if (!wing) {
    return <span className="text-neutral-400">—</span>;
  }
  return (
    <Badge className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-950 dark:bg-teal-900/50 dark:text-teal-100">
      <IconBuilding className="h-3 w-3 shrink-0" stroke={2} />
      {wing}
    </Badge>
  );
}

function formatCheckInTime(iso: string, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MessReportsClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const { wings } = state;
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const zkOn = isZkDemoEnabled();
  const initial = defaultRange();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const statusParam = searchParams.get("status");
  const audienceParam = searchParams.get("audience");
  const viewParam = searchParams.get("view");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewFilter>(
    isViewFilter(viewParam) ? viewParam : "checkins",
  );
  const [audience, setAudience] = useState<AudienceFilter>(
    isAudienceFilter(audienceParam) ? audienceParam : "all",
  );
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [wing, setWing] = useState("all");
  const [status, setStatus] = useState<StatusFilter>(
    statusParam && isMealAssignStatus(statusParam)
      ? (Number(statusParam) as MealAssignStatus)
      : "all",
  );
  const [dateFrom, setDateFrom] = useState(
    isISODate(fromParam) ? fromParam : initial.from,
  );
  const [dateTo, setDateTo] = useState(
    isISODate(toParam) ? toParam : isISODate(fromParam) ? fromParam : initial.to,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [zkPunches, setZkPunches] = useState<ZkAttendanceRow[]>([]);
  const [zkUsers, setZkUsers] = useState<ZkUserRow[]>([]);
  const [zkLoading, setZkLoading] = useState(() => isZkDemoEnabled());
  const [zkTick, setZkTick] = useState(0);
  const [checkins, setCheckins] = useState<MessCheckinsData | null>(null);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (statusParam && isMealAssignStatus(statusParam)) {
      setStatus(Number(statusParam) as MealAssignStatus);
    } else {
      setStatus("all");
    }
    setPage(1);
  }, [statusParam]);

  useEffect(() => {
    if (isAudienceFilter(audienceParam)) {
      setAudience(audienceParam);
    } else {
      setAudience("all");
    }
    setPage(1);
  }, [audienceParam]);

  useEffect(() => {
    if (isViewFilter(viewParam)) {
      setView(viewParam);
      if (viewParam === "missing") {
        setAudience("member");
        setStatus("all");
      }
    } else {
      setView("checkins");
    }
    setPage(1);
  }, [viewParam]);

  useEffect(() => {
    if (isISODate(fromParam)) {
      setDateFrom(fromParam);
      setDateTo(isISODate(toParam) ? toParam : fromParam);
      setPage(1);
    }
  }, [fromParam, toParam]);

  const rangeBounds = useMemo(() => {
    return dateFrom <= dateTo
      ? { from: dateFrom, to: dateTo }
      : { from: dateTo, to: dateFrom };
  }, [dateFrom, dateTo]);

  const apiOn = isApiEnabled();
  const { source } = useReportSource({
    from: rangeBounds.from,
    to: rangeBounds.to,
  });

  useEffect(() => {
    if (!apiOn) {
      setCheckins(null);
      return;
    }
    let cancelled = false;
    fetchMessCheckins(rangeBounds.from, rangeBounds.to)
      .then((data) => {
        if (!cancelled) setCheckins(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setCheckins(null);
        toast(
          err instanceof ApiClientError
            ? err.detail
            : "Could not load mess check-ins from API.",
          "error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, rangeBounds.from, rangeBounds.to, toast]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    const live =
      apiOn && checkins
        ? messCheckinMembers(checkins)
        : apiOn && source
          ? source.users
          : state.users;
    for (const u of live) map.set(u.id, u);
    return map;
  }, [apiOn, checkins, source, state.users]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

  useEffect(() => {
    if (!zkOn) return;
    setAudience("member");
  }, [zkOn]);

  useEffect(() => {
    if (!zkOn) return;
    let cancelled = false;
    setZkLoading(true);
    void Promise.all([
      fetchZkAttendance({ from: rangeBounds.from, to: rangeBounds.to }),
      fetchZkUsers(),
    ])
      .then(([att, users]) => {
        if (cancelled) return;
        setZkPunches(att.items);
        setZkUsers(users.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setZkPunches([]);
        setZkUsers([]);
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load ZK attendance.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setZkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zkOn, rangeBounds.from, rangeBounds.to, zkTick, toast]);

  const zkClassified = useMemo(() => {
    if (!zkOn) return [];
    return zkAttendanceToReportRows(
      zkPunches,
      zkUsers,
      state.users,
      shifts,
    );
  }, [zkOn, zkPunches, zkUsers, state.users, shifts]);

  const missingRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const merged: ReportRow[] = [];
    for (const date of eachISODate(rangeBounds.from, rangeBounds.to)) {
      let ate: Set<string>;
      if (zkOn && zkClassified.length) {
        ate = new Set();
        for (const r of zkClassified) {
          if (r.date !== date || r.status !== 1 || !r.member_id) continue;
          if (shift !== "all" && r.shift_id !== shift) continue;
          ate.add(r.member_id);
        }
      } else if (apiOn && checkins) {
        ate = new Set();
        for (const row of checkins.assigns) {
          if (row.date !== date || row.status !== 1) continue;
          if (shift !== "all" && row.shift_id !== shift) continue;
          ate.add(row.member_id);
        }
      } else {
        ate = listConsumedMemberIds(date, shift);
      }
      const eaters =
        apiOn && source
          ? source.users.filter((u) => {
              if (u.approval_status !== "approved" || u.status !== "1") {
                return false;
              }
              const boro = (checkins?.boro_khana_dates ?? []).includes(date);
              if (boro) return true;
              return source.assignments.some(
                (a) => a.user_id === u.id && a.date === date && a.tag === "MS",
              );
            })
          : getMessEaters(date);
      for (const u of eaters) {
        if (ate.has(u.id)) continue;
        if (wing !== "all" && u.wing !== wing) continue;
        if (
          query &&
          ![u.name, u.rab_id, u.rank, u.wing]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ) {
          continue;
        }
        merged.push({
          id: `missing-${date}-${u.id}`,
          kind: "member",
          date,
          check_in_time: "",
          shift_id: shift === "all" ? null : shift,
          name: u.name,
          rab_id: u.rab_id,
          wing: u.wing,
          rank: u.rank,
          status: null,
          info: "",
          ref: "",
          missing: true,
        });
      }
    }
    return merged.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name);
    });
  }, [
    q,
    rangeBounds,
    shift,
    wing,
    zkOn,
    zkClassified,
    state.meal_assigns,
    state.users,
    state.assignments,
    state.boro_khana_dates,
    apiOn,
    checkins,
    source,
  ]);

  const checkinBase = useMemo(() => {
    const query = q.trim().toLowerCase();
    const merged: ReportRow[] = [];

    if (audience !== "guest") {
      if (zkOn) {
        for (const row of zkClassified) {
          if (shift !== "all" && row.shift_id !== shift) continue;
          if (wing !== "all" && row.wing !== wing) continue;
          if (
            query &&
            ![row.name, row.rab_id, row.rank, row.wing, row.zk_user_id, row.info]
              .join(" ")
              .toLowerCase()
              .includes(query)
          ) {
            continue;
          }
          merged.push({
            id: row.id,
            kind: "member",
            date: row.date,
            check_in_time: row.check_in_time,
            shift_id: row.shift_id,
            name: row.name,
            rab_id: row.rab_id,
            wing: row.wing,
            rank: row.rank,
            status: row.status,
            info: row.info,
            ref: row.ref,
          });
        }
      } else {
        const assigns =
          apiOn && checkins ? checkins.assigns : listMealAssigns();
        for (const row of assigns) {
          if (row.date < rangeBounds.from || row.date > rangeBounds.to) continue;
          if (shift !== "all" && row.shift_id !== shift) continue;
          const member = usersById.get(row.member_id);
          if (wing !== "all" && member?.wing !== wing) continue;
          if (
            query &&
            ![member?.name, member?.rab_id, member?.rank, member?.wing]
              .join(" ")
              .toLowerCase()
              .includes(query)
          ) {
            continue;
          }
          merged.push({
            id: row.id,
            kind: "member",
            date: row.date,
            check_in_time: row.check_in_time,
            shift_id: row.shift_id,
            name: member?.name ?? "—",
            rab_id: member?.rab_id ?? "",
            wing: member?.wing ?? "",
            rank: member?.rank ?? "",
            status: row.status,
            info: "",
            ref: "",
          });
        }
      }
    }

    if (!zkOn && audience !== "member") {
      const guests =
        apiOn && checkins ? checkins.guests : listGuestMeals();
      for (const row of guests) {
        if (row.date < rangeBounds.from || row.date > rangeBounds.to) continue;
        if (shift !== "all" && row.shift_id !== shift) continue;
        if (wing !== "all") continue;
        if (
          query &&
          ![row.guest_name, row.guest_info, row.ref_info]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ) {
          continue;
        }
        merged.push({
          id: row.id,
          kind: "guest",
          date: row.date,
          check_in_time: row.check_in_time,
          shift_id: row.shift_id,
          name: row.guest_name,
          rab_id: "",
          wing: "",
          rank: "",
          status: null,
          info: row.guest_info,
          ref: row.ref_info,
        });
      }
    }

    return merged.sort((a, b) => {
      const byTime = b.check_in_time.localeCompare(a.check_in_time);
      if (byTime !== 0) return byTime;
      return b.id.localeCompare(a.id);
    });
  }, [
    state.meal_assigns,
    state.guest_meals,
    q,
    rangeBounds,
    shift,
    wing,
    audience,
    usersById,
    zkOn,
    zkClassified,
    apiOn,
    checkins,
  ]);

  const checkinRows = useMemo(() => {
    if (status === "all") return checkinBase;
    return checkinBase.filter((r) => r.status === status);
  }, [checkinBase, status]);

  const rows = view === "missing" ? missingRows : checkinRows;
  const reportMode = toReportMode(view, status);

  const uniqueCount = checkinBase.filter((r) => r.status === 1).length;
  const dupCount = checkinBase.filter((r) => r.status === 2).length;
  const checkinTotal = checkinBase.length;
  const missingCount = missingRows.length;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function resetPage() {
    setPage(1);
  }

  function setViewMode(next: ViewFilter) {
    setView(next);
    if (next === "missing") {
      setAudience("member");
      setStatus("all");
    }
    resetPage();
  }

  function setReportMode(mode: ReportMode) {
    if (mode === "missing") {
      setViewMode("missing");
      return;
    }
    setView("checkins");
    setStatus(mode === "consume" ? 1 : mode === "duplicate" ? 2 : "all");
    resetPage();
  }

  function onExport() {
    const header = [
      t("mess.reports.colType"),
      t("mess.planning.date"),
      t("mess.reports.colTime"),
      t("mess.colName"),
      t("mess.colRabId"),
      t("mess.colRank"),
      t("mess.colWing"),
      t("mess.guests.colInfo"),
      t("mess.guests.colRef"),
      t("mess.reports.colShift"),
      t("mess.reports.colStatus"),
    ];
    const body = rows.map((row) => [
      row.missing
        ? t("mess.reports.didNotConsume")
        : row.kind === "guest"
          ? t("mess.reports.audienceGuest")
          : t("mess.reports.audienceMember"),
      row.date,
      formatCheckInTime(row.check_in_time, dateLocale),
      row.name,
      row.rab_id,
      row.rank,
      row.wing,
      row.info,
      row.ref,
      shiftLabel(t, row.shift_id),
      row.missing
        ? t("mess.reports.didNotConsume")
        : row.status === 1
          ? t("mess.reports.unique")
          : row.status === 2
            ? t("mess.reports.duplicate")
            : "",
    ]);
    downloadCsv(
      `meal-reports-${view}-${rangeBounds.from}_${rangeBounds.to}.csv`,
      [header, ...body],
    );
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !rows.length) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `meal-reports-${view}-${rangeBounds.from}_${rangeBounds.to}.pdf`,
        "landscape",
        { skipInlineStyles: true },
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-sky-50/50 to-emerald-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messReports.title")}
              subtitle={
                zkOn
                  ? `${t("pages.messReports.subtitle", { count: rows.length })}${
                      zkLoading
                        ? ` · ${t("mess.reports.zkLoading")}`
                        : ` · ${t("mess.reports.zkSource")}`
                    }`
                  : t("pages.messReports.subtitle", { count: rows.length })
              }
              center={<MessPageTabs />}
              actions={
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl"
                    onClick={onExport}
                    disabled={!rows.length}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    {t("mess.exportCsv")}
                  </Button>
                  <Button
                    type="button"
                    variant="cta"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                    onClick={() => void onPrint()}
                    disabled={!rows.length || printing}
                  >
                    <IconPrinter className="h-3.5 w-3.5" />
                    {t("mess.print")}
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <SearchFilterBar
          className="no-print"
          search={q}
          onSearchChange={(v) => {
            setQ(v);
            resetPage();
          }}
          searchPlaceholder={t("mess.reports.searchPlaceholder")}
          trailing={
            zkOn ? (
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="h-10 shrink-0 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                onClick={() => setZkTick((n) => n + 1)}
                disabled={zkLoading}
              >
                <IconRefresh
                  className={cn("h-4 w-4", zkLoading && "animate-spin")}
                />
                {t("mess.reports.zkRefresh")}
              </Button>
            ) : null
          }
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            maxSpanDays={31}
            onChange={({ from, to }) => {
              if (!from && !to) {
                const next = defaultRange();
                setDateFrom(next.from);
                setDateTo(next.to);
              } else {
                setDateFrom(from);
                setDateTo(to || from);
              }
              resetPage();
            }}
            label={t("common.dateRange")}
            triggerClassName="min-w-[10rem] w-[10rem] px-2 text-xs"
          />
          <div className="w-[13rem] shrink-0">
            <Select
              value={reportMode}
              onValueChange={(v) => setReportMode(v as ReportMode)}
            >
              <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">
                  {t("mess.reports.checkIns")} ({checkinTotal})
                </SelectItem>
                <SelectItem value="consume">
                  {t("mess.reports.unique")} ({uniqueCount})
                </SelectItem>
                <SelectItem value="duplicate">
                  {t("mess.reports.duplicate")} ({dupCount})
                </SelectItem>
                <SelectItem value="missing">
                  {t("mess.reports.didNotConsume")} ({missingCount})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {view === "checkins" && !zkOn ? (
            <div className="w-[10rem] shrink-0">
              <Select
                value={audience}
                onValueChange={(v) => {
                  setAudience(v as AudienceFilter);
                  if (v === "guest") {
                    setStatus("all");
                    setWing("all");
                  }
                  resetPage();
                }}
              >
                <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("mess.reports.audienceAll")}
                  </SelectItem>
                  <SelectItem value="member">
                    {t("mess.reports.audienceMember")}
                  </SelectItem>
                  <SelectItem value="guest">
                    {t("mess.reports.audienceGuest")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="w-[10rem] shrink-0">
            <Select
              value={shift}
              onValueChange={(v) => {
                setShift(v as MealShiftId | "all");
                resetPage();
              }}
            >
              <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allShift")}</SelectItem>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {mealShiftLabel(s.id, s.name, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {view === "missing" || audience !== "guest" ? (
            <div className="w-[10rem] shrink-0">
              <Select
                value={wing}
                onValueChange={(v) => {
                  setWing(v);
                  resetPage();
                }}
              >
                <SelectTrigger className={cn(searchFilterFieldClass, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allWing")}</SelectItem>
                  {wings.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </SearchFilterBar>

        {zkOn && zkLoading ? (
          <ReportsTableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              view === "missing"
                ? t("mess.reports.emptyMissing")
                : t("mess.reports.empty")
            }
            description={
              view === "missing"
                ? t("mess.reports.emptyMissingHint")
                : t("mess.reports.emptyHint")
            }
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconFileReport className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("pages.messReports.title")}
              </h2>
              <span className="ml-auto text-xs tabular-nums text-neutral-500">
                {pageRows.length}/{rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 print:bg-white">
                  <tr>
                    <th className="px-4 py-3">{t("mess.reports.colType")}</th>
                    <th className="px-4 py-3">{t("mess.colName")}</th>
                    <th className="px-4 py-3">{t("mess.planning.date")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colTime")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colShift")}</th>
                    <th className="px-4 py-3">{t("mess.colWing")}</th>
                    <th className="px-4 py-3">{t("mess.reports.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <td className="px-4 py-3">
                        {row.missing ? (
                          <Badge className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-950 dark:bg-orange-900/50 dark:text-orange-100">
                            {t("mess.reports.didNotConsume")}
                          </Badge>
                        ) : row.kind === "guest" ? (
                          <Badge className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                            {t("mess.reports.audienceGuest")}
                          </Badge>
                        ) : (
                          <Badge className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-950 dark:bg-sky-900/50 dark:text-sky-100">
                            {t("mess.reports.audienceMember")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar name={row.name || "?"} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                              {row.name}
                            </p>
                            <p className="truncate text-xs text-neutral-500">
                              {row.kind === "guest"
                                ? row.info || row.ref || "—"
                                : row.rab_id || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-800 dark:text-neutral-200">
                          {formatDateLong(row.date, dateLocale)}
                        </p>
                        <p className="font-mono text-xs text-neutral-500">
                          {row.date}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {formatCheckInTime(row.check_in_time, dateLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <ShiftChip t={t} shiftId={row.shift_id} />
                      </td>
                      <td className="px-4 py-3">
                        <WingChip wing={row.wing} />
                      </td>
                      <td className="px-4 py-3">
                        {row.missing ? (
                          <Badge className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-950 dark:bg-orange-900/50 dark:text-orange-100">
                            {t("mess.reports.didNotConsume")}
                          </Badge>
                        ) : row.status === 1 ? (
                          <Badge className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                            {t("mess.reports.unique")}
                          </Badge>
                        ) : row.status === 2 ? (
                          <Badge className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-950 dark:bg-rose-900/50 dark:text-rose-100">
                            {t("mess.reports.duplicate")}
                          </Badge>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MessReportsLetter
              ref={printRef}
              rows={rows}
              from={rangeBounds.from}
              to={rangeBounds.to}
            />
            <ListPagination
              className="no-print"
              page={safePage}
              totalPages={totalPages}
              total={rows.length}
              from={(safePage - 1) * pageSize + 1}
              to={Math.min(safePage * pageSize, rows.length)}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}

function ReportsTableSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-3 w-12" />
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex w-full items-center gap-3 px-4 py-3 sm:gap-4"
          >
            <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-[1.4] space-y-1.5">
              <Skeleton className="h-3.5 w-full max-w-[12rem]" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="hidden min-w-0 flex-1 space-y-1.5 sm:block">
              <Skeleton className="h-3.5 w-full max-w-[9rem]" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="hidden h-3.5 w-16 shrink-0 md:block" />
            <Skeleton className="h-5 w-[4.5rem] shrink-0 rounded-md" />
            <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}
