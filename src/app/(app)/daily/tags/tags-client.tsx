"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconPrinter,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegisterBoard, PaintTagSelect } from "@/components/daily/register-board";
import { MonthRegisterPrint } from "@/components/daily/month-register-print";
import { useStore } from "@/hooks/use-store";
import { RANKS, WINGS } from "@/lib/constants";
import {
  daysInMonth,
  monthKey,
  nextISODate,
  parseMonthInput,
  todayISO,
  dateInMonth,
} from "@/lib/date";
import {
  approveCarryForward,
  clearTag,
  findPriorTag,
  getAssignment,
  isCarrySuppressed,
  isDateApproved,
  listByMonth,
  setTag,
  setTagRange,
} from "@/lib/store/assignments";
import { getProjectedMessEaters } from "@/lib/store/mess";
import { buildDailyRegister } from "@/lib/reports";
import { downloadDailyRegisterPdf } from "@/lib/download-daily-register-pdf";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { compareUsers } from "@/lib/store/users";
import type { DailyTag } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/shared/toast-provider";
import { cn } from "@/lib/utils";

export default function TagsPageClient() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = parseMonthInput(monthParam ?? monthKey());
  const today = todayISO();
  const dayCount = daysInMonth(month);
  const currentMonth = monthKey();
  const canApprove = month === currentMonth;
  const approveDate = canApprove ? today : dateInMonth(month, dayCount);
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const [paintTag, setPaintTag] = useState<DailyTag | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const setMonth = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", next);
      params.delete("date");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const users = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.users
      .filter((u) => {
        if (u.approval_status !== "approved") return false;
        if (!showInactive && u.status !== "1") return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [state.users, showInactive, q, rank, wing]);

  const assignments = useMemo(
    () => listByMonth(month),
    [state.assignments, month],
  );

  const register = useMemo(
    () => buildDailyRegister(month, users),
    [month, users, state.assignments],
  );

  const priorByUser = useMemo(() => {
    const map = new Map<string, DailyTag>();
    const first = dateInMonth(month, 1);
    for (const u of users) {
      const prior = findPriorTag(u.id, first);
      if (prior) map.set(u.id, prior);
    }
    return map;
  }, [users, month, state.assignments]);

  const approvePending = useMemo(() => {
    if (!canApprove) return 0;
    return users.filter((u) => {
      const suppressed = isCarrySuppressed(u.id, approveDate);
      const has = Boolean(getAssignment(u.id, approveDate));
      if (has && !suppressed) return false;
      return Boolean(findPriorTag(u.id, approveDate));
    }).length;
  }, [
    users,
    approveDate,
    canApprove,
    state.assignments,
    state.suppressed_carries,
  ]);

  const dayApproved = useMemo(
    () => (canApprove ? isDateApproved(approveDate) : false),
    [canApprove, approveDate, state.approved_dates],
  );

  /** Active until Daily confirms today; any edit un-approves. */
  const approveEnabled = canApprove && (!dayApproved || approvePending > 0);

  const taggedCells = useMemo(() => {
    const ids = new Set(users.map((u) => u.id));
    return assignments.filter((a) => ids.has(a.user_id)).length;
  }, [assignments, users]);

  const tomorrowMess = useMemo(() => {
    const date = nextISODate(today);
    return getProjectedMessEaters(date);
  }, [today, state.assignments, state.users, state.suppressed_carries]);

  const capacity = users.length * dayCount;

  function onTagChange(userId: string, date: string, tag: DailyTag | "") {
    if (!tag) clearTag(userId, date);
    else setTag(userId, date, tag);
  }

  function onPaintRange(userId: string, dates: string[], tag: DailyTag | "") {
    setTagRange(userId, dates, tag);
  }

  function onApproveDay() {
    const count = approveCarryForward(
      users.map((u) => u.id),
      approveDate,
    );
    toast(
      count > 0
        ? t("daily.approveDayToast", { count, date: approveDate })
        : t("daily.approveDayDone", { date: approveDate }),
      "success",
    );
  }

  function onExportPdf() {
    if (!register.rows.length) return;
    downloadDailyRegisterPdf({
      month,
      dayCount: register.dayCount,
      rows: register.rows,
      filename: `attendance-register-${month}.pdf`,
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !register.rows.length) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `attendance-register-${month}.pdf`,
        "landscape",
      );
    } finally {
      setPrinting(false);
    }
  }

  const fieldClass =
    "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5 print:border-0 print:p-0">
      <div className="pointer-events-none fixed left-[-10000px] top-0 w-[1400px]">
        <MonthRegisterPrint
          ref={printRef}
          month={month}
          dayCount={register.dayCount}
          rows={register.rows}
          preview
        />
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5 no-print"
      >
        <PageHeader
          title={t("pages.dailyTags.title")}
          subtitle={t("pages.dailyTags.subtitle", { month })}
          center={<DailyTabs />}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <MiniStat
                label={t("daily.rosterStatAll")}
                value={String(users.length)}
                accent
              />
              <MiniStat
                label={t("daily.registerCapacity")}
                value={`${taggedCells}/${capacity}`}
              />
              <MiniStat
                label={t("daily.tomorrowMess")}
                value={String(tomorrowMess.eaters.length)}
                accent
              />
              <Button
                variant="outline"
                size="sm"
                className="h-auto rounded-lg px-2.5 py-1.5"
                onClick={() => setShowInactive((v) => !v)}
                aria-pressed={showInactive}
              >
                {showInactive ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {showInactive
                    ? t("daily.hideInactive")
                    : t("daily.showInactive")}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto rounded-lg px-2.5 py-1.5"
                onClick={onExportPdf}
                disabled={!register.rows.length}
              >
                <IconDownload className="h-4 w-4" />
                {t("daily.exportPdf")}
              </Button>
              <Button
                variant="cta"
                size="sm"
                className="h-auto rounded-lg px-2.5 py-1.5"
                onClick={() => void onPrint()}
                disabled={!register.rows.length || printing}
              >
                <IconPrinter className="h-4 w-4" />
                {t("mess.print")}
              </Button>
            </div>
          }
        />

        <div className="flex w-full flex-wrap items-center gap-2.5 rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div className="min-w-[14rem] flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cc.searchPlaceholder")}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div className="w-44 shrink-0">
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={cn(fieldClass, "w-full pl-8")}
              />
            </div>
          </div>
          <div className="w-[9.5rem] shrink-0">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allRank")}</SelectItem>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[9rem] shrink-0">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allWing")}</SelectItem>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ClearFiltersButton
            disabled={!q.trim() && rank === "all" && wing === "all"}
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
            }}
          />
          <div className="hidden w-[9rem]" aria-hidden>
            <PaintTagSelect
              paintTag={paintTag}
              onPaintTagChange={setPaintTag}
              triggerClassName={cn(fieldClass, "w-full font-mono font-bold")}
            />
          </div>
        </div>

        {users.length === 0 ? (
          <EmptyState title={t("daily.emptyTags")} />
        ) : (
          <RegisterBoard
            users={users}
            month={month}
            dayCount={dayCount}
            assignments={assignments}
            todayISO={today}
            paintTag={paintTag}
            onPaintTagChange={setPaintTag}
            onTagChange={onTagChange}
            onPaintRange={onPaintRange}
            priorByUser={priorByUser}
            suppressedCarries={state.suppressed_carries ?? []}
            onApproveDay={onApproveDay}
            approvePending={approvePending}
            approveEnabled={approveEnabled}
            dayApproved={dayApproved}
            canApprove={canApprove}
          />
        )}
      </motion.div>
    </PagePane>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
