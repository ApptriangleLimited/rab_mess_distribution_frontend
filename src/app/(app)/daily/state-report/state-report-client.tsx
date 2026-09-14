"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconDownload,
  IconEye,
  IconFlame,
  IconPrinter,
  IconSend,
  IconSoup,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormattedDateInput } from "@/components/shared/date-picker";
import { useToast } from "@/components/shared/toast-provider";
import {
  apiSubmitStateReport,
  useStateReportDraft,
  useStateReportsApi,
} from "@/hooks/use-state-reports";
import { useStore } from "@/hooks/use-store";
import { isApiEnabled } from "@/lib/api/mode";
import { formatDateLong, nextISODate, previousISODate, todayISO } from "@/lib/date";
import { downloadStateReportPdf } from "@/lib/download-state-report-pdf";
import { tagCellClass } from "@/lib/tag-colors";
import {
  buildDailyStateReportDraft,
  getPendingStateReportForDate,
  listStateReports,
  submitStateReport,
} from "@/lib/store/state-reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { StateReportStatus } from "@/lib/types";

const STATUS_CLASS: Record<StateReportStatus, string> = {
  pending:
    "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  approved:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected:
    "border-rose-200/90 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200",
};

function statusLabel(
  status: StateReportStatus,
  t: ReturnType<typeof useT>,
) {
  if (status === "pending") return t("stateReport.statusPending");
  if (status === "approved") return t("stateReport.statusApproved");
  return t("stateReport.statusRejected");
}

