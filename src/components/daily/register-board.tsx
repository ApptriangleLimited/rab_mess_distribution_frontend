"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPagination } from "@/components/shared/list-pagination";
import { dateInMonth, eachISODate } from "@/lib/date";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";
import type { Locale } from "@/i18n";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { usePagination } from "@/hooks/use-pagination";
import { useStore } from "@/hooks/use-store";
import { canAssignOnDate } from "@/lib/store/daily";
import { listAllTags } from "@/lib/store/rates";
import { cn } from "@/lib/utils";

const TAG_CELL: Record<string, string> = {
  FR: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  MS: "bg-primary/15 text-primary dark:bg-primary/30 dark:text-emerald-100",
  CL: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  PL: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  WR: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  CD: "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100",
  WIT: "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  MED: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
  TRG: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100",
};

const TAG_CELL_FALLBACK =
  "bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";

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

export function tagCellClass(tag: string) {
  return TAG_CELL[tag] ?? TAG_CELL_FALLBACK;
}

export { TAG_CELL };

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
  /** Single-cell ghost carry (accept) */
  ghostTag?: DailyTag;
  storedTag?: DailyTag;
};

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
}) {
  void _paintTag;
  void _onPaintTagChange;

  const t = useT();
  const { locale } = useI18n();
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

  const suppressedSet = useMemo(
    () => new Set(suppressedCarries),
    [suppressedCarries],
  );

  const byUserDate = useMemo(() => {
    const map = new Map<string, DailyTag>();
    for (const a of assignments) {
      map.set(`${a.user_id}|${a.date}`, a.tag);
    }
    return map;
  }, [assignments]);

  const [drag, setDrag] = useState<DragStroke | null>(null);
  const dragRef = useRef<DragStroke | null>(null);
  const [rangeMenu, setRangeMenu] = useState<RangeMenu | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

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
        (date) => date > todayISO && canAssignOnDate(user, date),
      );
      if (dates.length === 0) {
        setDrag(null);
        return;
      }

      const menuDate = dates.includes(stroke.endDate)
        ? stroke.endDate
        : dates[dates.length - 1];
      const storedTag = byUserDate.get(`${stroke.userId}|${menuDate}`);

      let ghostTag: DailyTag | undefined;
      if (!storedTag && dates.length === 1) {
        let rolling = priorByUser.get(stroke.userId);
        for (const date of columnDates) {
          if (date >= menuDate) break;
          if (!canAssignOnDate(user, date)) {
            rolling = undefined;
            continue;
          }
          const s = byUserDate.get(`${stroke.userId}|${date}`);
          if (s) rolling = s;
        }
        const key = `${stroke.userId}|${menuDate}`;
        if (!suppressedSet.has(key) && rolling) ghostTag = rolling;
      }

      const el = document.querySelector(
        `[data-reg-user="${stroke.userId}"][data-reg-date="${menuDate}"]`,
      ) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        const width = 224;
        const left = Math.min(
          Math.max(8, rect.left + rect.width / 2 - width / 2),
          window.innerWidth - width - 8,
        );
        const top = Math.min(rect.bottom + 6, window.innerHeight - 280);
        setMenuPos({ top, left });
      }

      setDrag({ ...stroke, endDate: menuDate });
      setRangeMenu({
        userId: stroke.userId,
        userName: user.name,
        dates,
        anchorDate: menuDate,
        ghostTag,
        storedTag,
      });
    },
    [byUserDate, columnDates, priorByUser, suppressedSet, todayISO, users],
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
      if (date <= todayISO) return;
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
    if (date <= todayISO) return;
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

  function applyRangeTag(tag: DailyTag | "") {
    if (!rangeMenu) return;
    if (rangeMenu.dates.length === 1) {
      onTagChange(rangeMenu.userId, rangeMenu.dates[0], tag);
    } else {
      onPaintRange(rangeMenu.userId, rangeMenu.dates, tag);
    }
    closeRangeMenu();
  }

  const rangeLabel = rangeMenu
    ? rangeMenu.dates.length === 1
      ? rangeMenu.dates[0]
      : `${rangeMenu.dates[0]} → ${rangeMenu.dates[rangeMenu.dates.length - 1]}`
    : "";

  const resetKey = useMemo(
    () =>
      `${month}|${dateFrom}|${dateTo}|${users.map((u) => u.id).join("|")}`,
    [month, dateFrom, dateTo, users],
  );
  const {
    page,
    setPage,
    totalPages,
    pageItems,
    total,
    from,
    to,
    pageSize,
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
        <div className="flex flex-wrap items-center border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {t("daily.dragFillHint")}
          </p>
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
                {columnDates.map((date, i) => {
                  const isToday = date === todayISO;
                  const past = date <= todayISO;
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
                      title={date}
                      className={cn(
                        "w-9 min-w-9 border-b border-r border-neutral-300 px-0 py-1 text-center dark:border-neutral-700",
                        isToday &&
                          "bg-primary/15 text-primary dark:bg-primary/25",
                        past &&
                          "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/50 dark:text-neutral-600",
                      )}
                    >
                      {monthAbbr ? (
                        <span className="block text-[8px] font-semibold leading-none tracking-wide opacity-80">
                          {monthAbbr}
                        </span>
                      ) : null}
                      <span className="leading-tight">{dayNum}</span>
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

                let rolling: DailyTag | undefined = priorByUser.get(user.id);
                const rowMeta: {
                  date: string;
                  stored?: DailyTag;
                  ghost?: DailyTag;
                  afterOut: boolean;
                }[] = [];
                for (const date of columnDates) {
                  const afterOut = !canAssignOnDate(user, date);
                  if (afterOut) {
                    rolling = undefined;
                    rowMeta.push({
                      date,
                      stored: byUserDate.get(`${user.id}|${date}`),
                      ghost: undefined,
                      afterOut: true,
                    });
                    continue;
                  }
                  const key = `${user.id}|${date}`;
                  const stored = byUserDate.get(key);
                  if (stored) rolling = stored;
                  const suppressed = suppressedSet.has(key);
                  rowMeta.push({
                    date,
                    stored,
                    ghost: stored || suppressed ? undefined : rolling,
                    afterOut: false,
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
                        "sticky left-[224px] z-20 w-[173px] min-w-[173px] max-w-[173px] truncate border-b border-r border-neutral-200 px-2 py-0 text-xs font-medium text-neutral-900 dark:border-neutral-800 dark:text-white",
                        stickyBg,
                      )}
                    >
                      {user.name}
                    </td>
                    {rowMeta.map((cell, cellIdx) => {
                      const { date, stored, ghost, afterOut } = cell;
                      const preview = inDragPreview(user.id, date);
                      const locked = afterOut || date <= todayISO;
                      let tag = stored;
                      let isGhost = false;
                      if (!stored && ghost && !afterOut) {
                        tag = ghost;
                        // Future only — past/today show solid (not preview fade)
                        isGhost = !locked;
                      }

                      const prevMeta = rowMeta[cellIdx - 1];
                      const nextMeta = rowMeta[cellIdx + 1];
                      const displayPrev = prevMeta?.stored ?? prevMeta?.ghost;
                      const displayNext = nextMeta?.stored ?? nextMeta?.ghost;
                      const contL = Boolean(
                        tag &&
                        !isGhost &&
                        displayPrev === tag &&
                        (prevMeta?.stored ||
                          (prevMeta?.ghost &&
                            (prevMeta.date ?? "") <= todayISO)),
                      );
                      const contR = Boolean(
                        tag &&
                        !isGhost &&
                        displayNext === tag &&
                        (nextMeta?.stored ||
                          (nextMeta?.ghost &&
                            (nextMeta.date ?? "") <= todayISO)),
                      );

                      return (
                        <RegisterCell
                          key={date}
                          userId={user.id}
                          tag={tag}
                          ghost={isGhost}
                          date={date}
                          userName={user.name}
                          isToday={date === todayISO}
                          locked={locked}
                          afterOut={afterOut}
                          contL={contL}
                          contR={contR}
                          preview={preview && date > todayISO && !afterOut}
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
            className="fixed z-[190] w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="dialog"
            aria-label={t("daily.tagFor")}
          >
            <TagPickerPanel
              label={`${rangeMenu.userName} · ${rangeLabel}`}
              ghost={Boolean(rangeMenu.ghostTag)}
              tag={rangeMenu.storedTag ?? rangeMenu.ghostTag}
              locale={locale}
              onAcceptCarry={
                rangeMenu.ghostTag && rangeMenu.dates.length === 1
                  ? () => applyRangeTag(rangeMenu.ghostTag!)
                  : undefined
              }
              onPick={(tag) => applyRangeTag(tag)}
              onClear={() => applyRangeTag("")}
            />
          </div>
        </>
      ) : null}
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
  onAcceptCarry,
  onPick,
  onClear,
}: {
  label: string;
  ghost?: boolean;
  tag?: DailyTag;
  locale: Locale;
  onAcceptCarry?: () => void;
  onPick: (tag: DailyTag) => void;
  onClear: () => void;
}) {
  const t = useT();
  const state = useStore();
  const tags = listAllTags();
  void state.rates;

  return (
    <>
      <p className="mb-2 truncate px-1 text-[10px] font-medium text-neutral-500">
        {label}
        {ghost && tag ? ` · ${t("daily.carried")}` : ""}
      </p>
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
      <div className="grid grid-cols-3 gap-1">
        {tags.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onPick(code)}
            className={cn(
              "rounded-md px-1.5 py-1.5 font-mono text-[11px] font-bold transition hover:opacity-90",
              tagCellClass(code),
              !ghost && tag === code && "ring-2 ring-primary ring-offset-1",
            )}
            title={tagLabel(code, locale)}
          >
            {code}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        <IconX className="h-3 w-3" />
        {t("daily.noTag")}
      </button>
    </>
  );
}

function RegisterCell({
  userId,
  tag,
  ghost,
  date,
  userName,
  isToday,
  locked,
  afterOut,
  contL,
  contR,
  preview,
  locale,
  onDragStart,
}: {
  userId: string;
  tag?: DailyTag;
  ghost?: boolean;
  date: string;
  userName: string;
  isToday: boolean;
  locked: boolean;
  afterOut?: boolean;
  contL: boolean;
  contR: boolean;
  preview: boolean;
  locale: Locale;
  onDragStart: () => void;
}) {
  const t = useT();

  const cellClass = cn(
    "flex h-full w-full items-center justify-center font-mono text-[10px] font-bold leading-none touch-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    locked
      ? "cursor-not-allowed"
      : "cursor-pointer hover:ring-1 hover:ring-primary/40",
    tag
      ? cn(
          tagCellClass(tag),
          contL ? "rounded-l-none" : "rounded-l-sm",
          contR ? "rounded-r-none" : "rounded-r-sm",
          // Faded carry preview = future only
          ghost &&
            "opacity-45 ring-1 ring-inset ring-dashed ring-neutral-400/70 dark:ring-neutral-500/70",
          afterOut && "opacity-35",
        )
      : locked
        ? "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/40 dark:text-neutral-600"
        : "text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-neutral-800",
    preview &&
      "bg-primary/25 ring-2 ring-inset ring-primary shadow-[inset_0_0_0_1px_rgba(6,121,88,0.55)] dark:bg-primary/40 dark:ring-primary-light",
  );

  const lockReason = afterOut
    ? t("daily.afterOutLocked")
    : t("daily.pastLocked");
  const title = locked
    ? `${userName} · ${date} · ${tag ? `${tag} ${tagLabel(tag, locale)} · ` : ""}${lockReason}`
    : tag
      ? `${userName} · ${date} · ${tag}${ghost ? ` (${t("daily.carried")})` : ""} ${tagLabel(tag, locale)}`
      : `${userName} · ${date}`;

  return (
    <td
      className={cn(
        "h-9 w-9 min-w-9 border-b border-r border-neutral-200 p-0 dark:border-neutral-800",
        isToday && !preview && "bg-primary/[0.04]",
        locked && !tag && "bg-neutral-50/80 dark:bg-neutral-900/40",
        preview && "bg-primary/20 dark:bg-primary/35",
      )}
      data-reg-user={locked ? undefined : userId}
      data-reg-date={locked ? undefined : date}
    >
      <button
        type="button"
        title={title}
        disabled={locked}
        className={cellClass}
        data-reg-user={locked ? undefined : userId}
        data-reg-date={locked ? undefined : date}
        onPointerDown={(e) => {
          if (locked || e.button !== 0) return;
          e.preventDefault();
          onDragStart();
        }}
      >
        {tag ?? ""}
      </button>
    </td>
  );
}
