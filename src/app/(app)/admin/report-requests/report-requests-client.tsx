"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconCheck } from "@tabler/icons-react";
import { PaperStatusBadge } from "@/components/reports/paper-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/shared/toast-provider";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatDateDisplay } from "@/lib/date";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import {
  listPaperReports,
  verifyPaperReport,
} from "@/lib/store/paper-reports";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { PaperReportStatus } from "@/lib/types";

type Filter = "submitted" | "approved" | "all";

export default function AdminReportRequestsClient() {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("submitted");

  const rows = useMemo(
    () => listPaperReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.paper_report_requests],
  );

  const visible = rows.filter((row) => {
    if (filter === "all") return row.status !== "draft";
    return row.status === filter;
  });

  const pending = rows.filter((row) => row.status === "submitted").length;

  function onVerify(id: string) {
    const next = verifyPaperReport(id);
    if (!next) return;
    notifyCcDataChange();
    toast(t("paperReports.approvedToast"), "success");
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "submitted", label: t("paperReports.filterSubmitted") },
    { id: "approved", label: t("paperReports.filterApproved") },
    { id: "all", label: t("paperReports.filterAll") },
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

        <div className="flex flex-wrap gap-1.5">
          {filters.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                filter === tab.id
                  ? "border-primary/40 bg-primary text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-primary/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={t("paperReports.empty")}
            description={t("paperReports.emptyHint")}
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
