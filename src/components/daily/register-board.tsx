"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAILY_TAGS } from "@/lib/constants";
import { dateInMonth } from "@/lib/date";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";
import type { Locale } from "@/i18n";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const TAG_CELL: Record<DailyTag, string> = {
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

export { TAG_CELL };

type DragStroke = {
  userId: string;
  clear: boolean;
  startDay: number;
  endDay: number;
};

export function RegisterBoard({
  users,
  month,
  dayCount,
  assignments,
  todayISO,
  paintTag,
  onPaintTagChange,
  onTagChange,
  onPaintRange,
  priorByUser,
  suppressedCarries,
  onApproveDay,
  approvePending,
  approveEnabled,
  dayApproved,
  canApprove,
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
  onApproveDay: () => void;
  approvePending: number;
  approveEnabled: boolean;
  dayApproved: boolean;
  canApprove: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

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

  const todayDay = todayISO.startsWith(month)
    ? Number(todayISO.slice(8, 10))
    : null;

  const [drag, setDrag] = useState<DragStroke | null>(null);
  const dragRef = useRef<DragStroke | null>(null);

  const commitDrag = useCallback(() => {
    const stroke = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!stroke || !paintTag) return;
    const lo = Math.min(stroke.startDay, stroke.endDay);
    const hi = Math.max(stroke.startDay, stroke.endDay);
    const dates: string[] = [];
    for (let d = lo; d <= hi; d++) {
      const date = dateInMonth(month, d);
      if (date > todayISO) continue;
      dates.push(date);
    }
    if (dates.length === 0) return;
    onPaintRange(stroke.userId, dates, stroke.clear ? "" : paintTag);
  }, [month, onPaintRange, paintTag, todayISO]);

  useEffect(() => {
    if (!paintTag) return;

    const onMove = (e: PointerEvent) => {
      const stroke = dragRef.current;
      if (!stroke) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest(
        "[data-reg-user][data-reg-day]",
      ) as HTMLElement | null;
      if (!cell) return;
      const userId = cell.dataset.regUser;
      const day = Number(cell.dataset.regDay);
      if (!userId || !day || userId !== stroke.userId) return;
      if (dateInMonth(month, day) > todayISO) return;
      if (stroke.endDay === day) return;
      const next = { ...stroke, endDay: day };
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
  }, [paintTag, commitDrag, month, todayISO]);

  function startPaint(userId: string, day: number, current?: DailyTag) {
    if (!paintTag) return;
    if (dateInMonth(month, day) > todayISO) return;
    const stroke: DragStroke = {
      userId,
      clear: current === paintTag,
      startDay: day,
      endDay: day,
    };
    dragRef.current = stroke;
    setDrag(stroke);
  }

  function inDragPreview(userId: string, day: number) {
    if (!drag || drag.userId !== userId) return false;
    const lo = Math.min(drag.startDay, drag.endDay);
    const hi = Math.max(drag.startDay, drag.endDay);
    return day >= lo && day <= hi;
  }

  return (
    <div className="relative">
      {/* File-folder tab — protrudes top-right */}
      <div className="relative z-20 flex justify-end pr-0">
        <div
          className={cn(
            "relative flex items-center gap-2 border border-b-0 px-2.5 py-1.5 shadow-sm",
            "rounded-t-md border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800",
            "before:absolute before:-left-3 before:bottom-0 before:h-full before:w-3",
            "before:bg-neutral-100 dark:before:bg-neutral-800",
            "before:[clip-path:polygon(100%_0,100%_100%,0_100%)]",
            "before:border-l before:border-t before:border-neutral-300 dark:before:border-neutral-600",
          )}
        >
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500 sm:inline dark:text-neutral-400">
            {t("daily.paintStamp")}
          </span>
          <FolderPaintSelect
            paintTag={paintTag}
            onPaintTagChange={onPaintTagChange}
          />
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 overflow-hidden rounded-xl rounded-tr-none border shadow-sm",
          "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {paintTag
              ? t("daily.paintOnHint", { tag: paintTag })
              : t("daily.carryHint")}
          </p>
          {canApprove ? (
            <Button
              size="sm"
              variant="cta"
              className="h-9 shrink-0 rounded-lg px-3 text-sm"
              onClick={onApproveDay}
              disabled={!approveEnabled}
            >
              <IconCheck className="h-4 w-4" />
              {dayApproved && approvePending === 0
                ? t("daily.approvedToday")
                : t("daily.approveDay")}
              {approvePending > 0 ? ` (${approvePending})` : ""}
            </Button>
          ) : null}
        </div>
        <div
          className={cn(
            "max-h-[min(72vh,760px)] overflow-auto bg-white dark:bg-neutral-950",
            paintTag && drag && "select-none",
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
                <th className="sticky left-[224px] z-40 min-w-[140px] border-b border-r border-neutral-300 bg-neutral-100 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  {t("cc.fields.name")}
                </th>
                {days.map((d) => {
                  const isToday = todayDay === d;
                  const isFuture = dateInMonth(month, d) > todayISO;
                  return (
                    <th
                      key={d}
                      className={cn(
                        "w-9 min-w-9 border-b border-r border-neutral-300 px-0 py-2 text-center dark:border-neutral-700",
                        isToday &&
                          "bg-primary/15 text-primary dark:bg-primary/25",
                        isFuture &&
                          "bg-neutral-50 text-neutral-300 dark:bg-neutral-900/50 dark:text-neutral-600",
                      )}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                const odd = index % 2 === 0;
                const stickyBg = odd
                  ? "bg-white dark:bg-neutral-950"
                  : "bg-neutral-50 dark:bg-neutral-900";

                let rolling: DailyTag | undefined = priorByUser.get(user.id);
                const rowMeta: {
                  date: string;
                  day: number;
                  stored?: DailyTag;
                  ghost?: DailyTag;
                  future: boolean;
                }[] = [];
                for (const d of days) {
                  const date = dateInMonth(month, d);
                  const future = date > todayISO;
                  if (future) {
                    rowMeta.push({ date, day: d, future: true });
                    continue;
                  }
                  const key = `${user.id}|${date}`;
                  const stored = byUserDate.get(key);
                  if (stored) rolling = stored;
                  const suppressed = suppressedSet.has(key);
                  rowMeta.push({
                    date,
                    day: d,
                    stored,
                    ghost: stored || suppressed ? undefined : rolling,
                    future: false,
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
                      {index + 1}
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
                        "sticky left-[224px] z-20 max-w-[160px] truncate border-b border-r border-neutral-200 px-2 py-0 text-xs font-medium text-neutral-900 dark:border-neutral-800 dark:text-white",
                        stickyBg,
                      )}
                    >
                      {user.name}
                    </td>
                    {rowMeta.map((cell, cellIdx) => {
                      const { date, day: d, stored, ghost, future } = cell;
                      if (future) {
                        return (
                          <td
                            key={date}
                            className="h-9 w-9 min-w-9 border-b border-r border-neutral-200 bg-neutral-50/80 p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
                            aria-hidden
                          />
                        );
                      }

                      const preview = inDragPreview(user.id, d);
                      let tag = stored;
                      let isGhost = false;
                      if (preview && paintTag) {
                        tag = drag?.clear ? undefined : paintTag;
                        isGhost = false;
                      } else if (!stored && ghost) {
                        tag = ghost;
                        isGhost = true;
                      }

                      const prevMeta = rowMeta[cellIdx - 1];
                      const nextMeta = rowMeta[cellIdx + 1];
                      const displayPrev = (() => {
                        if (prevMeta?.future) return undefined;
                        if (
                          preview &&
                          prevMeta &&
                          inDragPreview(user.id, prevMeta.day) &&
                          paintTag
                        ) {
                          return drag?.clear ? undefined : paintTag;
                        }
                        return prevMeta?.stored ?? prevMeta?.ghost;
                      })();
                      const displayNext = (() => {
                        if (nextMeta?.future) return undefined;
                        if (
                          preview &&
                          nextMeta &&
                          inDragPreview(user.id, nextMeta.day) &&
                          paintTag
                        ) {
                          return drag?.clear ? undefined : paintTag;
                        }
                        return nextMeta?.stored ?? nextMeta?.ghost;
                      })();
                      const contL = Boolean(
                        tag &&
                        !isGhost &&
                        displayPrev === tag &&
                        prevMeta?.stored,
                      );
                      const contR = Boolean(
                        tag &&
                        !isGhost &&
                        displayNext === tag &&
                        nextMeta?.stored,
                      );
                      const isToday = todayDay === d;

                      return (
                        <RegisterCell
                          key={date}
                          day={d}
                          userId={user.id}
                          tag={tag}
                          ghost={isGhost}
                          date={date}
                          userName={user.name}
                          isToday={isToday}
                          contL={contL}
                          contR={contR}
                          paintTag={paintTag}
                          preview={preview}
                          clearing={Boolean(preview && drag?.clear)}
                          locale={locale}
                          onTagChange={(nextTag) =>
                            onTagChange(user.id, date, nextTag)
                          }
                          onPaintStart={() => startPaint(user.id, d, stored)}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FolderPaintSelect({
  paintTag,
  onPaintTagChange,
}: {
  paintTag: DailyTag | "";
  onPaintTagChange: (tag: DailyTag | "") => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const current = paintTag || "__none__";

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
        )}
      >
        <SelectValue placeholder={t("daily.paintOff")}>
          {paintTag || t("daily.paintOff")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{t("daily.paintOff")}</SelectItem>
        {DAILY_TAGS.map((tag) => (
          <SelectItem key={tag.code} value={tag.code}>
            {tag.code} — {tagLabel(tag.code, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegisterCell({
  day,
  userId,
  tag,
  ghost,
  date,
  userName,
  isToday,
  contL,
  contR,
  paintTag,
  preview,
  clearing,
  locale,
  onTagChange,
  onPaintStart,
}: {
  day: number;
  userId: string;
  tag?: DailyTag;
  ghost?: boolean;
  date: string;
  userName: string;
  isToday: boolean;
  contL: boolean;
  contR: boolean;
  paintTag: DailyTag | "";
  preview: boolean;
  clearing: boolean;
  locale: Locale;
  onTagChange: (tag: DailyTag | "") => void;
  onPaintStart: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const cellClass = cn(
    "flex h-full w-full items-center justify-center font-mono text-[10px] font-bold leading-none transition hover:ring-1 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    paintTag && "cursor-crosshair touch-none",
    tag
      ? cn(
          TAG_CELL[tag],
          contL ? "rounded-l-none" : "rounded-l-sm",
          contR ? "rounded-r-none" : "rounded-r-sm",
          ghost &&
            "opacity-45 ring-1 ring-inset ring-dashed ring-neutral-400/70 dark:ring-neutral-500/70",
        )
      : "text-neutral-300 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:bg-neutral-800",
    preview && !clearing && "ring-1 ring-inset ring-primary/50",
    preview && clearing && "opacity-40 ring-1 ring-inset ring-rose-400/60",
  );

  const title = tag
    ? `${userName} · ${date} · ${tag}${ghost ? ` (${t("daily.carried")})` : ""} ${tagLabel(tag, locale)}`
    : `${userName} · ${date}`;

  return (
    <td
      className={cn(
        "h-9 w-9 min-w-9 border-b border-r border-neutral-200 p-0 dark:border-neutral-800",
        isToday && "bg-primary/[0.04]",
      )}
      data-reg-user={userId}
      data-reg-day={day}
    >
      {paintTag ? (
        <button
          type="button"
          title={title}
          className={cellClass}
          data-reg-user={userId}
          data-reg-day={day}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            onPaintStart();
          }}
        >
          {tag ?? "·"}
        </button>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" title={title} className={cellClass}>
              {tag ?? ""}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="center" sideOffset={6}>
            <p className="mb-2 truncate px-1 text-[10px] font-medium text-neutral-500">
              {userName} · {date}
              {ghost && tag ? ` · ${t("daily.carried")}` : ""}
            </p>
            {ghost && tag ? (
              <button
                type="button"
                onClick={() => {
                  onTagChange(tag);
                  setOpen(false);
                }}
                className="mb-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-dark"
              >
                <IconCheck className="h-3 w-3" />
                {t("daily.acceptCarry", { tag })}
              </button>
            ) : null}
            <div className="grid grid-cols-3 gap-1">
              {DAILY_TAGS.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onTagChange(item.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-1.5 py-1.5 font-mono text-[11px] font-bold transition hover:opacity-90",
                    TAG_CELL[item.code],
                    !ghost &&
                      tag === item.code &&
                      "ring-2 ring-primary ring-offset-1",
                  )}
                  title={tagLabel(item.code, locale)}
                >
                  {item.code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onTagChange("");
                setOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <IconX className="h-3 w-3" />
              {t("daily.noTag")}
            </button>
          </PopoverContent>
        </Popover>
      )}
    </td>
  );
}
