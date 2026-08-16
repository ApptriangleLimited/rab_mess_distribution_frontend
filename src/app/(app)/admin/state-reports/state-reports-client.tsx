"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconCheck,
  IconDownload,
  IconFlame,
  IconPrinter,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast-provider";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatDateLong } from "@/lib/date";
import { downloadStateReportPdf } from "@/lib/download-state-report-pdf";
import { tagCellClass } from "@/lib/tag-colors";
import {
  approveStateReport,
  getStateReport,
  listPendingStateReports,
  listStateReports,
  rejectStateReport,
} from "@/lib/store/state-reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DailyStateReport, StateReportStatus } from "@/lib/types";

const STATUS_CLASS: Record<StateReportStatus, string> = {
  pending:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
};

type Filter = "pending" | "all" | "approved" | "rejected";

function statusLabel(
  status: StateReportStatus,
  t: ReturnType<typeof useT>,
) {
  if (status === "pending") return t("stateReport.statusPending");
  if (status === "approved") return t("stateReport.statusApproved");
  return t("stateReport.statusRejected");
}

export default function AdminStateReportsClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const filterParam = searchParams.get("filter");
  const filter: Filter =
    filterParam === "all" ||
    filterParam === "approved" ||
    filterParam === "rejected" ||
    filterParam === "pending"
      ? filterParam
      : "pending";

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const pending = useMemo(
    () => listPendingStateReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.state_reports],
  );

  const all = useMemo(
    () => listStateReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.state_reports],
  );

  const list = useMemo(() => {
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [all, filter]);

  const selectedId =
    idParam && all.some((r) => r.id === idParam)
      ? idParam
      : (list[0]?.id ?? null);

  const selected = selectedId ? getStateReport(selectedId) : null;

  function setQuery(next: { id?: string | null; filter?: Filter }) {
    const params = new URLSearchParams(searchParams.toString());
    const f = next.filter ?? filter;
    if (f === "pending") params.delete("filter");
    else params.set("filter", f);
    const id = next.id === undefined ? selectedId : next.id;
    if (id) params.set("id", id);
    else params.delete("id");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  function onApprove() {
    if (!selected) return;
    const updated = approveStateReport(selected.id);
    setApproveOpen(false);
    if (!updated) {
      toast(t("stateReport.adminActionFail"), "error");
      return;
    }
    toast(t("stateReport.approvedToast", { date: updated.date }), "success");
    const still = listPendingStateReports();
    setQuery({ id: still[0]?.id ?? updated.id, filter: "pending" });
  }

  function onReject() {
    if (!selected) return;
    const updated = rejectStateReport(
      selected.id,
      rejectNote.trim() || undefined,
    );
    setRejectOpen(false);
    setRejectNote("");
    if (!updated) {
      toast(t("stateReport.adminActionFail"), "error");
      return;
    }
    toast(t("stateReport.rejectedToast", { date: updated.date }), "success");
    const still = listPendingStateReports();
    setQuery({ id: still[0]?.id ?? updated.id, filter: "pending" });
  }

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  return (
    <PagePane>
      <PageHeader
        title={t("pages.adminStateReports.title")}
        subtitle={t("pages.adminStateReports.subtitle", {
          count: String(pending.length),
        })}
        center={<AdminTabs />}
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["pending", t("stateReport.filterPending"), pending.length],
            ["all", t("stateReport.filterAll"), all.length],
            [
              "approved",
              t("stateReport.filterApproved"),
              all.filter((r) => r.status === "approved").length,
            ],
            [
              "rejected",
              t("stateReport.filterRejected"),
              all.filter((r) => r.status === "rejected").length,
            ],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setQuery({ filter: key, id: null })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filter === key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300",
            )}
          >
            {label}
            <span className="tabular-nums opacity-80">{count}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={
            filter === "pending"
              ? t("stateReport.queueEmpty")
              : t("stateReport.listEmpty")
          }
          description={
            filter === "pending"
              ? t("stateReport.queueEmptyHint")
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setQuery({ id: r.id })}
                  className={cn(
                    "flex w-full flex-col gap-1 px-3 py-3 text-left transition",
                    selectedId === r.id
                      ? "bg-neutral-100 dark:bg-neutral-900"
                      : "bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {formatDateLong(r.date, dateLocale)}
                    </span>
                    <Badge className={STATUS_CLASS[r.status]}>
                      {statusLabel(r.status, t)}
                    </Badge>
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t("stateReport.historyMeta", {
                      active: String(r.totals.active),
                      by: r.submitted_by,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <ReportDetail
              report={selected}
              dateLocale={dateLocale}
              onApprove={() => setApproveOpen(true)}
              onReject={() => {
                setRejectNote("");
                setRejectOpen(true);
              }}
            />
          ) : (
            <EmptyState title={t("stateReport.pickReport")} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        title={t("stateReport.approveTitle")}
        body={
          selected
            ? t("stateReport.approveBody", {
                date: formatDateLong(selected.date, dateLocale),
              })
            : ""
        }
        confirmLabel={t("stateReport.approve")}
        tone="success"
        onConfirm={onApprove}
        onCancel={() => setApproveOpen(false)}
      />

      <ConfirmDialog
        open={rejectOpen}
        title={t("stateReport.rejectTitle")}
        body={
          selected
            ? t("stateReport.rejectBody", {
                date: formatDateLong(selected.date, dateLocale),
              })
            : ""
        }
        confirmLabel={t("stateReport.reject")}
        danger
        onConfirm={onReject}
        onCancel={() => {
          setRejectOpen(false);
          setRejectNote("");
        }}
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-200">
            {t("stateReport.rejectNote")}
          </span>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            placeholder={t("stateReport.rejectNoteHint")}
          />
        </label>
      </ConfirmDialog>
    </PagePane>
  );
}

function ReportDetail({
  report,
  dateLocale,
  onApprove,
  onReject,
}: {
  report: DailyStateReport;
  dateLocale: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const tagEntries = Object.entries(report.totals.by_tag).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-4 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {formatDateLong(report.date, dateLocale)}
            </h2>
            <Badge className={STATUS_CLASS[report.status]}>
              {statusLabel(report.status, t)}
            </Badge>
            {report.boro_khana ? (
              <Badge className="gap-1 bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
                <IconFlame className="h-3.5 w-3.5" />
                {t("daily.boroKhanaOn")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {t("stateReport.submittedBy", {
              by: report.submitted_by,
              at: new Date(report.submitted_at).toLocaleString(
                locale === "bn" ? "bn-BD" : "en-GB",
              ),
            })}
          </p>
          {report.reviewed_at ? (
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("stateReport.reviewedBy", {
                by: report.reviewed_by ?? "—",
                at: new Date(report.reviewed_at).toLocaleString(
                  locale === "bn" ? "bn-BD" : "en-GB",
                ),
              })}
            </p>
          ) : null}
          {report.note ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {t("stateReport.rejectNoteLabel")}: {report.note}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              downloadStateReportPdf(
                report,
                `state-report-${report.date}-${report.status}.pdf`,
              )
            }
          >
            <IconDownload className="h-4 w-4" />
            {t("daily.exportPdf")}
          </Button>
          <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
            <Link href={`/admin/state-reports/print?id=${encodeURIComponent(report.id)}`}>
              <IconPrinter className="h-4 w-4" />
              {t("mess.print")}
            </Link>
          </Button>
          {report.status === "pending" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={onReject}
              >
                <IconX className="h-4 w-4" />
                {t("stateReport.reject")}
              </Button>
              <Button type="button" className="gap-1.5" onClick={onApprove}>
                <IconCheck className="h-4 w-4" />
                {t("stateReport.approve")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 px-4 sm:grid-cols-3">
        <MiniStat
          label={t("stateReport.statActive")}
          value={report.totals.active}
        />
        <MiniStat
          label={t("stateReport.statMess")}
          value={report.totals.mess_eaters}
        />
        <MiniStat
          label={t("stateReport.statTags")}
          value={tagEntries.reduce((n, [, c]) => n + c, 0)}
        />
      </div>

      {tagEntries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4">
          {tagEntries.map(([tag, count]) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                tagCellClass(tag),
              )}
              title={tagLabel(tag, locale)}
            >
              {tag}
              <span className="opacity-80">{count}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto border-t border-neutral-200 dark:border-neutral-800">
        {report.members.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t("stateReport.emptyPreview")} />
          </div>
        ) : (
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">
                  {t("daily.registerColId")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("daily.registerColName")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("daily.registerColRank")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("stateReport.colWing")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("stateReport.colTag")}
                </th>
                {report.boro_khana ? (
                  <th className="px-3 py-2 font-medium">
                    {t("stateReport.messReason")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {report.members.map((m, i) => (
                <tr
                  key={m.user_id}
                  className="border-t border-neutral-100 dark:border-neutral-900"
                >
                  <td className="px-3 py-2 tabular-nums text-neutral-500">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.rab_id}</td>
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2">{m.rank}</td>
                  <td className="px-3 py-2">{m.wing}</td>
                  <td className="px-3 py-2">
                    {m.tag ? (
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                          tagCellClass(m.tag),
                        )}
                      >
                        {m.tag}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  {report.boro_khana ? (
                    <td className="px-3 py-2 text-xs">
                      {m.mess_reason ?? "—"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
