"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconCheck, IconCircleCheck, IconClockHour4, IconLayoutList } from "@tabler/icons-react";
import { PaperStatusBadge } from "@/components/reports/paper-status-badge";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { useToast } from "@/components/shared/toast-provider";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { formatDateDisplay } from "@/lib/date";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import {
  listPaperReports,
  verifyPaperReport,
} from "@/lib/store/paper-reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { PaperReportKind, PaperReportStatus } from "@/lib/types";

type StatusFilter = "submitted" | "approved" | "all";
type KindFilter = "all" | PaperReportKind;

export default function AdminReportRequestsClient() {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<StatusFilter>("submitted");
  const [kind, setKind] = useState<KindFilter>("all");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows = useMemo(
    () => listPaperReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.paper_report_requests],
  );

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const from = dateFrom <= dateTo || !dateTo ? dateFrom : dateTo;
    const to = dateFrom <= dateTo || !dateFrom ? dateTo : dateFrom;
    return rows.filter((row) => {
      if (row.kind === "pritibhoj") return false;
      if (row.status === "draft") return false;
      if (filter !== "all" && row.status !== filter) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (from && row.date < from) return false;
      if (to && row.date > to) return false;
      if (!query) return true;
      const kindLabel =
        row.kind === "pritibhoj"
          ? t("paperReports.kindPritibhoj")
          : t("paperReports.kindManpower");
      return [
        row.title,
        row.date,
        row.form ?? "",
        row.submitted_by,
        row.reviewed_by,
        kindLabel,
        row.kind,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, filter, kind, q, dateFrom, dateTo, t]);

  const pending = rows.filter(
    (row) => row.kind !== "pritibhoj" && row.status === "submitted",
  ).length;
  const verified = rows.filter(
    (row) => row.kind !== "pritibhoj" && row.status === "approved",
  ).length;
  const allCount = rows.filter(
    (row) => row.kind !== "pritibhoj" && row.status !== "draft",
  ).length;
  const filtersActive = kind !== "all" || Boolean(dateFrom || dateTo || q.trim());

  function onVerify(id: string) {
    const next = verifyPaperReport(id);
    if (!next) return;
    notifyCcDataChange();
    toast(t("paperReports.approvedToast"), "success");
  }

  const filters: {
    id: StatusFilter;
    label: string;
    count: number;
    icon: typeof IconClockHour4;
  }[] = [
    {
      id: "submitted",
      label: t("paperReports.filterPending"),
      count: pending,
      icon: IconClockHour4,
    },
    {
      id: "approved",
      label: t("paperReports.filterApproved"),
      count: verified,
      icon: IconCircleCheck,
    },
    {
      id: "all",
      label: t("paperReports.filterAll"),
      count: allCount,
      icon: IconLayoutList,
    },
  ];

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.adminReportRequests.title")}
          subtitle={t("pages.adminReportRequests.subtitle", {
            count: String(pending),
          })}
          center={<AdminTabs />}
        />

        <div
          role="tablist"
          aria-label={t("pages.adminReportRequests.title")}
          className="inline-flex w-fit max-w-full items-center gap-0.5 rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white via-neutral-50 to-emerald-50/40 p-1 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.28)] dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900"
        >
          {filters.map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold tracking-wide transition",
                  active
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    active ? "text-white" : "text-primary",
                  )}
                />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-neutral-900/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("paperReports.searchPlaceholder")}
          searchClassName="w-64 shrink-0 sm:w-72"
          filtersActive={filtersActive}
        >
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as KindFilter)}
          >
            <SelectTrigger
              className="h-10 w-[10.5rem] rounded-xl text-sm"
              aria-label={t("paperReports.filterKind")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("paperReports.kindAll")}</SelectItem>
              <SelectItem value="manpower">
                {t("paperReports.kindManpower")}
              </SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
            label={t("common.dateRange")}
            triggerClassName="h-10 min-w-[13.5rem] rounded-xl px-3 text-sm"
          />
        </SearchFilterBar>

        {visible.length === 0 ? (
          <EmptyState
            title={t("paperReports.empty")}
            description={
              filtersActive
                ? t("paperReports.emptyFiltered")
                : t("paperReports.emptyHint")
            }
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("paperReports.colKind")}</th>
                    <th className="px-4 py-3">{t("paperReports.colTitle")}</th>
                    <th className="px-4 py-3">{t("paperReports.colDate")}</th>
                    <th className="px-4 py-3">{t("paperReports.colBy")}</th>
                    <th className="px-4 py-3">{t("paperReports.colStatus")}</th>
                    <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                        {row.kind === "pritibhoj"
                          ? t("paperReports.kindPritibhoj")
                          : t("paperReports.kindManpower")}
                        {row.form ? ` · ${row.form}` : ""}
                      </td>
                      <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-white">
                        {row.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {formatDateDisplay(row.date)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {row.submitted_by || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <PaperStatusBadge status={row.status as PaperReportStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === "submitted" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => onVerify(row.id)}
                          >
                            <IconCheck className="h-4 w-4" />
                            {t("paperReports.approve")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}
