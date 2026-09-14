"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFlame,
  IconSearch,
  IconShield,
  IconSoup,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/shared/list-pagination";
import { FormattedDateInput } from "@/components/shared/date-picker";
import { dateInMonth, eachISODate, formatDateDisplay, formatDateLong } from "@/lib/date";
import type { DailyAssignment, DailyTag, TrgTone, User } from "@/lib/types";
import type { Locale } from "@/i18n";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { usePagination } from "@/hooks/use-pagination";
import { useStore } from "@/hooks/use-store";
import {
  canAssignOnDate,
  canWriteMfrLockedTag,
  isMfrLocked,
  isUserInactiveOnDate,
  FR_TAG,
  MFR_TAG,
} from "@/lib/store/daily";
import { setBoroKhana } from "@/lib/store/boro-khana";
import { getProjectedTagMembers } from "@/lib/store/mess";
import { listAllTags } from "@/lib/store/rates";
import { compareUsers } from "@/lib/store/users";
import { downloadDayMsCdPdf } from "@/lib/download-day-ms-cd-pdf";
import { TAG_CELL, tagCellClass } from "@/lib/tag-colors";
import { tagDisplayClass } from "@/lib/trg-tone";
import {
  isTrgTag,
  needsTrgSardaPrompt,
  needsTrgTrainingPrompt,
  resolveTrgTone,
} from "@/lib/trg-tone";
import { ColoredTagGrid } from "@/components/daily/colored-tag-grid";
import { TrgSardaDialog } from "@/components/daily/trg-sarda-dialog";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { createTagRequestApi, requestToTagRequest } from "@/lib/api/tag-requests";
import {
  createDutyTagRequest,
  dutyTagQueue,
  pendingDutyByUserDate,
  upsertLocalTagRequest,
} from "@/lib/store/tag-requests";
import { cn } from "@/lib/utils";

export { TAG_CELL, tagCellClass };

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type DragStroke = {
  userId: string;
  startDate: string;
  endDate: string;
};

type RangeMenu = {
  userId: string;
  userName: string;
  dates: string[];
  anchorDate: string;
  fromDate: string;
  toDate: string;
  /** Single-cell ghost carry (accept) */
  ghostTag?: DailyTag;
  storedTag?: DailyTag;
};


/** Sticky result cols (tag day-counts + All) — match consume ledger. */
const NAME_STICKY_LEFT = 224;
const NAME_STICKY_W = 173;
const RESULT_TAG_W = 40;
const RESULT_LEFT0 = NAME_STICKY_LEFT + NAME_STICKY_W;