export default function StateReportClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const dateParam = searchParams.get("date");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO(),
  );
  const [panel, setPanel] = useState<"preview" | "history">("preview");

  const apiOn = isApiEnabled();
  const { rows: apiRows, reload } = useStateReportsApi();
  const { draft: apiDraft } = useStateReportDraft(date);

  const storeDraft = useMemo(
    () => buildDailyStateReportDraft(date),
    // Recompute when live store mutates (tags / BK / roster).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state],
  );
  const draft = apiOn
    ? (apiDraft ?? {
        date,
        boro_khana: false,
        members: [],
        totals: { active: 0, by_tag: {}, mess_eaters: 0 },
      })
    : storeDraft;

  const pending = useMemo(
    () =>
      apiOn
        ? apiRows.find((r) => r.date === date && r.status === "pending") ?? null
        : getPendingStateReportForDate(date),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state.state_reports, apiOn, apiRows],
  );

  const submittedForDate = useMemo(() => {
    if (pending) return pending;
    const rows = apiOn ? apiRows : listStateReports();
    return rows.find((r) => r.date === date) ?? null;
  }, [pending, date, state.state_reports, apiOn, apiRows]);

  const history = useMemo(
    () => (apiOn ? apiRows : listStateReports()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.state_reports, apiOn, apiRows],
  );

  const tagEntries = useMemo(
    () =>
      Object.entries(draft.totals.by_tag).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    [draft.totals.by_tag],
  );

  const tagTotal = useMemo(
    () => tagEntries.reduce<number>((n, [, c]) => n + (c ?? 0), 0),
    [tagEntries],
  );

  function pushDate(next: string, openPreview = false) {
    setDate(next);
    if (openPreview) setPanel("preview");
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function onSubmit() {
    try {
      const report = apiOn
        ? await apiSubmitStateReport(date)
        : submitStateReport(date);
      if (apiOn) await reload();
      toast(t("stateReport.submittedToast", { date: report.date }), "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : t("stateReport.submitFail"),
        "error",
      );
    }
  }

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
              title={t("pages.stateReport.title")}
              subtitle={t("pages.stateReport.subtitle", {
                date: formatDateLong(
                  date,
                  locale === "bn" ? "bn-BD" : "en-GB",
                ),
              })}
              center={<DailyTabs />}
              actions={
                <div className="flex flex-wrap gap-2">
                  {submittedForDate ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl"
                        onClick={() =>
                          downloadStateReportPdf(
                            submittedForDate,
                            `state-report-${submittedForDate.date}-${submittedForDate.status}.pdf`,
                          )
                        }
                      >
                        <IconDownload className="h-4 w-4" />
                        {t("daily.exportPdf")}
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl"
                      >
                        <Link
                          href={`/daily/state-report/print?id=${encodeURIComponent(submittedForDate.id)}`}
                        >
                          <IconPrinter className="h-4 w-4" />
                          {t("mess.print")}
                        </Link>
                      </Button>
                    </>
                  ) : null}
                  <Button
                    onClick={onSubmit}
                    size="sm"
                    variant="cta"
                    className="gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                  >
                    <IconSend className="h-4 w-4" />
                    {pending
                      ? t("stateReport.resubmit")
                      : t("stateReport.submit")}
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 p-2.5 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
            {panel === "preview" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  aria-label={t("mess.prevDay")}
                  onClick={() => pushDate(previousISODate(date))}
                >
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <div className="relative w-44 shrink-0">
                  <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <FormattedDateInput
                    value={date}
                    onChange={(next) => {
                      if (next) pushDate(next);
                    }}
                    aria-label={t("mess.date")}
                    className="h-10 rounded-xl border-neutral-200 bg-white pl-9 shadow-none dark:border-neutral-600 dark:bg-neutral-950"
                    overlayClassName="left-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  aria-label={t("mess.nextDay")}
                  onClick={() => pushDate(nextISODate(date))}
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 rounded-xl px-3"
                  onClick={() => pushDate(todayISO())}
                >
                  {t("stateReport.today")}
                </Button>
                {draft.boro_khana ? (
                  <StatChip
                    icon={<IconFlame className="h-3.5 w-3.5" />}
                    label={t("daily.boroKhanaOn")}
                    value="BK"
                    tone="orange"
                  />
                ) : null}
                <StatChip
                  icon={<IconUsers className="h-3.5 w-3.5" />}
                  label={t("stateReport.statActive")}
                  value={String(draft.totals.active)}
                  tone="teal"
                />
                <StatChip
                  icon={<IconSoup className="h-3.5 w-3.5" />}
                  label={t("stateReport.statMess")}
                  value={String(draft.totals.mess_eaters)}
                  tone="emerald"
                />
                <StatChip
                  icon={<IconTags className="h-3.5 w-3.5" />}
                  label={t("stateReport.statTags")}
                  value={String(tagTotal)}
                  tone="sky"
                />
                {tagEntries.map(([tag, count]) => (
                  <span
                    key={tag}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold shadow-sm",
                      tagCellClass(tag),
                    )}
                    title={tagLabel(tag, locale)}
                  >
                    {tag}
                    <span className="rounded-md bg-black/5 px-1.5 py-px tabular-nums dark:bg-white/10">
                      {count}
                    </span>
                  </span>
                ))}
              </>
            ) : (
              <p className="px-1 text-sm text-neutral-500">
                {t("stateReport.historyTitle")}
              </p>
            )}
          </div>

          <PanelTabs
            value={panel}
            onChange={setPanel}
            previewLabel={t("stateReport.previewTitle")}
            historyLabel={t("stateReport.historyTitle")}
            historyCount={history.length}
            className="ml-auto shrink-0"
          />
        </div>

        {panel === "preview" ? (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(6,121,87,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-none">
              {draft.members.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title={t("stateReport.emptyPreview")}
                    description={t("stateReport.emptyPreviewHint")}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-xl text-left text-sm">
                    <thead className="border-b border-neutral-200 bg-gradient-to-r from-primary/[0.07] via-sky-50/70 to-teal-50/50 text-[11px] uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-800 dark:from-primary/15 dark:via-neutral-900 dark:to-neutral-900 dark:text-neutral-400">
                      <tr>
                        <th className="px-3 py-3 font-semibold">#</th>
                        <th className="px-3 py-3 font-semibold">
                          {t("daily.registerColId")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("daily.registerColName")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("daily.registerColRank")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("stateReport.colWing")}
                        </th>
                        <th className="px-3 py-3 font-semibold">
                          {t("stateReport.colTag")}
                        </th>
                        {draft.boro_khana ? (
                          <th className="px-3 py-3 font-semibold">
                            {t("stateReport.messReason")}
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.members.map((m, i) => (
                        <tr
                          key={m.user_id}
                          className={cn(
                            "border-b border-neutral-100 last:border-0 dark:border-neutral-900",
                            i % 2 === 1 &&
                              "bg-neutral-50/40 dark:bg-neutral-900/40",
                          )}
                        >
                          <td className="px-3 py-2.5 tabular-nums text-neutral-500">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md bg-neutral-100/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {m.rab_id}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-900 dark:text-neutral-50">
                            {m.name}
                          </td>
                          <td className="px-3 py-2.5">{m.rank}</td>
                          <td className="px-3 py-2.5">
                            {m.wing ? (
                              <span className="inline-flex rounded-xl border border-sky-200/80 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                                {m.wing}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {m.tag ? (
                              <span
                                className={cn(
                                  "inline-flex rounded-xl border px-2.5 py-0.5 text-xs font-bold",
                                  tagCellClass(m.tag),
                                )}
                              >
                                {m.tag}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          {draft.boro_khana ? (
                            <td className="px-3 py-2.5 text-xs">
                              {m.mess_reason ?? "—"}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
        ) : history.length === 0 ? (
          <EmptyState title={t("stateReport.historyEmpty")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((r) => {
              const tagSum = Object.values(r.totals.by_tag).reduce<number>(
                (n, c) => n + (c ?? 0),
                0,
              );
              const statusTone =
                r.status === "pending"
                  ? "from-amber-50/90 via-white to-orange-50/50 border-amber-200/70 dark:from-amber-950/30 dark:via-neutral-950 dark:to-neutral-950 dark:border-amber-800/40"
                  : r.status === "approved"
                    ? "from-emerald-50/90 via-white to-teal-50/40 border-primary/20 dark:from-emerald-950/20 dark:via-neutral-950 dark:to-neutral-950 dark:border-primary/30"
                    : "from-rose-50/90 via-white to-red-50/40 border-rose-200/70 dark:from-rose-950/20 dark:via-neutral-950 dark:to-neutral-950 dark:border-rose-800/40";

              return (
                <li key={r.id}>
                  <article
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br shadow-[0_1px_2px_rgba(6,121,87,0.05),0_12px_28px_-16px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-12px_rgba(6,121,87,0.28)] dark:shadow-none dark:hover:shadow-none",
                      statusTone,
                    )}
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/15"
                      aria-hidden
                    />
                    <div className="relative flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => pushDate(r.date, true)}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                            {r.date}
                          </p>
                          <p className="mt-0.5 truncate text-base font-semibold text-neutral-900 transition group-hover:text-primary dark:text-neutral-50 dark:group-hover:text-emerald-200">
                            {formatDateLong(
                              r.date,
                              locale === "bn" ? "bn-BD" : "en-GB",
                            )}
                          </p>
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {t("stateReport.historyMeta", {
                              active: String(r.totals.active),
                              by: r.submitted_by,
                            })}
                          </p>
                        </button>
                        <Badge
                          className={cn(
                            "shrink-0 border font-semibold",
                            STATUS_CLASS[r.status],
                          )}
                        >
                          {statusLabel(r.status, t)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 text-[11px] font-bold text-primary dark:border-primary/35 dark:bg-primary/20 dark:text-emerald-100">
                          <IconUsers className="h-3.5 w-3.5" />
                          {r.totals.active}
                          <span className="font-semibold opacity-70">
                            {t("stateReport.statActive")}
                          </span>
                        </span>
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                          <IconSoup className="h-3.5 w-3.5" />
                          {r.totals.mess_eaters}
                          <span className="font-semibold opacity-70">
                            {t("stateReport.statMess")}
                          </span>
                        </span>
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-sky-200/90 bg-sky-50 px-2.5 text-[11px] font-bold text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                          <IconTags className="h-3.5 w-3.5" />
                          {tagSum}
                          <span className="font-semibold opacity-70">
                            {t("stateReport.statTags")}
                          </span>
                        </span>
                        {r.boro_khana ? (
                          <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-orange-200/90 bg-orange-50 px-2.5 text-[11px] font-bold text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200">
                            <IconFlame className="h-3.5 w-3.5" />
                            BK
                            <span className="font-semibold opacity-70">
                              {t("daily.boroKhanaOn")}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {r.note ? (
                        <p className="line-clamp-2 rounded-xl border border-neutral-200/80 bg-white/70 px-2.5 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300">
                          {r.note}
                        </p>
                      ) : null}
                    </div>

                    <div className="relative flex items-center gap-1.5 border-t border-neutral-200/70 bg-white/60 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 flex-1 rounded-xl text-xs"
                        onClick={() => pushDate(r.date, true)}
                      >
                        <IconEye className="h-3.5 w-3.5" />
                        {t("stateReport.previewTitle")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-xl"
                        aria-label={t("daily.exportPdf")}
                        onClick={() =>
                          downloadStateReportPdf(
                            r,
                            `state-report-${r.date}-${r.status}.pdf`,
                          )
                        }
                      >
                        <IconDownload className="h-4 w-4" />
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-xl"
                      >
                        <Link
                          href={`/daily/state-report/print?id=${encodeURIComponent(r.id)}`}
                          aria-label={t("mess.print")}
                        >
                          <IconPrinter className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </PagePane>
  );
}

function PanelTabs({
  value,
  onChange,
  previewLabel,
  historyLabel,
  historyCount,
  className,
}: {
  value: "preview" | "history";
  onChange: (next: "preview" | "history") => void;
  previewLabel: string;
  historyLabel: string;
  historyCount: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const tabs = [
    {
      id: "preview" as const,
      label: previewLabel,
      icon: IconEye,
    },
    {
      id: "history" as const,
      label: historyLabel,
      icon: IconClipboardList,
      count: historyCount,
    },
  ];

  return (
    <nav
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-primary/20 bg-white/80 p-0.5 shadow-sm dark:border-primary/30 dark:bg-neutral-950/80",
        className,
      )}
      aria-label={previewLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              active
                ? "text-white"
                : "text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-emerald-200",
            )}
          >
            {active ? (
              <motion.span
                layoutId="state-report-panel-tabs"
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary via-primary-light to-secondary shadow-md shadow-primary/30"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" stroke={2.25} />
              <span className="hidden whitespace-nowrap sm:inline">
                {tab.label}
              </span>
              {"count" in tab && tab.count != null ? (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-px text-[11px] font-extrabold tabular-nums",
                    active ? "bg-white/20" : "bg-black/5 dark:bg-white/10",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "teal" | "emerald" | "sky" | "orange";
}) {
  const tones = {
    teal: "border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100",
    emerald:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    sky: "border-sky-200/90 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200",
    orange:
      "border-orange-200/90 bg-orange-50 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 shadow-sm",
        tones,
      )}
    >
      <span className="shrink-0 opacity-90" aria-hidden>
        {icon}
      </span>
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-px text-xs font-extrabold tabular-nums dark:bg-white/10">
        {value}
      </span>
    </span>
  );
}