export function RegisterBoard({
  users,
  month,
  dayCount,
  assignments,
  todayISO,
  paintTag: _paintTag,
  onPaintTagChange: _onPaintTagChange,
  onTagChange,
  onPaintRange,
  priorByUser,
  suppressedCarries,
  dateFrom = "",
  dateTo = "",
  boroKhanaDates,
  onBoroKhanaToggle,
  projectedTagMembers,
}: {
  users: User[];
  month: string;
  dayCount: number;
  assignments: DailyAssignment[];
  todayISO: string;
  paintTag: DailyTag | "";
  onPaintTagChange: (tag: DailyTag | "") => void;
  onTagChange: (userId: string, date: string, tag: DailyTag | "") => void;
  onPaintRange: (userId: string, dates: string[], tag: DailyTag | "") => void;
  priorByUser: Map<string, DailyTag>;
  suppressedCarries: string[];
  /** Inclusive ISO range — empty = show all month days. */
  dateFrom?: string;
  dateTo?: string;
  boroKhanaDates?: string[];
  onBoroKhanaToggle?: (date: string, on: boolean) => void;
  projectedTagMembers?: (tag: DailyTag, date: string) => User[];
}) {
  void _paintTag;
  void _onPaintTagChange;

  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  /** Sticky tag-count + All cols (consume-style totals). */
  const [showResultCols, setShowResultCols] = useState(false);
  const reduceMotion = useReducedMotion();
  const resultColMotion = reduceMotion
    ? undefined
    : "width 220ms ease, min-width 220ms ease, max-width 220ms ease, opacity 180ms ease, padding 220ms ease, border-width 220ms ease";
  function resultColStyle(index: number): CSSProperties {
    const open = showResultCols;
    const w = open ? RESULT_TAG_W : 0;
    return {
      left: RESULT_LEFT0 + index * RESULT_TAG_W,
      width: w,
      minWidth: w,
      maxWidth: w,
      opacity: open ? 1 : 0,
      padding: open ? undefined : 0,
      overflow: "hidden",
      borderRightWidth: open ? undefined : 0,
      pointerEvents: open ? "auto" : "none",
      transition: resultColMotion,
    };
  }
  const bkDates = useMemo(
    () => new Set(boroKhanaDates ?? state.boro_khana_dates ?? []),
    [boroKhanaDates, state.boro_khana_dates],
  );
  /** Full month ISO list — seed for carry roll when no range filter. */
  const monthDates = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, i) => dateInMonth(month, i + 1)),
    [dayCount, month],
  );
  /** Columns: full selected range (cross-month) or whole open month. */
  const columnDates = useMemo(() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (from && to) return eachISODate(from, to);
    if (from) return [from];
    if (to) return [to];
    return monthDates;
  }, [monthDates, dateFrom, dateTo]);

  const crossMonth = useMemo(() => {
    if (columnDates.length < 2) return false;
    return (
      columnDates[0].slice(0, 7) !==
      columnDates[columnDates.length - 1].slice(0, 7)
    );
  }, [columnDates]);

  const resultTags = useMemo(() => listAllTags(), [state.rates]);

  const suppressedSet = useMemo(
    () => new Set(suppressedCarries),
    [suppressedCarries],
  );

  const byUserDate = useMemo(() => {
    const map = new Map<string, { tag: DailyTag; trg_tone?: TrgTone }>();
    for (const a of assignments) {
      map.set(`${a.user_id}|${a.date}`, {
        tag: a.tag,
        trg_tone: a.trg_tone,
      });
    }
    return map;
  }, [assignments]);

  const pendingByUserDate = useMemo(
    () => pendingDutyByUserDate(state.tag_requests),
    [state.tag_requests],
  );

  const [dayPeek, setDayPeek] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragStroke | null>(null);
  const dragRef = useRef<DragStroke | null>(null);
  const [rangeMenu, setRangeMenu] = useState<RangeMenu | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [sardaPrompt, setSardaPrompt] = useState<{
    userId: string;
    userName: string;
    force: string;
    fromDate: string;
    toDate: string;
  } | null>(null);
  const [sardaChecked, setSardaChecked] = useState(false);
  const [trainingChecked, setTrainingChecked] = useState(false);

  const closeRangeMenu = useCallback(() => {
    setRangeMenu(null);
    setDrag(null);
    dragRef.current = null;
  }, []);

  const openRangeMenu = useCallback(
    (stroke: DragStroke) => {
      const user = users.find((u) => u.id === stroke.userId);
      if (!user) {
        setDrag(null);
        return;
      }
      const lo =
        stroke.startDate <= stroke.endDate
          ? stroke.startDate
          : stroke.endDate;
      const hi =
        stroke.startDate <= stroke.endDate
          ? stroke.endDate
          : stroke.startDate;
      const dates = eachISODate(lo, hi).filter(
        (date) => date >= todayISO && canAssignOnDate(user, date),
      );
      if (dates.length === 0) {
        setDrag(null);
        return;
      }

      const selected =
        stroke.startDate >= todayISO && canAssignOnDate(user, stroke.startDate)
          ? stroke.startDate
          : dates[0];
      const menuDate = dates.includes(stroke.endDate)
        ? stroke.endDate
        : dates[dates.length - 1];
      const storedTag = byUserDate.get(`${stroke.userId}|${menuDate}`)?.tag;

      let ghostTag: DailyTag | undefined;
      if (!storedTag && dates.length === 1) {
        const key = `${stroke.userId}|${menuDate}`;
        const def = priorByUser.get(stroke.userId);
        if (!suppressedSet.has(key) && def) ghostTag = def;
      }

      const el = document.querySelector(
        `[data-reg-user="${stroke.userId}"][data-reg-date="${menuDate}"]`,
      ) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        const width = 288;
        const left = Math.min(
          Math.max(8, rect.left + rect.width / 2 - width / 2),
          window.innerWidth - width - 8,
        );
        const top = Math.min(rect.bottom + 6, window.innerHeight - 420);
        setMenuPos({ top, left });
      }

      setDrag({ ...stroke, endDate: menuDate });
      setRangeMenu({
        userId: stroke.userId,
        userName: user.name,
        dates,
        anchorDate: menuDate,
        fromDate: selected,
        // Pre-fill toDate with the last valid date so the full drag range
        // is applied when the user picks a tag (MS, TRG, etc.).
        // For a single-cell click, toDate stays empty (no range).
        toDate: dates.length > 1 ? dates[dates.length - 1] : "",
        ghostTag,
        storedTag,
      });
    },
    [
      byUserDate,
      columnDates,
      priorByUser,
      suppressedSet,
      todayISO,
      users,
    ],
  );

  const commitDrag = useCallback(() => {
    const stroke = dragRef.current;
    dragRef.current = null;
    if (!stroke) {
      setDrag(null);
      return;
    }
    openRangeMenu(stroke);
  }, [openRangeMenu]);

  useEffect(() => {
    if (rangeMenu) return;

    const onMove = (e: PointerEvent) => {
      const stroke = dragRef.current;
      if (!stroke) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest(
        "[data-reg-user][data-reg-date]",
      ) as HTMLElement | null;
      if (!cell) return;
      const userId = cell.dataset.regUser;
      const date = cell.dataset.regDate;
      if (!userId || !date || userId !== stroke.userId) return;
      if (date < todayISO) return;
      if (stroke.endDate === date) return;
      const next = { ...stroke, endDate: date };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = () => {
      if (dragRef.current) commitDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [commitDrag, rangeMenu, todayISO]);

  useEffect(() => {
    if (!rangeMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRangeMenu();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rangeMenu, closeRangeMenu]);

  function startDrag(userId: string, date: string) {
    if (rangeMenu) return;
    if (date < todayISO) return;
    const user = users.find((u) => u.id === userId);
    if (user && !canAssignOnDate(user, date)) return;
    const stroke: DragStroke = {
      userId,
      startDate: date,
      endDate: date,
    };
    dragRef.current = stroke;
    setDrag(stroke);
  }

  function inDragPreview(userId: string, date: string) {
    if (!drag || drag.userId !== userId) return false;
    const lo =
      drag.startDate <= drag.endDate ? drag.startDate : drag.endDate;
    const hi =
      drag.startDate <= drag.endDate ? drag.endDate : drag.startDate;
    return date >= lo && date <= hi;
  }

  async function queuePaint(
    userId: string,
    tag: DailyTag,
    fromDate: string,
    toDate: string,
    opts?: { sarda?: boolean; training?: boolean },
  ) {
    const queue = dutyTagQueue(tag);
    if (queue === "immediate") return false;
    const user = users.find((u) => u.id === userId);
    const force = user?.force ?? "";
    const trg_tone = isTrgTag(tag)
      ? resolveTrgTone(force, Boolean(opts?.training))
      : undefined;
    const trg_sarda =
      isTrgTag(tag) && needsTrgSardaPrompt(force)
        ? Boolean(opts?.sarda)
        : undefined;
    if (isCcApiEnabled()) {
      try {
        const created = await createTagRequestApi({
          userId,
          toTag: tag,
          from: fromDate,
          to: toDate,
          queue,
          trg_tone,
          trg_sarda,
        });
        upsertLocalTagRequest(requestToTagRequest(created));
        notifyCcDataChange();
        toast(
          queue === "ration"
            ? t("daily.queuedRation", { tag })
            : t("daily.queuedConsume", { tag }),
          "success",
        );
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.detail : t("tagRequest.cannotRequest"),
          "error",
        );
      }
      return true;
    }
    const row = createDutyTagRequest({
      userId,
      toTag: tag,
      fromDate,
      toDate,
      queue,
      trg_tone,
      trg_sarda,
    });
    if (row) {
      toast(
        queue === "ration"
          ? t("daily.queuedRation", { tag })
          : t("daily.queuedConsume", { tag }),
        "success",
      );
    }
    return true;
  }

  function applyRangeTag(tag: DailyTag | "") {
    if (!rangeMenu) return;
    const user = users.find((u) => u.id === rangeMenu.userId);
    const from = rangeMenu.fromDate || rangeMenu.anchorDate;
    const to = rangeMenu.toDate || from;
    const dates = eachISODate(from, to).filter(
      (date) => date >= todayISO && (!user || canAssignOnDate(user, date)),
    );
    if (dates.length === 0) return;
    if (user && isMfrLocked(user) && tag && !canWriteMfrLockedTag(tag)) return;
    if (user && isMfrLocked(user) && !tag) return;
    const fromDate = dates[0]!;
    const toDate = dates[dates.length - 1]!;
    if (isTrgTag(tag) && user && needsTrgTrainingPrompt(user.force)) {
      setSardaPrompt({
        userId: user.id,
        userName: user.name,
        force: user.force,
        fromDate,
        toDate,
      });
      setSardaChecked(false);
      setTrainingChecked(false);
      closeRangeMenu();
      return;
    }
    if (tag && dutyTagQueue(tag) !== "immediate") {
      void queuePaint(rangeMenu.userId, tag, fromDate, toDate);
      closeRangeMenu();
      return;
    }
    if (dates.length === 1) {
      onTagChange(rangeMenu.userId, dates[0], tag);
    } else {
      onPaintRange(rangeMenu.userId, dates, tag);
    }
    closeRangeMenu();
  }

  const rangeLabel = rangeMenu
    ? rangeMenu.toDate && rangeMenu.toDate !== rangeMenu.fromDate
      ? `${formatDateDisplay(rangeMenu.fromDate)} → ${formatDateDisplay(rangeMenu.toDate)}`
      : formatDateDisplay(rangeMenu.fromDate)
    : "";
  const rangeUser = rangeMenu
    ? users.find((u) => u.id === rangeMenu.userId)
    : undefined;
  const rangeMfrLocked = Boolean(rangeUser && isMfrLocked(rangeUser));

  const resetKey = useMemo(
    () =>
      `${month}|${dateFrom}|${dateTo}|${users.map((u) => u.id).join("|")}`,
    [month, dateFrom, dateTo, users],
  );
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    pageItems,
    total,
    from,
    to,
  } = usePagination(users, resetKey);

  return (
    <div className="relative">
      {/* File-folder paint tab — kept for restore; unused (drag opens tag dropdown) */}
      <div className="relative z-20 hidden justify-end pr-0" aria-hidden>
        <div
          className={cn(
            "relative flex items-center gap-2 border border-b-0 px-2.5 py-1.5 shadow-sm",
            "rounded-t-md border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800",
          )}
        >
          <PaintTagSelect paintTag="" onPaintTagChange={() => {}} />
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 overflow-hidden rounded-xl border shadow-sm",
          "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="min-w-0 text-xs text-neutral-500 dark:text-neutral-400">
            {t("daily.dragFillHint")}
          </p>
          <button
            type="button"
            onClick={() => setShowResultCols((v) => !v)}
            aria-pressed={showResultCols}
            title={
              showResultCols
                ? t("daily.hideTagTotals")
                : t("daily.showTagTotals")
            }
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200",
              showResultCols
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900",
            )}
          >
            {showResultCols ? (
              <IconChevronLeft className="h-3.5 w-3.5" stroke={2.25} />
            ) : (
              <IconChevronRight className="h-3.5 w-3.5" stroke={2.25} />
            )}
            {showResultCols
              ? t("daily.hideTagTotals")
              : t("daily.showTagTotals")}
          </button>
        </div>
        <div
          className={cn(
            "overflow-x-auto bg-white dark:bg-neutral-950",
            drag && "select-none",
          )}
        >
          <table className="w-max min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-30">
              <tr className="bg-neutral-100 text-[11px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                <th className="sticky left-0 z-40 w-9 border-b border-r border-neutral-300 bg-neutral-100 px-1 py-2 text-center dark:border-neutral-700 dark:bg-neutral-900">
                  {t("daily.colSerial")}
                </th>
                <th className="sticky left-9 z-40 w-[92px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {t("daily.colId")}
                </th>
                <th className="sticky left-[128px] z-40 w-[96px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {t("cc.fields.rank")}
                </th>
                <th className="sticky left-[224px] z-40 w-[173px] min-w-[173px] max-w-[173px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {t("cc.fields.name")}
                </th>
                {resultTags.map((code, i) => {
                  return (
                    <th
                      key={`res-${code}`}
                      title={showResultCols ? tagLabel(code, locale) : undefined}
                      aria-hidden={!showResultCols}
                      className={cn(
                        "sticky z-40 box-border border-b border-neutral-300 bg-emerald-100 text-center font-mono text-[10px] text-emerald-800 dark:border-neutral-700 dark:bg-emerald-950 dark:text-emerald-300",
                        showResultCols ? "border-r px-0 py-2" : "border-r-0 p-0",
                      )}
                      style={resultColStyle(i)}
                    >
                      <span className="block truncate">{code}</span>
                    </th>
                  );
                })}
                <th
                  title={showResultCols ? t("mess.colAll") : undefined}
                  aria-hidden={!showResultCols}
                  className={cn(
                    "sticky z-40 box-border border-b border-neutral-300 bg-emerald-100 text-center font-mono text-[10px] text-emerald-800 dark:border-neutral-700 dark:bg-emerald-950 dark:text-emerald-300",
                    showResultCols
                      ? "border-r px-0 py-2 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)]"
                      : "border-r-0 p-0 shadow-none",
                  )}
                  style={resultColStyle(resultTags.length)}
                >
                  <span className="block truncate">{t("common.all")}</span>
                </th>
                {columnDates.map((date, i) => {
                  const isToday = date === todayISO;
                  const past = date < todayISO;
                  const isBk = bkDates.has(date);
                  const dayNum = Number(date.slice(8, 10));
                  const showMonth =
                    crossMonth &&
                    (i === 0 || date.slice(8, 10) === "01");
                  const monthAbbr = showMonth
                    ? MONTH_ABBR[Number(date.slice(5, 7)) - 1]
                    : null;
                  return (
                    <th
                      key={date}
                      className={cn(
                        "w-9 min-w-9 border-b border-r border-neutral-300 p-0 text-center dark:border-neutral-700",
                        isBk
                          ? "bg-orange-100 text-orange-950 dark:bg-orange-950/70 dark:text-orange-100"
                          : isToday
                            ? "bg-primary/15 text-primary dark:bg-primary/25"
                            : past
                              ? "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/50 dark:text-neutral-600"
                              : null,
                      )}
                    >
                      <div className="flex h-full min-h-10 flex-col">
                        <button
                          type="button"
                          title={t("daily.dayMsCdHint", { date })}
                          onClick={() => setDayPeek(date)}
                          className={cn(
                            "flex w-full flex-1 cursor-pointer flex-col items-center justify-center px-0 pt-1 transition",
                            isBk
                              ? "hover:bg-orange-200 dark:hover:bg-orange-900/80"
                              : "hover:bg-neutral-300 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white",
                            isToday &&
                              !isBk &&
                              "hover:bg-primary/40 hover:text-primary dark:hover:bg-primary/50",
                            dayPeek === date &&
                              "ring-2 ring-inset ring-neutral-900/30 dark:ring-white/40",
                          )}
                        >
                          {monthAbbr ? (
                            <span className="block text-[8px] font-semibold leading-none tracking-wide opacity-80">
                              {monthAbbr}
                            </span>
                          ) : null}
                          <span className="leading-tight">{dayNum}</span>
                        </button>
                        <button
                          type="button"
                          title={
                            isBk
                              ? t("daily.boroKhanaClear", { date })
                              : t("daily.boroKhanaSet", { date })
                          }
                          aria-pressed={isBk}
                          aria-label={
                            isBk
                              ? t("daily.boroKhanaClear", { date })
                              : t("daily.boroKhanaSet", { date })
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onBoroKhanaToggle) onBoroKhanaToggle(date, !isBk);
                            else setBoroKhana(date, !isBk);
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-center gap-0.5 border-t px-0 py-0.5 text-[8px] font-extrabold uppercase tracking-wide transition",
                            isBk
                              ? "border-orange-300/80 bg-orange-500 text-white hover:bg-orange-600 dark:border-orange-700"
                              : "border-neutral-200/80 bg-neutral-100 text-neutral-500 hover:bg-orange-100 hover:text-orange-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-orange-950 dark:hover:text-orange-200",
                          )}
                        >
                          <IconFlame
                            className="h-2.5 w-2.5 shrink-0"
                            stroke={2.5}
                          />
                          BK
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((user, index) => {
                const ser = (page - 1) * pageSize + index + 1;
                const odd = index % 2 === 0;
                const stickyBg = odd
                  ? "bg-white dark:bg-neutral-950"
                  : "bg-neutral-50 dark:bg-neutral-900";

                const defaultGhost: DailyTag | undefined =
                  priorByUser.get(user.id);
                const rowMeta: {
                  date: string;
                  stored?: DailyTag;
                  ghost?: DailyTag;
                  trgTone?: TrgTone;
                  pendingTag?: DailyTag;
                  afterOut: boolean;
                  inactiveOnDate: boolean;
                  mfrLocked: boolean;
                }[] = [];
                for (const date of columnDates) {
                  const inactiveOnDate = isUserInactiveOnDate(user, date);
                  const afterOut = !canAssignOnDate(user, date);
                  const mfrLocked = isMfrLocked(user) && !inactiveOnDate && !afterOut;
                  if (inactiveOnDate) {
                    rowMeta.push({
                      date,
                      stored: undefined,
                      ghost: undefined,
                      afterOut: true,
                      inactiveOnDate: true,
                      mfrLocked: false,
                    });
                    continue;
                  }
                  if (mfrLocked) {
                    rowMeta.push({
                      date,
                      stored: MFR_TAG,
                      ghost: undefined,
                      afterOut: false,
                      inactiveOnDate: false,
                      mfrLocked: true,
                    });
                    continue;
                  }
                  if (afterOut) {
                    // After out: lock paint, no default ghost.
                    // Stored history still shows (prior days).
                    const afterEntry = byUserDate.get(`${user.id}|${date}`);
                    rowMeta.push({
                      date,
                      stored: afterEntry?.tag,
                      ghost: undefined,
                      trgTone: isTrgTag(afterEntry?.tag)
                        ? (afterEntry?.trg_tone ?? resolveTrgTone(user.force))
                        : undefined,
                      afterOut: true,
                      inactiveOnDate: false,
                      mfrLocked: false,
                    });
                    continue;
                  }
                  const key = `${user.id}|${date}`;
                  const pendingReq = pendingByUserDate.get(key);
                  const pendingTag = pendingReq?.to_tag;
                  const entry = byUserDate.get(key);
                  const stored = entry?.tag;
                  const suppressed = suppressedSet.has(key);
                  const ghost = stored || suppressed ? undefined : defaultGhost;
                  const trgTone = isTrgTag(stored)
                    ? (entry?.trg_tone ?? resolveTrgTone(user.force))
                    : isTrgTag(pendingTag)
                      ? (pendingReq?.trg_tone ?? resolveTrgTone(user.force))
                      : isTrgTag(ghost)
                        ? resolveTrgTone(user.force)
                        : undefined;
                  rowMeta.push({
                    date,
                    stored,
                    // Empty cell → member default_tag only (not last paint).
                    ghost,
                    pendingTag,
                    trgTone,
                    afterOut: false,
                    inactiveOnDate: false,
                    mfrLocked: false,
                  });
                }

                return (
                  <tr
                    key={user.id}
                    className={
                      odd
                        ? "bg-white dark:bg-neutral-950"
                        : "bg-neutral-50 dark:bg-neutral-900"
                    }
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 border-b border-r border-neutral-200 px-1 py-0 text-center font-mono text-[11px] text-neutral-500 dark:border-neutral-800",
                        stickyBg,
                      )}
                    >
                      {ser}
                    </td>
                    <td
                      className={cn(
                        "sticky left-9 z-20 border-b border-r border-neutral-200 px-2 py-0 font-mono text-[11px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                        stickyBg,
                      )}
                    >
                      {user.rab_id}
                    </td>
                    <td
                      className={cn(
                        "sticky left-[128px] z-20 max-w-[96px] truncate border-b border-r border-neutral-200 px-2 py-0 text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-300",
                        stickyBg,
                      )}
                    >
                      {user.rank || "—"}
                    </td>
                    <td
                      className={cn(
                        "sticky left-[224px] z-20 w-[173px] min-w-[173px] max-w-[173px] border-b border-r border-neutral-200 px-2 py-0 text-xs font-medium text-neutral-900 dark:border-neutral-800 dark:text-white",
                        stickyBg,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <span className="truncate">{user.name}</span>
                        {user.status !== "1" ? (
                          <span className="shrink-0 rounded bg-neutral-200/80 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                            {t("cc.statusInactive")}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    {(() => {
                      const tagCounts: Partial<Record<DailyTag, number>> = {};
                      let totalDays = 0;
                      for (const cell of rowMeta) {
                        if (cell.pendingTag && !cell.stored) continue;
                        const shown =
                          cell.stored ??
                          (!cell.afterOut && cell.ghost ? cell.ghost : undefined);
                        if (!shown) continue;
                        tagCounts[shown] = (tagCounts[shown] ?? 0) + 1;
                        totalDays += 1;
                      }
                      const stickyTagBg = odd
                        ? "bg-emerald-50 dark:bg-emerald-950"
                        : "bg-emerald-100 dark:bg-emerald-900";
                      return (
                        <>
                          {resultTags.map((code, i) => {
                            const n = tagCounts[code] ?? 0;
                            return (
                              <td
                                key={`res-${user.id}-${code}`}
                                className={cn(
                                  "sticky z-20 box-border border-b border-neutral-200 text-center font-mono text-[11px] font-semibold tabular-nums text-neutral-800 dark:border-neutral-800 dark:text-neutral-200",
                                  stickyTagBg,
                                  showResultCols ? "border-r" : "border-r-0",
                                )}
                                style={resultColStyle(i)}
                                aria-hidden={!showResultCols}
                              >
                                <span className="block truncate">{n || "—"}</span>
                              </td>
                            );
                          })}
                          <td
                            className={cn(
                              "sticky z-20 box-border border-b border-neutral-200 text-center font-mono text-[11px] font-semibold tabular-nums text-neutral-900 dark:border-neutral-800 dark:text-white",
                              stickyTagBg,
                              showResultCols
                                ? "border-r shadow-[4px_0_8px_-2px_rgba(0,0,0,0.22)]"
                                : "border-r-0 shadow-none",
                            )}
                            style={resultColStyle(resultTags.length)}
                            aria-hidden={!showResultCols}
                          >
                            <span className="block truncate">
                              {totalDays || "—"}
                            </span>
                          </td>
                        </>
                      );
                    })()}
                    {rowMeta.map((cell, cellIdx) => {
                      const {
                        date,
                        stored,
                        ghost,
                        trgTone,
                        pendingTag,
                        afterOut,
                        inactiveOnDate,
                        mfrLocked,
                      } = cell;
                      const inactive = inactiveOnDate;
                      const pending = Boolean(pendingTag);
                      const preview = inDragPreview(user.id, date);
                      const locked = afterOut || date < todayISO;
                      let tag = stored;
                      let isGhost = false;
                      if (stored) {
                        tag = stored;
                        isGhost = false;
                      } else if (pendingTag) {
                        tag = pendingTag;
                        isGhost = true;
                      } else if (ghost && !afterOut) {
                        tag = ghost;
                        // Future only — past/today show solid (not preview fade)
                        isGhost = date > todayISO;
                      }

                      const prevMeta = rowMeta[cellIdx - 1];
                      const nextMeta = rowMeta[cellIdx + 1];
                      const displayPrev = prevMeta?.stored ?? prevMeta?.ghost;
                      const displayNext = nextMeta?.stored ?? nextMeta?.ghost;
                      const sameTone =
                        (trgTone ?? "") === (prevMeta?.trgTone ?? "");
                      const sameToneR =
                        (trgTone ?? "") === (nextMeta?.trgTone ?? "");
                      const contL = Boolean(
                        tag &&
                        !isGhost &&
                        displayPrev === tag &&
                        sameTone &&
                        (prevMeta?.stored ||
                          (prevMeta?.ghost &&
                            (prevMeta.date ?? "") <= todayISO)),
                      );
                      const contR = Boolean(
                        tag &&
                        !isGhost &&
                        displayNext === tag &&
                        sameToneR &&
                        (nextMeta?.stored ||
                          (nextMeta?.ghost &&
                            (nextMeta.date ?? "") <= todayISO)),
                      );

                      return (
                        <RegisterCell
                          key={date}
                          userId={user.id}
                          tag={tag}
                          trgTone={trgTone}
                          ghost={isGhost}
                          pending={pending}
                          date={date}
                          userName={user.name}
                          isToday={date === todayISO}
                          boroKhana={bkDates.has(date)}
                          locked={locked}
                          afterOut={afterOut}
                          inactive={inactive}
                          mfrLocked={mfrLocked}
                          contL={contL}
                          contR={contR}
                          preview={preview && date >= todayISO && !afterOut}
                          locale={locale}
                          onDragStart={() => startDrag(user.id, date)}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>

      {rangeMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[180] cursor-default bg-transparent"
            aria-label={t("common.cancel")}
            onClick={closeRangeMenu}
          />
          <div
            className="fixed z-[190] w-72 rounded-xl border border-neutral-200 bg-white p-2.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="dialog"
            aria-label={t("daily.tagFor")}
          >
            <TagPickerPanel
              label={`${rangeMenu.userName} · ${rangeLabel}`}
              ghost={Boolean(rangeMenu.ghostTag)}
              tag={rangeMenu.storedTag ?? rangeMenu.ghostTag}
              locale={locale}
              allowedTags={rangeMfrLocked ? [FR_TAG] : undefined}
              allowClear={!rangeMfrLocked}
              fromDate={rangeMenu.fromDate}
              toDate={rangeMenu.toDate}
              minDate={todayISO}
              onFromDate={(fromDate) =>
                setRangeMenu((cur) => (cur ? { ...cur, fromDate } : cur))
              }
              onToDate={(toDate) =>
                setRangeMenu((cur) => (cur ? { ...cur, toDate } : cur))
              }
              onAcceptCarry={
                rangeMenu.ghostTag &&
                !rangeMenu.toDate &&
                rangeMenu.fromDate === rangeMenu.anchorDate
                  ? () => applyRangeTag(rangeMenu.ghostTag!)
                  : undefined
              }
              onPick={(tag) => applyRangeTag(tag)}
              onClear={() => applyRangeTag("")}
            />
          </div>
        </>
      ) : null}

      <DayMsCdPeek
        date={dayPeek}
        filterUsers={users}
        onClose={() => setDayPeek(null)}
        boroKhanaDates={boroKhanaDates}
        onBoroKhanaToggle={onBoroKhanaToggle}
        projectedTagMembers={projectedTagMembers}
      />

      <TrgSardaDialog
        open={!!sardaPrompt}
        name={sardaPrompt?.userName ?? ""}
        showSarda={Boolean(
          sardaPrompt && needsTrgSardaPrompt(sardaPrompt.force),
        )}
        sardaChecked={sardaChecked}
        trainingChecked={trainingChecked}
        onSardaChange={setSardaChecked}
        onTrainingChange={setTrainingChecked}
        onCancel={() => {
          setSardaPrompt(null);
          setSardaChecked(false);
          setTrainingChecked(false);
        }}
        onConfirm={() => {
          if (!sardaPrompt) return;
          void queuePaint(
            sardaPrompt.userId,
            "TRG",
            sardaPrompt.fromDate,
            sardaPrompt.toDate,
            { sarda: sardaChecked, training: trainingChecked },
          );
          setSardaPrompt(null);
          setSardaChecked(false);
          setTrainingChecked(false);
        }}
      />
    </div>
  );
}

function DayMsCdPeek({
  date,
  filterUsers,
  onClose,
  boroKhanaDates,
  onBoroKhanaToggle,
  projectedTagMembers,
}: {
  date: string | null;
  filterUsers: User[];
  onClose: () => void;
  boroKhanaDates?: string[];
  onBoroKhanaToggle?: (date: string, on: boolean) => void;
  projectedTagMembers?: (tag: DailyTag, date: string) => User[];
}) {
  const t = useT();
  const { locale } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const open = Boolean(date);
  const [peekFilter, setPeekFilter] = useState<"all" | "MS" | "CD">("all");
  const [peekQ, setPeekQ] = useState("");
  const bkOn = Boolean(
    date &&
      (boroKhanaDates ?? state.boro_khana_dates ?? []).includes(date),
  );

  const lists = useMemo(() => {
    if (!date) return { ms: [] as User[], cd: [] as User[] };
    const allowed = new Set(filterUsers.map((u) => u.id));
    const msSource = projectedTagMembers
      ? projectedTagMembers("MS", date)
      : getProjectedTagMembers("MS", date).members;
    const cdSource = projectedTagMembers
      ? projectedTagMembers("CD", date)
      : getProjectedTagMembers("CD", date).members;
    const ms = msSource.filter((u) => allowed.has(u.id)).sort(compareUsers);
    const cd = cdSource.filter((u) => allowed.has(u.id)).sort(compareUsers);
    return { ms, cd };
  }, [
    date,
    filterUsers,
    projectedTagMembers,
    state.assignments,
    state.users,
    state.suppressed_carries,
  ]);

  const dateLabel = date
    ? formatDateLong(date, locale === "bn" ? "bn-BD" : "en-GB")
    : "";

  const rows = useMemo(() => {
    const query = peekQ.trim().toLowerCase();
    const tagged: { user: User; tag: "MS" | "CD" }[] = [
      ...lists.ms.map((user) => ({ user, tag: "MS" as const })),
      ...lists.cd.map((user) => ({ user, tag: "CD" as const })),
    ];
    return tagged.filter(({ user, tag }) => {
      if (peekFilter !== "all" && tag !== peekFilter) return false;
      if (!query) return true;
      return [user.name, user.personal_id, user.rab_id, user.rank, user.wing]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [lists, peekFilter, peekQ]);

  useEffect(() => {
    if (!open) return;
    setPeekFilter("all");
    setPeekQ("");
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const total = lists.ms.length + lists.cd.length;
  const emptyDay = total === 0;
  const emptyFilter = !emptyDay && rows.length === 0;

  return createPortal(
    <AnimatePresence>
      {open && date ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <motion.button
            type="button"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="absolute inset-0 bg-page-dark/55 backdrop-blur-sm"
            aria-label={t("common.cancel")}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={
              reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }
            }
            transition={{ duration: 0.2 }}
            className="relative z-10 flex max-h-[min(40rem,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-3xl dark:border-neutral-700 dark:bg-neutral-950"
          >
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-light to-secondary" />

            <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/25">
                <IconUsers className="h-5 w-5" stroke={2.25} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id={titleId}
                  className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white"
                >
                  {t("daily.dayMsCdTitle", { date: dateLabel })}
                </h2>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {emptyDay
                    ? t("daily.dayMsCdEmpty")
                    : t("daily.dayMsCdSubtitle", { count: total })}
                </p>
              </div>
              <Button
                ref={closeRef}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 rounded-xl p-0"
                onClick={onClose}
                aria-label={t("common.cancel")}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-neutral-100 px-4 pb-3 sm:px-5 dark:border-neutral-800">
              <button
                type="button"
                role="switch"
                aria-checked={bkOn}
                onClick={() => {
                  if (!date) return;
                  if (onBoroKhanaToggle) onBoroKhanaToggle(date, !bkOn);
                  else setBoroKhana(date, !bkOn);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                  bkOn
                    ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50"
                    : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    bkOn
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
                  )}
                >
                  <IconFlame className="h-4 w-4" stroke={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                    {t("daily.boroKhana")}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                    {bkOn
                      ? t("daily.boroKhanaOnHint")
                      : t("daily.boroKhanaOffHint")}
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition",
                    bkOn ? "bg-orange-500" : "bg-neutral-300 dark:bg-neutral-600",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                      bkOn ? "left-5" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </div>

            {!emptyDay ? (
              <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 pb-3 sm:px-5 dark:border-neutral-800">
                <div
                  className="inline-flex w-full rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900"
                  role="tablist"
                  aria-label={t("daily.dayMsCdTitle", { date: dateLabel })}
                >
                  {(
                    [
                      {
                        id: "all" as const,
                        label: t("daily.rosterStatAll"),
                        count: total,
                        icon: <IconUsers className="h-3.5 w-3.5" />,
                      },
                      {
                        id: "MS" as const,
                        label: t("mess.statMs"),
                        count: lists.ms.length,
                        icon: <IconSoup className="h-3.5 w-3.5" />,
                      },
                      {
                        id: "CD" as const,
                        label: t("mess.statCd"),
                        count: lists.cd.length,
                        icon: <IconShield className="h-3.5 w-3.5" />,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={peekFilter === tab.id}
                      onClick={() => setPeekFilter(tab.id)}
                      className={cn(
                        "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition",
                        peekFilter === tab.id
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0",
                          tab.id === "MS" && peekFilter === "MS" && "text-primary",
                          tab.id === "CD" &&
                            peekFilter === "CD" &&
                            "text-violet-600 dark:text-violet-300",
                        )}
                      >
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.label}</span>
                      <span className="tabular-nums opacity-70">{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={peekQ}
                    onChange={(e) => setPeekQ(e.target.value)}
                    placeholder={t("cc.searchPlaceholder")}
                    className="h-10 rounded-xl border-neutral-200 bg-white pl-9 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
              {emptyDay ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-900">
                    <IconUsers className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {t("daily.dayMsCdEmpty")}
                  </p>
                </div>
              ) : emptyFilter ? (
                <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  {t("common.noResults")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {rows.map(({ user, tag }, i) => (
                    <li key={`${tag}-${user.id}`}>
                      <DayMsCdRow index={i} user={user} tag={tag} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!emptyDay ? (
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3 sm:px-5 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("daily.dayMsCdShowing", {
                    shown: rows.length,
                    total,
                  })}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="cta"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      downloadDayMsCdPdf({
                        date,
                        ms: lists.ms,
                        cd: lists.cd,
                        include: peekFilter,
                        filename: `ms-cd-${date}${peekFilter === "all" ? "" : `-${peekFilter.toLowerCase()}`}.pdf`,
                      });
                    }}
                  >
                    <IconDownload className="h-4 w-4" />
                    {t("daily.exportPdf")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={onClose}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end border-t border-neutral-100 px-4 py-3 sm:px-5 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={onClose}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function DayMsCdRow({
  index,
  user,
  tag,
}: {
  index: number;
  user: User;
  tag: "MS" | "CD";
}) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-neutral-50/80 px-3 py-2.5 transition hover:border-neutral-200 hover:bg-white dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900">
      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-neutral-400">
        {index + 1}
      </span>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
          tagCellClass(tag),
        )}
        aria-hidden
      >
        {initials || tag}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-neutral-900 dark:text-white">
            {user.name}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              tagCellClass(tag),
            )}
          >
            {tag}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-mono">{user.rab_id}</span>
          {user.rank ? ` · ${user.rank}` : null}
          {user.wing ? ` · ${user.wing}` : null}
        </p>
      </div>
    </div>
  );
}

export function PaintTagSelect({
  paintTag,
  onPaintTagChange,
  triggerClassName,
}: {
  paintTag: DailyTag | "";
  onPaintTagChange: (tag: DailyTag | "") => void;
  triggerClassName?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const tags = listAllTags();
  const current = paintTag || "__none__";
  void state.rates;

  return (
    <Select
      value={current}
      onValueChange={(v) =>
        onPaintTagChange(v === "__none__" ? "" : (v as DailyTag))
      }
    >
      <SelectTrigger
        aria-label={t("daily.paintTag")}
        className={cn(
          "h-9 w-[5.5rem] rounded-md border-neutral-300 bg-white px-2 font-mono text-sm font-bold shadow-none",
          "text-neutral-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100",
          "focus:ring-1 focus:ring-primary",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={t("daily.paintOff")}>
          {paintTag || t("daily.paintOff")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{t("daily.paintOff")}</SelectItem>
        {tags.map((code) => (
          <SelectItem key={code} value={code}>
            {code} — {tagLabel(code, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TagPickerPanel({
  label,
  ghost,
  tag,
  locale,
  fromDate,
  toDate,
  minDate,
  allowedTags,
  allowClear = true,
  onFromDate,
  onToDate,
  onAcceptCarry,
  onPick,
  onClear,
}: {
  label: string;
  ghost?: boolean;
  tag?: DailyTag;
  locale: Locale;
  fromDate: string;
  toDate: string;
  minDate: string;
  allowedTags?: readonly DailyTag[];
  allowClear?: boolean;
  onFromDate: (date: string) => void;
  onToDate: (date: string) => void;
  onAcceptCarry?: () => void;
  onPick: (tag: DailyTag) => void;
  onClear: () => void;
}) {
  const t = useT();
  const dateField =
    "h-8 rounded-md border-neutral-200 bg-white px-2 text-[11px] shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <>
      <p className="mb-2 truncate px-1 text-[10px] font-medium text-neutral-500">
        {label}
        {ghost && tag ? ` · ${t("daily.carried")}` : ""}
      </p>
      <div className="mb-2 grid grid-cols-2 gap-1.5 px-0.5">
        <label className="min-w-0">
          <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-neutral-400">
            {t("common.dateFrom")}
          </span>
          <FormattedDateInput
            value={fromDate}
            min={minDate}
            onChange={onFromDate}
            aria-label={t("common.dateFrom")}
            className={dateField}
          />
        </label>
        <label className="min-w-0">
          <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-neutral-400">
            {t("common.dateTo")}
          </span>
          <FormattedDateInput
            value={toDate}
            min={fromDate || minDate}
            onChange={onToDate}
            aria-label={t("common.dateTo")}
            className={dateField}
          />
        </label>
      </div>
      {onAcceptCarry && ghost && tag ? (
        <button
          type="button"
          onClick={onAcceptCarry}
          className="mb-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-dark"
        >
          <IconCheck className="h-3 w-3" />
          {t("daily.acceptCarry", { tag })}
        </button>
      ) : null}
      <ColoredTagGrid
        value={!ghost ? tag : undefined}
        onPick={onPick}
        locale={locale}
        allowedTags={allowedTags}
      />
      {allowClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <IconX className="h-3 w-3" />
          {t("daily.noTag")}
        </button>
      ) : null}
    </>
  );
}

function RegisterCell({
  userId,
  tag,
  trgTone,
  ghost,
  pending,
  date,
  userName,
  isToday,
  boroKhana,
  locked,
  afterOut,
  inactive,
  mfrLocked,
  contL,
  contR,
  preview,
  locale,
  onDragStart,
}: {
  userId: string;
  tag?: DailyTag;
  trgTone?: TrgTone;
  ghost?: boolean;
  pending?: boolean;
  date: string;
  userName: string;
  isToday: boolean;
  boroKhana?: boolean;
  locked: boolean;
  afterOut?: boolean;
  inactive?: boolean;
  mfrLocked?: boolean;
  contL: boolean;
  contR: boolean;
  preview: boolean;
  locale: Locale;
  onDragStart: () => void;
}) {
  const t = useT();

  const cellClass = cn(
    "flex h-full w-full items-center justify-center font-mono text-[10px] font-bold leading-none touch-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    // Empty locked = disabled look. Prior stored tags = full color (inactive too).
    locked && !tag
      ? "cursor-not-allowed"
      : locked || inactive
        ? "cursor-default"
        : "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-primary/35",
    tag
      ? cn(
          tagDisplayClass(tag, trgTone),
          contL ? "rounded-l-none" : "rounded-l-md",
          contR ? "rounded-r-none" : "rounded-r-md",
          // Carry ghost / pending request — faded so Daily can see it is not saved
          ghost && "opacity-40",
          pending &&
            "ring-1 ring-inset ring-dashed ring-amber-500/90 dark:ring-amber-300/80",
        )
      : locked
        ? "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/40 dark:text-neutral-600"
        : "text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-neutral-800",
    preview &&
      "bg-primary/25 ring-2 ring-inset ring-primary/60 dark:bg-primary/40",
  );

  const lockReason = inactive
    ? t("daily.inactiveLocked")
    : mfrLocked
      ? t("daily.mfrLocked")
      : afterOut
        ? t("daily.afterOutLocked")
        : t("daily.pastLocked");
  // Prior stored tags: normal title (not "disabled"). Empty locked: lock reason.
  const title = pending && tag
    ? `${userName} · ${date} · ${tag} ${tagLabel(tag, locale)} · ${t("daily.pendingRequest")}`
    : tag && !ghost
      ? `${userName} · ${date} · ${tag} ${tagLabel(tag, locale)}${locked ? ` · ${lockReason}` : ""}`
      : locked
        ? `${userName} · ${date} · ${lockReason}`
        : tag
          ? `${userName} · ${date} · ${tag}${ghost ? ` (${t("daily.carried")})` : ""} ${tagLabel(tag, locale)}`
          : `${userName} · ${date}`;

  return (
    <td
      className={cn(
        "h-9 w-9 min-w-9 border-b border-r border-neutral-100 p-0.5 dark:border-neutral-800/80",
        boroKhana && !preview && "bg-orange-50/90 dark:bg-orange-950/25",
        isToday && !preview && !boroKhana && "bg-primary/[0.04]",
        locked && !tag && !boroKhana && "bg-neutral-50/80 dark:bg-neutral-900/40",
        preview && "bg-primary/20 dark:bg-primary/35",
      )}
      data-reg-user={locked ? undefined : userId}
      data-reg-date={locked ? undefined : date}
    >
      <button
        type="button"
        title={title}
        // No HTML disabled — greys stored tags. Block paint via pointer guard only.
        aria-disabled={locked || undefined}
        className={cellClass}
        data-reg-user={locked ? undefined : userId}
        data-reg-date={locked ? undefined : date}
        onPointerDown={(e) => {
          // Inactive never paints — even when prior tag shows full color.
          if (locked || inactive || e.button !== 0) return;
          e.preventDefault();
          onDragStart();
        }}
      >
        {tag ?? ""}
      </button>
    </td>
  );
}
